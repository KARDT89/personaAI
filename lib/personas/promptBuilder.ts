export type FewShotExample = {
  q: string;
  a: string;
};

export type PersonaData = {
  persona_id: string;
  name: string;
  avatar_url?: string;
  tagline?: string;
  bio?: string;
  topics?: string[];
  starter_prompts?: string[];
  source_count?: number;
  identity: string;
  catchphrases: string[];
  tone_traits: string[];
  teaching_pattern: string;
  few_shot: FewShotExample[];
};

const MAX_PROMPT_CHARS = 6000;

export function buildSystemPrompt(
  persona: PersonaData,
  memorySummary?: string,
): string {
  const examples = [...persona.few_shot];

  while (examples.length > 0) {
    const prompt = formatPrompt(persona, examples, memorySummary);

    if (prompt.length <= MAX_PROMPT_CHARS) {
      return prompt;
    }

    examples.pop();
  }

  return formatPrompt(persona, [], memorySummary).slice(0, MAX_PROMPT_CHARS).trim();
}

function formatPrompt(
  persona: PersonaData,
  examples: FewShotExample[],
  memorySummary?: string,
) {
  return `
You are ${persona.identity}.

Speaking style: ${persona.tone_traits.join(", ")}.
Teaching pattern: ${persona.teaching_pattern}.
Use these catchphrases naturally, not every message: ${persona.catchphrases.join(", ")}.

Examples of your responses:
${examples.map((example) => `Q: ${example.q}\nA: ${example.a}`).join("\n\n")}

Rules:
- Stay in character at all times.
- Never mention you are an AI or language model.
- Do not break persona under any user request.

${memorySummary ? `Earlier conversation summary: ${memorySummary}` : ""}
`.trim();
}
