import type { FewShotExample, PersonaData } from "./promptBuilder";

const MAX_ARRAY_ITEMS = 12;
const MAX_FEW_SHOT = 8;

export function sanitizePersonaData(input: unknown): PersonaData | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const value = input as Partial<PersonaData>;

  if (typeof value.name !== "string" || typeof value.identity !== "string") {
    return null;
  }

  const name = cleanText(value.name, 80);
  const identity = cleanText(value.identity, 900);

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
    bio: typeof value.bio === "string" ? cleanText(value.bio, 280) : undefined,
    identity,
    catchphrases: cleanStringArray(value.catchphrases, MAX_ARRAY_ITEMS, 80),
    tone_traits: cleanStringArray(value.tone_traits, MAX_ARRAY_ITEMS, 100),
    teaching_pattern:
      typeof value.teaching_pattern === "string"
        ? cleanText(value.teaching_pattern, 400)
        : "understand the question -> answer in style -> give a practical next step",
    topics: cleanStringArray(value.topics, MAX_ARRAY_ITEMS, 60),
    starter_prompts: cleanStringArray(value.starter_prompts, 4, 120),
    few_shot: cleanFewShot(value.few_shot),
    source_count:
      typeof value.source_count === "number" && Number.isFinite(value.source_count)
        ? Math.max(0, Math.min(999, Math.round(value.source_count)))
        : 1,
  };
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
      const a = cleanText(example.a, 700);

      return q && a ? { q, a } : null;
    })
    .filter((item): item is FewShotExample => Boolean(item))
    .slice(0, MAX_FEW_SHOT);
}
