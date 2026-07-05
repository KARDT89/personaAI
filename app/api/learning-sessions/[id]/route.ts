import { and, asc, eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth-utils";
import { learningMessages, learningSessions } from "@/lib/db/schema";

export async function GET(
  req: Request,
  context: { params: Promise<unknown> },
) {
  const user = await requireUser(req);

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const id = getSessionId(await context.params);

  if (!id) {
    return Response.json({ error: "Invalid session id." }, { status: 400 });
  }

  const { db } = await import("@/lib/db");
  const [session] = await db
    .select()
    .from(learningSessions)
    .where(and(eq(learningSessions.id, id), eq(learningSessions.userId, user.id)))
    .limit(1);

  if (!session) {
    return Response.json({ error: "Learning session not found." }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(learningMessages)
    .where(eq(learningMessages.sessionId, id))
    .orderBy(asc(learningMessages.createdAt));

  return Response.json({
    session: {
      id: session.id,
      title: session.title,
      sourceId: session.sourceId,
      createdAt: session.createdAt?.toISOString() ?? null,
      updatedAt: session.updatedAt?.toISOString() ?? null,
    },
    messages: rows
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        citations: message.citationsJson ?? [],
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

  const id = getSessionId(await context.params);

  if (!id) {
    return Response.json({ error: "Invalid session id." }, { status: 400 });
  }

  const { db } = await import("@/lib/db");
  const [deletedSession] = await db
    .delete(learningSessions)
    .where(and(eq(learningSessions.id, id), eq(learningSessions.userId, user.id)))
    .returning({ id: learningSessions.id });

  if (!deletedSession) {
    return Response.json({ error: "Learning session not found." }, { status: 404 });
  }

  return Response.json({ ok: true });
}

function getSessionId(params: unknown) {
  const id = (params as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}
