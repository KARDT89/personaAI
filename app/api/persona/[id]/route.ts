import { and, eq, inArray } from "drizzle-orm";

import { requireUser } from "@/lib/auth-utils";
import { messages, personas, sessions } from "@/lib/db/schema";
import { buildSystemPrompt } from "@/lib/personas";
import { sanitizePersonaData } from "@/lib/personas/validation";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const persona =
    typeof body === "object" && body !== null && "persona" in body
      ? sanitizePersonaData((body as { persona: unknown }).persona)
      : null;

  if (!persona) {
    return Response.json({ error: "Invalid persona draft." }, { status: 400 });
  }

  const { id } = await context.params;
  const { db } = await import("@/lib/db");
  const [updatedPersona] = await db
    .update(personas)
    .set({
      name: persona.name,
      systemPrompt: buildSystemPrompt(persona),
      personaJson: persona,
      avatarUrl: persona.avatar_url ?? null,
      tagline: persona.tagline ?? null,
      bio: persona.bio ?? persona.identity,
      topicsJson: persona.topics ?? [],
      starterPromptsJson: persona.starter_prompts ?? [],
      sourceCount: persona.source_count ?? 1,
    })
    .where(
      and(
        eq(personas.id, id),
        eq(personas.ownerUserId, user.id),
        eq(personas.isBuiltIn, false),
      ),
    )
    .returning();

  if (!updatedPersona) {
    return Response.json({ error: "Persona not found." }, { status: 404 });
  }

  return Response.json({ persona: toPersonaSummary(updatedPersona) });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req);

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const { db } = await import("@/lib/db");

  const [persona] = await db
    .select({ id: personas.id })
    .from(personas)
    .where(
      and(
        eq(personas.id, id),
        eq(personas.ownerUserId, user.id),
        eq(personas.isBuiltIn, false),
      ),
    )
    .limit(1);

  if (!persona) {
    return Response.json({ error: "Persona not found." }, { status: 404 });
  }

  const ownedSessions = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.personaId, id), eq(sessions.userId, user.id)));

  const sessionIds = ownedSessions.map((session) => session.id);

  if (sessionIds.length > 0) {
    await db.delete(messages).where(inArray(messages.sessionId, sessionIds));
    await db.delete(sessions).where(inArray(sessions.id, sessionIds));
  }

  await db
    .delete(personas)
    .where(
      and(
        eq(personas.id, id),
        eq(personas.ownerUserId, user.id),
        eq(personas.isBuiltIn, false),
      ),
    );

  return Response.json({ ok: true });
}

function toPersonaSummary(persona: typeof personas.$inferSelect) {
  return {
    id: persona.id,
    name: persona.name,
    avatarUrl: persona.avatarUrl,
    tagline: persona.tagline,
    bio: persona.bio,
    topics: persona.topicsJson ?? [],
    starterPrompts: persona.starterPromptsJson ?? [],
    isBuiltIn: persona.isBuiltIn,
    sourceCount: persona.sourceCount,
    personaData: persona.personaJson ?? undefined,
  };
}
