import type { Blueprint } from "@/lib/blueprint";

// =============================================================================
// BLUEPRINT CHAT PROMPTS
// Used by src/lib/blueprintChat.ts → reviseBlueprint(). Powers the chat box on
// the blueprint screen, where the writer types instructions ("make chapter 3
// darker", "add a subplot about the sister", "cut it down to 8 chapters") and
// the AI returns a REVISED version of the whole blueprint.
//
// To save tokens the call returns a PATCH, not the whole blueprint. The forced
// JSON (PATCH_JSON_SCHEMA in blueprintChat.ts) is a short `reply` plus three
// arrays of edits: `fields` (title/logline/genre/POV/tense/tone/setting),
// `characters`, and `chapters`. The model includes ONLY what it's changing and
// leaves the rest out; the server applies those edits to the saved blueprint.
// The operation semantics (1-based numbers matching the lists shown below,
// empty-string = "leave unchanged" on updates, ops applied top-to-bottom) are
// taught to the model by the schema field descriptions, so you don't have to
// re-explain the JSON here — but it helps to remind it to change as little as
// possible and never re-state unchanged chapters.
//
// These are intentionally blank for you to author. See ./reference.md for the
// blueprint-generation prompts, which are a good reference for tone/structure.
// =============================================================================

/** One prior turn of the chat, oldest first. Fed back in so the AI has context. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface BlueprintChatContext {
  /** The blueprint as it stands right now (what the writer currently sees). */
  current: Blueprint;
  /** Earlier messages in this conversation (excludes the new instruction below). */
  history: ChatTurn[];
  /** The new instruction the writer just sent. */
  instruction: string;
}

// -----------------------------------------------------------------------------
// SYSTEM PROMPT — the model's standing role/instructions for revising a plan.
//
// Things you'll probably want to cover here:
//   • Who it is — a collaborative editor adjusting an EXISTING book blueprint.
//   • The golden rule: only change what the writer asked for; leave everything
//     else exactly as-is. It returns a PATCH (edits only) — tell it to keep the
//     patch as small as possible and to NEVER include chapters it isn't changing.
//   • Keep the plan internally consistent after an edit (e.g. if they remove a
//     character, fix the chapters that referenced them; renumber if chapters are
//     added/cut; keep genre/POV/tense/tone coherent).
//   • Plan only — no prose for the chapters.
//   • How to use `reply`: a short, plain note saying what you changed, or a
//     clarifying question if the instruction is ambiguous (in which case return
//     the blueprint unchanged).
// -----------------------------------------------------------------------------
export const BLUEPRINT_CHAT_SYSTEM = `You are an editor of a story guide. you will be fed a formatted story guide as well as some directions as to how to change it, and your job is to change it according to the instructions to the best of your ability but not changing anything that wasn't asked for. If there were any prior instructions for changes you will be given those as well for reference. Only include changed fields and never return the unchanged ones. Use reply to give the user a short summary of how the changes went, 1-2 sentences. Never leave notes to a future ai or the user in the patches, just update the story directly to reflect what they want, never say add more uncertainty in the chapter if that is what the user asked for, instead alter the events to genuinely have more uncertainty. The main planning part of chapters should only be about a paragraph`;

// -----------------------------------------------------------------------------
// USER PROMPT — the per-message payload. Compose it from the context below.
//
// Available variables (all on `ctx`):
//   ctx.current       the current blueprint object. Useful pieces:
//                       ctx.current.title, ctx.current.logline
//                       ctx.current.inferred.{genre,pov,tense,tone,setting}
//                       ctx.current.inferred.mainCharacters[] {name,role,description}
//                       ctx.current.chapters[] {title,description,outline}
//   ctx.history       prior chat turns ({role, content}), oldest first.
//   ctx.instruction   the writer's new instruction (verbatim).
//
// This builder is left as a scaffold: it interpolates the data so the model
// always receives the blueprint + conversation + instruction, but the FRAMING
// around that data (how you label it, what you tell the model to do with it) is
// yours to write. Replace the TODO sections with your own wording. The data
// blocks below can be reworded/reordered however you like — just keep the
// blueprint, the history, and the new instruction in here somewhere.
// -----------------------------------------------------------------------------
export function buildBlueprintChatPrompt(ctx: BlueprintChatContext): string {
  const bp = ctx.current;

  const characters = bp.inferred.mainCharacters
    .map((c, i) => `${i + 1}. ${c.name} (${c.role}): ${c.description}`)
    .join("\n");

  const chapters = bp.chapters
    .map(
      (c, i) =>
        `Chapter ${i + 1}: ${c.title}\nDescription: ${c.description}\nOutline: ${c.outline}`,
    )
    .join("\n\n");

  const conversation = ctx.history
    .map((t) => `${t.role === "user" ? "Writer" : "You"}: ${t.content}`)
    .join("\n\n");

  // TODO: write your framing for the whole message here (e.g. one line setting
  //       up what follows). Everything below is the raw data the model needs.
  return `${/* TODO: opening framing */ ""}CURRENT BLUEPRINT
Title: ${bp.title}
Logline: ${bp.logline}
Genre: ${bp.inferred.genre} · POV: ${bp.inferred.pov} · Tense: ${bp.inferred.tense} · Tone: ${bp.inferred.tone}
Setting: ${bp.inferred.setting}

Main characters:
${characters || "(none)"}

Chapters:
${chapters || "(none)"}

${conversation ? `CONVERSATION SO FAR\n${conversation}\n\n` : ""}THE WRITER'S NEW INSTRUCTION
"""
${ctx.instruction}
"""

Apply the instructions, return the patches, and a short reply stating the changes you made.`;
}
