import { spawn } from "node:child_process";
import {
  LLMError,
  type GenerateJSONOptions,
  type GenerateTextOptions,
  type LLMMessage,
  type LLMProvider,
  type Usage,
} from "./types";

// DEV-ONLY provider: routes generation through the locally installed `claude`
// CLI in headless mode (`claude -p`). The CLI uses whatever credentials you're
// logged in with — i.e. your Claude subscription — so calls count toward your
// plan's usage limits rather than per-token API billing.
//
// Not for production: a shipped product must use the metered API. There is also
// no strict JSON-schema enforcement here, so generateJSON parses leniently and
// the caller validates with Zod.

const ZERO: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

const CLI_TIMEOUT_MS = 240_000;

function modelAlias(model: string): string | null {
  if (process.env.CLAUDE_CLI_MODEL) return process.env.CLAUDE_CLI_MODEL;
  const m = model.toLowerCase();
  if (m.includes("haiku")) return "haiku";
  if (m.includes("sonnet")) return "sonnet";
  if (m.includes("opus")) return "opus";
  return null; // let the CLI use its default model
}

function buildPrompt(system: string | undefined, messages: LLMMessage[]): string {
  const parts: string[] = [];
  if (system) parts.push(system);
  for (const m of messages) {
    parts.push(`${m.role === "user" ? "User" : "Assistant"}: ${m.content}`);
  }
  return parts.join("\n\n");
}

function extractJson(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
  return t;
}

function runClaude(prompt: string, model: string | null): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ["-p", "--output-format", "json"];
    if (model) args.push("--model", model);

    const child = spawn("claude", args, { shell: process.platform === "win32" });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new LLMError("Claude CLI timed out.", 504));
    }, CLI_TIMEOUT_MS);

    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(
        new LLMError(
          `Could not start the claude CLI (${e.message}). Is Claude Code installed and logged in?`,
          500,
        ),
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new LLMError(`Claude CLI exited with code ${code}: ${stderr.slice(0, 300)}`, 502));
        return;
      }
      try {
        const env = JSON.parse(stdout) as { is_error?: boolean; result?: unknown };
        if (env.is_error) {
          reject(new LLMError(`Claude CLI returned an error: ${String(env.result ?? "unknown")}`, 502));
          return;
        }
        resolve(typeof env.result === "string" ? env.result : stdout);
      } catch {
        resolve(stdout); // fall back to raw output
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

export class ClaudeCliProvider implements LLMProvider {
  readonly name = "claude-cli";

  async generateText(opts: GenerateTextOptions) {
    const text = await runClaude(buildPrompt(opts.system, opts.messages), modelAlias(opts.model));
    return { text, usage: ZERO };
  }

  async generateJSON(opts: GenerateJSONOptions) {
    const instruction = `\n\nRespond with ONLY a single valid JSON object that conforms to the JSON Schema below. No prose, no explanation, no markdown code fences.\n\nJSON Schema:\n${JSON.stringify(opts.jsonSchema)}`;
    const raw = await runClaude(buildPrompt(opts.system, opts.messages) + instruction, modelAlias(opts.model));
    const jsonText = extractJson(raw);
    let data: unknown;
    try {
      data = JSON.parse(jsonText);
    } catch {
      throw new LLMError("The claude CLI did not return valid JSON. Try again or use a different model.", 502);
    }
    return { data, raw: jsonText, usage: ZERO };
  }
}
