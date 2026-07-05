import { and, asc, eq, or } from "drizzle-orm";

import { requireUser } from "@/lib/auth-utils";
import { messages, personas, sessions } from "@/lib/db/schema";

export async function GET(
  req: Request,
  context: { params: Promise<unknown> },
) {
  const user = await requireUser(req);

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const params = (await context.params) as { id?: unknown };
  const id = typeof params.id === "string" ? params.id : null;

  if (!id) {
    return Response.json({ error: "Invalid session id." }, { status: 400 });
  }

  const { db } = await import("@/lib/db");
  const [session] = await db
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
        eq(sessions.id, id),
        eq(sessions.userId, user.id),
        or(eq(personas.isBuiltIn, true), eq(personas.ownerUserId, user.id)),
      ),
    )
    .limit(1);

  if (!session) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  const rows = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.sessionId, id))
    .orderBy(asc(messages.createdAt));

  return Response.json({
    session: {
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
    },
    messages: rows
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt?.toISOString() ?? null,
      })),
  });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<unknown> },
) {
  const user = await requireUser(req);

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const params = (await context.params) as { id?: unknown };
  const id = typeof params.id === "string" ? params.id : null;

  if (!id) {
    return Response.json({ error: "Invalid session id." }, { status: 400 });
  }

  const { db } = await import("@/lib/db");
  const [deletedSession] = await db
    .delete(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.userId, user.id)))
    .returning({ id: sessions.id });

  if (!deletedSession) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
