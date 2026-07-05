import { and, asc, desc, eq, or } from "drizzle-orm";

import { requireUser } from "@/lib/auth-utils";
import { sessions } from "@/lib/db/schema";
import { personas } from "@/lib/db/schema";

export async function GET(req: Request) {
  const user = await requireUser(req);

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { db } = await import("@/lib/db");
  const rows = await db
    .select()
    .from(personas)
    .where(or(eq(personas.isBuiltIn, true), eq(personas.ownerUserId, user.id)))
    .orderBy(desc(personas.isBuiltIn), asc(personas.name));

  return Response.json({
    personas: rows.map(toPersonaSummary),
  });
}

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

  const personaId =
    typeof body === "object" && body !== null && "personaId" in body
      ? body.personaId
      : undefined;

  if (typeof personaId !== "string") {
    return Response.json({ error: "Invalid personaId." }, { status: 400 });
  }

  const { db } = await import("@/lib/db");
  const [persona] = await db
    .select()
    .from(personas)
    .where(
      and(
        eq(personas.id, personaId),
        or(eq(personas.isBuiltIn, true), eq(personas.ownerUserId, user.id)),
      ),
    )
    .limit(1);

  if (!persona) {
    return Response.json({ error: "Persona not found." }, { status: 404 });
  }

  const [session] = await db
    .insert(sessions)
    .values({ personaId, userId: user.id, title: "New chat", updatedAt: new Date() })
    .returning({ id: sessions.id });

  return Response.json({
    sessionId: session.id,
    persona: toPersonaSummary(persona),
  });
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
