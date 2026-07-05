import hitesh from "./hitesh.json";
import piyush from "./piyush.json";
import {
  buildSystemPrompt,
  type GenerationMeta,
  type GenerationMode,
  type PersonaData,
} from "./promptBuilder";

const personas = {
  hitesh: hitesh as PersonaData,
  piyush: piyush as PersonaData,
} as const;

export type PersonaId = keyof typeof personas;

export type PersonaSummary = {
  id: string;
  name: string;
  avatarUrl: string | null;
  tagline: string | null;
  bio: string | null;
  topics: string[];
  starterPrompts: string[];
  isBuiltIn: boolean;
  sourceCount: number;
  personaData?: PersonaData;
};

export function isPersonaId(value: unknown): value is PersonaId {
  return typeof value === "string" && value in personas;
}

export function getPersonaData(personaId: PersonaId): PersonaData {
  return personas[personaId];
}

export function getAvailablePersonas(): PersonaSummary[] {
  return Object.values(personas).map((persona) => ({
    id: persona.persona_id,
    name: persona.name,
    avatarUrl: persona.avatar_url ?? null,
    tagline: persona.tagline ?? null,
    bio: persona.bio ?? persona.identity,
    topics: persona.topics ?? [],
    starterPrompts: persona.starter_prompts ?? [],
    isBuiltIn: true,
    sourceCount: persona.source_count ?? 0,
    personaData: persona,
  }));
}

export function buildPersonaRecord(personaId: PersonaId) {
  const persona = getPersonaData(personaId);

  return {
    id: persona.persona_id,
    name: persona.name,
    systemPrompt: buildSystemPrompt(persona),
    personaJson: persona,
    ownerUserId: null,
    isBuiltIn: true,
    avatarUrl: persona.avatar_url ?? null,
    tagline: persona.tagline ?? null,
    bio: persona.bio ?? persona.identity,
    topicsJson: persona.topics ?? [],
    starterPromptsJson: persona.starter_prompts ?? [],
    sourceCount: persona.source_count ?? 0,
  };
}

export { buildSystemPrompt };
export type { GenerationMeta, GenerationMode, PersonaData };
