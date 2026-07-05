import { requireUser } from "@/lib/auth-utils";
import { personas } from "@/lib/db/schema";
import { buildSystemPrompt, type PersonaData } from "@/lib/personas";

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

  const id = `custom-${crypto.randomUUID()}`;
  const { db } = await import("@/lib/db");
  const [savedPersona] = await db
    .insert(personas)
    .values({
      id,
      name: persona.name,
      systemPrompt: buildSystemPrompt(persona),
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
    },
  });
}

function parsePersona(body: unknown): PersonaData | null {
  if (typeof body !== "object" || body === null || !("persona" in body)) {
    return null;
  }

  const persona = (body as { persona: unknown }).persona as Partial<PersonaData>;

  if (
    typeof persona.name !== "string" ||
    typeof persona.identity !== "string" ||
    !Array.isArray(persona.tone_traits) ||
    !Array.isArray(persona.catchphrases) ||
    !Array.isArray(persona.few_shot)
  ) {
    return null;
  }

  return {
    persona_id: persona.persona_id ?? "custom",
    name: persona.name,
    avatar_url: persona.avatar_url,
    tagline: persona.tagline,
    bio: persona.bio,
    identity: persona.identity,
    catchphrases: persona.catchphrases,
    tone_traits: persona.tone_traits,
    teaching_pattern:
      persona.teaching_pattern ??
      "understand the question -> answer in style -> give a practical next step",
    topics: persona.topics ?? [],
    starter_prompts: persona.starter_prompts ?? [],
    few_shot: persona.few_shot,
    source_count: persona.source_count ?? 1,
  };
}
