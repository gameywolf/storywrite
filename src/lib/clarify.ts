import { z } from "zod";
import { getProvider } from "./llm";
import { getTargetLength } from "./models";
import { CLARIFY_SYSTEM, clarifyUserPrompt } from "./prompts/blueprint";

// ---- Output shape -----------------------------------------------------------

const QuestionSchema = z.object({
  topic: z.string(),
  question: z.string(),
  options: z.array(z.string()),
});

const ClarifyResultSchema = z.object({
  questions: z.array(QuestionSchema),
});

export type ClarifyQuestion = z.infer<typeof QuestionSchema>;

// Hand-written JSON Schema (Anthropic strict-output rules: every object has
// additionalProperties:false and lists all props in `required`). The UI adds its
// own free-text "Other" box, so the model only supplies fixed options.
const CLARIFY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      description: "Between 2 and 10 clarifying questions about the biggest gaps in the idea.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          topic: { type: "string", description: "Short 2-4 word label, e.g. 'Point of view'." },
          question: { type: "string", description: "The clear, specific question." },
          options: {
            type: "array",
            description: "2-5 concrete, genuinely different directions the story could take.",
            items: { type: "string" },
          },
        },
        required: ["topic", "question", "options"],
      },
    },
  },
  required: ["questions"],
} as const;

// ---- Entry point ------------------------------------------------------------

export interface GenerateClarifyInput {
  description: string;
  targetLength: string;
  provider: string;
  model: string;
  apiKey: string;
}

export async function generateClarifyingQuestions(
  input: GenerateClarifyInput,
): Promise<ClarifyQuestion[]> {
  const len = getTargetLength(input.targetLength);
  const llm = getProvider(input.provider, input.apiKey);

  const { data } = await llm.generateJSON({
    model: input.model,
    system: CLARIFY_SYSTEM,
    messages: [{ role: "user", content: clarifyUserPrompt(input.description, len) }],
    maxTokens: 6000,
    effort: "medium",
    thinking: true,
    jsonSchema: CLARIFY_JSON_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "clarifying_questions",
  });

  const parsed = ClarifyResultSchema.parse(data);

  // Defensive clamping in case the model ignores the count guidance: keep at most
  // 10 questions, drop any with fewer than 2 options, and cap options at 6.
  return parsed.questions
    .filter((q) => q.options.length >= 2)
    .slice(0, 10)
    .map((q) => ({ ...q, options: q.options.slice(0, 6) }));
}
