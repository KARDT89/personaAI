import { and, desc, eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth-utils";
import { learningMessages, learningSessions, learningSources } from "@/lib/db/schema";

export async function GET(
  req: Request,
  context: { params: Promise<unknown> },
) {
  const user = await requireUser(req);

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const sourceId = getSourceId(await context.params);

  if (!sourceId) {
    return Response.json({ error: "Invalid source id." }, { status: 400 });
  }

  const { db } = await import("@/lib/db");
  const source = await findOwnedSource(sourceId, user.id);

  if (!source) {
    return Response.json({ error: "Learning source not found." }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(learningSessions)
    .where(and(eq(learningSessions.sourceId, sourceId), eq(learningSessions.userId, user.id)))
    .orderBy(desc(learningSessions.updatedAt));
  const previews = await Promise.all(
    rows.map(async (session) => {
      const [latestMessage] = await db
        .select({ content: learningMessages.content })
        .from(learningMessages)
        .where(eq(learningMessages.sessionId, session.id))
        .orderBy(desc(learningMessages.createdAt))
        .limit(1);

      return [session.id, buildPreview(latestMessage?.content)] as const;
    }),
  );
  const previewBySessionId = new Map(previews);

  return Response.json({
    sessions: rows
      .filter((session) => session.title !== "New chat" || Boolean(previewBySessionId.get(session.id)))
      .map((session) => ({
        id: session.id,
        title: session.title,
        preview: previewBySessionId.get(session.id) ?? null,
        sourceId: session.sourceId,
        createdAt: session.createdAt?.toISOString() ?? null,
        updatedAt: session.updatedAt?.toISOString() ?? null,
      })),
  });
}

export async function POST(
  req: Request,
  context: { params: Promise<unknown> },
) {
  const user = await requireUser(req);

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const sourceId = getSourceId(await context.params);

  if (!sourceId) {
    return Response.json({ error: "Invalid source id." }, { status: 400 });
  }

  const source = await findOwnedSource(sourceId, user.id);

  if (!source) {
    return Response.json({ error: "Learning source not found." }, { status: 404 });
  }

  const { db } = await import("@/lib/db");
  const now = new Date();
  const [session] = await db
    .insert(learningSessions)
    .values({
      sourceId,
      userId: user.id,
      title: "New chat",
      updatedAt: now,
    })
    .returning();

  return Response.json({
    session: {
      id: session.id,
      title: session.title,
      preview: null,
      sourceId: session.sourceId,
      createdAt: session.createdAt?.toISOString() ?? null,
      updatedAt: session.updatedAt?.toISOString() ?? null,
    },
  });
}

async function findOwnedSource(sourceId: string, userId: string) {
  const { db } = await import("@/lib/db");
  const [source] = await db
    .select({ id: learningSources.id })
    .from(learningSources)
    .where(and(eq(learningSources.id, sourceId), eq(learningSources.userId, userId)))
    .limit(1);

  return source;
}

function getSourceId(params: unknown) {
  const id = (params as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

function buildPreview(content?: string | null) {
  const preview = content?.replace(/\s+/g, " ").trim();

  if (!preview) {
    return null;
  }

  return preview.length > 96 ? `${preview.slice(0, 93)}...` : preview;
}
