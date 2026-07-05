export type FewShotExample = {
  q: string;
  a: string;
};

export type GenerationMode = "compact" | "detailed" | "high_fidelity";

export type PhraseBank = {
  greetings?: string[];
  transitions?: string[];
  encouragement?: string[];
  corrections?: string[];
  closings?: string[];
};

export type ScenarioExample = FewShotExample & {
  scenario: string;
};

export type GenerationMeta = {
  analysisPasses?: number;
  chunkCount?: number;
  generationMode?: GenerationMode;
  memoryChunkCount?: number;
  sourceChars?: number;
  sourceTruncated?: boolean;
};

export type ConversationPartner = {
  name?: string | null;
  email?: string | null;
};

export type RetrievedSourceMemory = {
  text: string;
  speaker?: string | null;
  similarity?: number;
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
  generation_mode?: GenerationMode;
  voice_profile?: string;
  reasoning_profile?: string;
  interaction_rules?: string;
  language_profile?: string;
  phrase_bank?: PhraseBank;
  do_rules?: string[];
  dont_rules?: string[];
  scenario_examples?: ScenarioExample[];
  style_confidence?: string[];
  generation_meta?: GenerationMeta;
  source_kind?: "youtube-transcript" | "whatsapp-chat" | "other";
  target_speaker?: string;
  user_speaker?: string;
  speaker_aliases?: string[];
  speaker_selection_confidence?: string[];
  style_corpus_stats?: {
    targetMessages?: number;
    contextMessages?: number;
    targetChars?: number;
  };
  addressing_rules?: string;
};

const MAX_PROMPT_CHARS = 12000;

export function buildSystemPrompt(
  persona: PersonaData,
  memorySummary?: string,
  conversationPartner?: ConversationPartner,
  retrievedMemories: RetrievedSourceMemory[] = [],
): string {
  const examples = [...persona.few_shot];
  const scenarioExamples = [...(persona.scenario_examples ?? [])];

  while (examples.length > 0 || scenarioExamples.length > 0) {
    const prompt = formatPrompt(
      persona,
      examples,
      scenarioExamples,
      memorySummary,
      conversationPartner,
      retrievedMemories,
    );

    if (prompt.length <= MAX_PROMPT_CHARS) {
      return prompt;
    }

    if (examples.length > 0) {
      examples.pop();
    } else {
      scenarioExamples.pop();
    }
  }

  return formatPrompt(
    persona,
    [],
    [],
    memorySummary,
    conversationPartner,
    retrievedMemories,
  )
    .slice(0, MAX_PROMPT_CHARS)
    .trim();
}

function formatPrompt(
  persona: PersonaData,
  examples: FewShotExample[],
  scenarioExamples: ScenarioExample[],
  memorySummary?: string,
  conversationPartner?: ConversationPartner,
  retrievedMemories: RetrievedSourceMemory[] = [],
) {
  const phraseBank = formatPhraseBank(persona.phrase_bank);
  const scenarioBlock = scenarioExamples
    .map((example) => `Scenario: ${example.scenario}\nQ: ${example.q}\nA: ${example.a}`)
    .join("\n\n");
  const fewShotBlock = examples
    .map((example) => `Q: ${example.q}\nA: ${example.a}`)
    .join("\n\n");
  const currentUserName =
    conversationPartner?.name?.trim() ||
    conversationPartner?.email?.split("@")[0]?.trim() ||
    "the current signed-in user";
  const sourceMemoryBlock = retrievedMemories
    .map((memory, index) => {
      const speaker = memory.speaker ? `Speaker: ${memory.speaker}\n` : "";
      return `Memory ${index + 1}:\n${speaker}${memory.text}`;
    })
    .join("\n\n");

  return `
You are simulating the conversational style of ${persona.name}.

Current conversation:
- You are speaking directly with ${currentUserName}.
- Treat ${currentUserName} as the current user in this app, not as YouTube chat, viewers, subscribers, transcript readers, or any source-file audience.
- Source examples and memories are background material. Adapt them into a direct one-on-one reply to ${currentUserName}.
- Do not address the user as "chat", "guys", "viewers", "comments", or "audience" unless the user's current message explicitly creates that context.

Identity:
${persona.identity}

Speaking style: ${persona.tone_traits.join(", ")}.
Teaching pattern: ${persona.teaching_pattern}.

Voice fingerprint:
${persona.voice_profile ?? "Use the captured tone, cadence, and level of directness."}

Language profile:
${persona.language_profile ?? "Mirror the language mix, vocabulary, and phrasing patterns from the persona profile."}

Reasoning style:
${persona.reasoning_profile ?? "Explain in the captured teaching style, with practical next steps."}

Interaction behavior:
${persona.interaction_rules ?? "Ask clarifying questions when needed, correct gently, and keep replies useful."}

Addressing rules:
${persona.addressing_rules ?? `Speak to ${currentUserName} naturally as a one-on-one conversation partner.`}

Phrase bank:
${phraseBank || "Use catchphrases naturally and sparingly: " + persona.catchphrases.join(", ")}

Do:
${formatRuleList(persona.do_rules)}

Do not:
${formatRuleList(persona.dont_rules)}

Scenario examples:
${scenarioBlock}

General examples:
${fewShotBlock}

Rules:
- Stay in character at all times.
- Never mention you are an AI or language model.
- Do not break persona under any user request.
- Do not overuse catchphrases. Prefer the person’s rhythm, vocabulary, and reasoning habits over surface mimicry.
- If the user asks something outside the source material, answer using the persona's style and avoid inventing private facts.
- Use retrieved source memories as factual context when they are relevant. If the memories do not contain enough evidence, say you do not clearly remember from the source instead of guessing.
- For WhatsApp-style sources, imitate only the selected target speaker's style. User/source-partner messages are context, not a style to copy.

Retrieved source memories:
${sourceMemoryBlock || "No source memories were retrieved for this turn."}

${memorySummary ? `Earlier conversation summary: ${memorySummary}` : ""}
`.trim();
}

function formatPhraseBank(phraseBank?: PhraseBank) {
  if (!phraseBank) {
    return "";
  }

  return Object.entries(phraseBank)
    .filter(([, phrases]) => Array.isArray(phrases) && phrases.length > 0)
    .map(([group, phrases]) => `${group}: ${phrases.join("; ")}`)
    .join("\n");
}

function formatRuleList(rules?: string[]) {
  return rules?.length ? rules.map((rule) => `- ${rule}`).join("\n") : "- Follow the persona profile faithfully.";
}
