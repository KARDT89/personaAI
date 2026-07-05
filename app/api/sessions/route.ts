import { and, desc, eq, or } from "drizzle-orm";

import { requireUser } from "@/lib/auth-utils";
import { messages, personas, sessions } from "@/lib/db/schema";

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
  const previews = await Promise.all(
    rows.map(async (session) => {
      const [latestMessage] = await db
        .select({
          content: messages.content,
        })
        .from(messages)
        .where(eq(messages.sessionId, session.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      return [session.id, buildPreview(latestMessage?.content)] as const;
    }),
  );
  const previewBySessionId = new Map(previews);
  const visibleRows = rows.filter((session) => {
    const preview = previewBySessionId.get(session.id);

    return session.title !== "New chat" || Boolean(preview);
  });

  return Response.json({
    sessions: visibleRows.map((session) => ({
      id: session.id,
      title: session.title,
      preview: previewBySessionId.get(session.id) ?? null,
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

function buildPreview(content?: string | null) {
  const preview = content?.replace(/\s+/g, " ").trim();

  if (!preview) {
    return null;
  }

  return preview.length > 96 ? `${preview.slice(0, 93)}…` : preview;
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
