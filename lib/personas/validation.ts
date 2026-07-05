import type {
  FewShotExample,
  GenerationMode,
  GenerationMeta,
  PersonaData,
  PhraseBank,
  ScenarioExample,
} from "./promptBuilder";

const MAX_ARRAY_ITEMS = 12;
const MAX_FEW_SHOT = 8;
const MAX_SCENARIO_EXAMPLES = 10;

export function sanitizePersonaData(input: unknown): PersonaData | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const value = input as Partial<PersonaData>;

  if (typeof value.name !== "string" || typeof value.identity !== "string") {
    return null;
  }

  const name = cleanText(value.name, 80);
  const identity = cleanText(value.identity, 1800);

  if (name.length < 2 || identity.length < 10) {
    return null;
  }

  return {
    persona_id: cleanText(value.persona_id ?? slugify(name), 80) || slugify(name),
    name,
    avatar_url:
      typeof value.avatar_url === "string"
        ? cleanText(value.avatar_url, 300)
        : undefined,
    tagline:
      typeof value.tagline === "string" ? cleanText(value.tagline, 120) : undefined,
    bio: typeof value.bio === "string" ? cleanText(value.bio, 700) : undefined,
    identity,
    catchphrases: cleanStringArray(value.catchphrases, 18, 120),
    tone_traits: cleanStringArray(value.tone_traits, 18, 140),
    teaching_pattern:
      typeof value.teaching_pattern === "string"
        ? cleanText(value.teaching_pattern, 700)
        : "understand the question -> answer in style -> give a practical next step",
    topics: cleanStringArray(value.topics, 18, 80),
    starter_prompts: cleanStringArray(value.starter_prompts, 6, 160),
    few_shot: cleanFewShot(value.few_shot),
    generation_mode: cleanGenerationMode(value.generation_mode),
    voice_profile:
      typeof value.voice_profile === "string" ? cleanText(value.voice_profile, 1800) : undefined,
    reasoning_profile:
      typeof value.reasoning_profile === "string"
        ? cleanText(value.reasoning_profile, 1800)
        : undefined,
    interaction_rules:
      typeof value.interaction_rules === "string"
        ? cleanText(value.interaction_rules, 1800)
        : undefined,
    language_profile:
      typeof value.language_profile === "string"
        ? cleanText(value.language_profile, 1400)
        : undefined,
    phrase_bank: cleanPhraseBank(value.phrase_bank),
    do_rules: cleanStringArray(value.do_rules, 16, 180),
    dont_rules: cleanStringArray(value.dont_rules, 16, 180),
    scenario_examples: cleanScenarioExamples(value.scenario_examples),
    style_confidence: cleanStringArray(value.style_confidence, 12, 220),
    generation_meta: cleanGenerationMeta(value.generation_meta),
    source_kind: cleanSourceKind(value.source_kind),
    target_speaker:
      typeof value.target_speaker === "string"
        ? cleanText(value.target_speaker, 120)
        : undefined,
    user_speaker:
      typeof value.user_speaker === "string" ? cleanText(value.user_speaker, 120) : undefined,
    speaker_aliases: cleanStringArray(value.speaker_aliases, 8, 120),
    speaker_selection_confidence: cleanStringArray(
      value.speaker_selection_confidence,
      8,
      220,
    ),
    style_corpus_stats: cleanStyleCorpusStats(value.style_corpus_stats),
    addressing_rules:
      typeof value.addressing_rules === "string"
        ? cleanText(value.addressing_rules, 900)
        : undefined,
    source_count:
      typeof value.source_count === "number" && Number.isFinite(value.source_count)
        ? Math.max(0, Math.min(999, Math.round(value.source_count)))
        : 1,
  };
}

function cleanGenerationMeta(value: unknown): GenerationMeta | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const meta = value as Partial<GenerationMeta>;

  return {
    analysisPasses:
      typeof meta.analysisPasses === "number" && Number.isFinite(meta.analysisPasses)
        ? Math.max(0, Math.min(20, Math.round(meta.analysisPasses)))
        : undefined,
    chunkCount:
      typeof meta.chunkCount === "number" && Number.isFinite(meta.chunkCount)
        ? Math.max(0, Math.min(20, Math.round(meta.chunkCount)))
        : undefined,
    generationMode: cleanGenerationMode(meta.generationMode),
    memoryChunkCount:
      typeof meta.memoryChunkCount === "number" && Number.isFinite(meta.memoryChunkCount)
        ? Math.max(0, Math.min(200, Math.round(meta.memoryChunkCount)))
        : undefined,
    sourceChars:
      typeof meta.sourceChars === "number" && Number.isFinite(meta.sourceChars)
        ? Math.max(0, Math.min(1000000, Math.round(meta.sourceChars)))
        : undefined,
    sourceTruncated: typeof meta.sourceTruncated === "boolean" ? meta.sourceTruncated : undefined,
  };
}

function cleanGenerationMode(value: unknown): GenerationMode | undefined {
  return value === "compact" || value === "detailed" || value === "high_fidelity"
    ? value
    : undefined;
}

function cleanSourceKind(value: unknown): PersonaData["source_kind"] {
  return value === "youtube-transcript" || value === "whatsapp-chat" || value === "other"
    ? value
    : undefined;
}

function cleanStyleCorpusStats(value: unknown): PersonaData["style_corpus_stats"] {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const stats = value as NonNullable<PersonaData["style_corpus_stats"]>;

  return {
    targetMessages: cleanOptionalNumber(stats.targetMessages, 100000),
    contextMessages: cleanOptionalNumber(stats.contextMessages, 100000),
    targetChars: cleanOptionalNumber(stats.targetChars, 1000000),
  };
}

function cleanOptionalNumber(value: unknown, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(max, Math.round(value)))
    : undefined;
}

function cleanPhraseBank(value: unknown): PhraseBank | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const bank = value as Partial<Record<keyof PhraseBank, unknown>>;
  const cleaned: PhraseBank = {
    greetings: cleanStringArray(bank.greetings, 10, 120),
    transitions: cleanStringArray(bank.transitions, 14, 140),
    encouragement: cleanStringArray(bank.encouragement, 12, 140),
    corrections: cleanStringArray(bank.corrections, 12, 160),
    closings: cleanStringArray(bank.closings, 10, 140),
  };

  return Object.values(cleaned).some((phrases) => phrases && phrases.length > 0)
    ? cleaned
    : undefined;
}

export function cleanStringArray(
  value: unknown,
  maxItems = MAX_ARRAY_ITEMS,
  maxLength = 120,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function cleanText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || crypto.randomUUID()
  );
}

function cleanFewShot(value: unknown): FewShotExample[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const example = item as Partial<FewShotExample>;

      if (typeof example.q !== "string" || typeof example.a !== "string") {
        return null;
      }

      const q = cleanText(example.q, 240);
      const a = cleanText(example.a, 1200);

      return q && a ? { q, a } : null;
    })
    .filter((item): item is FewShotExample => Boolean(item))
    .slice(0, MAX_FEW_SHOT);
}

function cleanScenarioExamples(value: unknown): ScenarioExample[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const example = item as Partial<ScenarioExample>;

      if (
        typeof example.scenario !== "string" ||
        typeof example.q !== "string" ||
        typeof example.a !== "string"
      ) {
        return null;
      }

      const scenario = cleanText(example.scenario, 120);
      const q = cleanText(example.q, 260);
      const a = cleanText(example.a, 1400);

      return scenario && q && a ? { scenario, q, a } : null;
    })
    .filter((item): item is ScenarioExample => Boolean(item))
    .slice(0, MAX_SCENARIO_EXAMPLES);
}
