import { and, desc, eq, or } from "drizzle-orm";

import { requireUser } from "@/lib/auth-utils";
import { personas, sessions } from "@/lib/db/schema";

export async function GET(req: Request) {
  const user = await requireUser(req);

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { db } = await import("@/lib/db");
  const rows = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      personaId: sessions.personaId,
      createdAt: sessions.createdAt,
      updatedAt: sessions.updatedAt,
      personaName: personas.name,
      personaAvatarUrl: personas.avatarUrl,
      personaTagline: personas.tagline,
      personaIsBuiltIn: personas.isBuiltIn,
    })
    .from(sessions)
    .innerJoin(personas, eq(sessions.personaId, personas.id))
    .where(
      and(
        eq(sessions.userId, user.id),
        or(eq(personas.isBuiltIn, true), eq(personas.ownerUserId, user.id)),
      ),
    )
    .orderBy(desc(sessions.updatedAt));

  return Response.json({
    sessions: rows.map((session) => ({
      id: session.id,
      title: session.title,
      personaId: session.personaId,
      createdAt: session.createdAt?.toISOString() ?? null,
      updatedAt: session.updatedAt?.toISOString() ?? null,
      persona: {
        id: session.personaId,
        name: session.personaName,
        avatarUrl: session.personaAvatarUrl,
        tagline: session.personaTagline,
        isBuiltIn: session.personaIsBuiltIn,
      },
    })),
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
    .select({ id: personas.id })
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

  const now = new Date();
  const [session] = await db
    .insert(sessions)
    .values({
      personaId,
      userId: user.id,
      title: "New chat",
      updatedAt: now,
    })
    .returning();

  return Response.json({
    session: {
      id: session.id,
      title: session.title,
      personaId: session.personaId,
      createdAt: session.createdAt?.toISOString() ?? null,
      updatedAt: session.updatedAt?.toISOString() ?? null,
    },
  });
}
