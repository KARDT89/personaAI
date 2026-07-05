import { requireUser } from "@/lib/auth-utils";
import { personas } from "@/lib/db/schema";
import { buildSystemPrompt, type PersonaData } from "@/lib/personas";
import {
  cleanSourceMemoryPayload,
  storePersonaSourceMemory,
} from "@/lib/personas/sourceMemory";
import { sanitizePersonaData } from "@/lib/personas/validation";

export async function POST(req: Request) {
  const user = await requireUser(req);

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const persona = parsePersona(body);

  if (!persona) {
    return Response.json({ error: "Invalid persona draft." }, { status: 400 });
  }

  const sourceMemory = parseSourceMemory(body);
  const apiKey = parseApiKey(body);

  const id = `custom-${crypto.randomUUID()}`;
  const { db } = await import("@/lib/db");
  const [savedPersona] = await db
    .insert(personas)
    .values({
      id,
      name: persona.name,
      systemPrompt: buildSystemPrompt(persona),
      personaJson: persona,
      ownerUserId: user.id,
      isBuiltIn: false,
      avatarUrl: persona.avatar_url ?? null,
      tagline: persona.tagline ?? null,
      bio: persona.bio ?? persona.identity,
      topicsJson: persona.topics ?? [],
      starterPromptsJson: persona.starter_prompts ?? [],
      sourceCount: persona.source_count ?? 1,
    })
    .returning();

  if (sourceMemory) {
    await storePersonaSourceMemory({
      apiKey,
      memory: sourceMemory,
      personaId: savedPersona.id,
      userId: user.id,
    });
  }

  return Response.json({
    persona: {
      id: savedPersona.id,
      name: savedPersona.name,
      avatarUrl: savedPersona.avatarUrl,
      tagline: savedPersona.tagline,
      bio: savedPersona.bio,
      topics: savedPersona.topicsJson ?? [],
      starterPrompts: savedPersona.starterPromptsJson ?? [],
      isBuiltIn: savedPersona.isBuiltIn,
      sourceCount: savedPersona.sourceCount,
      personaData: savedPersona.personaJson ?? undefined,
    },
  });
}

function parsePersona(body: unknown): PersonaData | null {
  if (typeof body !== "object" || body === null || !("persona" in body)) {
    return null;
  }

  return sanitizePersonaData((body as { persona: unknown }).persona);
}

function parseSourceMemory(body: unknown) {
  if (typeof body !== "object" || body === null || !("sourceMemory" in body)) {
    return null;
  }

  return cleanSourceMemoryPayload((body as { sourceMemory: unknown }).sourceMemory);
}

function parseApiKey(body: unknown) {
  if (typeof body !== "object" || body === null || !("apiKey" in body)) {
    return undefined;
  }

  const apiKey = (body as { apiKey?: unknown }).apiKey;
  return typeof apiKey === "string" ? apiKey.trim() || undefined : undefined;
}
