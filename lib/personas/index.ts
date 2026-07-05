import hitesh from "./hitesh.json";
import piyush from "./piyush.json";
import { buildSystemPrompt, type PersonaData } from "./promptBuilder";

const personas = {
  hitesh: hitesh as PersonaData,
  piyush: piyush as PersonaData,
} as const;

export type PersonaId = keyof typeof personas;

export type PersonaSummary = {
  id: PersonaId;
  name: string;
};

export function isPersonaId(value: unknown): value is PersonaId {
  return typeof value === "string" && value in personas;
}

export function getPersonaData(personaId: PersonaId): PersonaData {
  return personas[personaId];
}

export function getAvailablePersonas(): PersonaSummary[] {
  return Object.values(personas).map((persona) => ({
    id: persona.persona_id as PersonaId,
    name: persona.name,
  }));
}

export function buildPersonaRecord(personaId: PersonaId) {
  const persona = getPersonaData(personaId);

  return {
    id: persona.persona_id,
    name: persona.name,
    systemPrompt: buildSystemPrompt(persona),
  };
}

export { buildSystemPrompt };
export type { PersonaData };
