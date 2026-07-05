import { and, asc, desc, eq, or } from "drizzle-orm";

import { requireUser } from "@/lib/auth-utils";
import { messages, personas, sessions } from "@/lib/db/schema";
import {
  createChatCompletion,
  createChatCompletionText,
  type LlmMessage,
} from "@/lib/llm/client";

const RECENT_MESSAGE_LIMIT = 12;
const SUMMARY_TRIGGER_COUNT = 20;

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

  const input = parseChatRequest(body);

  if (!input) {
    return Response.json(
      { error: "sessionId, personaId, and message are required." },
      { status: 400 },
    );
  }

  const session = await getSession(input.sessionId, input.personaId, user.id);

  if (!session) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  const persona = await getPersona(input.personaId, user.id);

  if (!persona) {
    return Response.json({ error: "Persona not found." }, { status: 404 });
  }

  const history = await getRecentMessages(input.sessionId);
  const systemPrompt = session.memorySummary
    ? `${persona.systemPrompt}\n\nEarlier conversation summary: ${session.memorySummary}`
    : persona.systemPrompt;

  const { db } = await import("@/lib/db");

  await db.insert(messages).values({
    sessionId: input.sessionId,
    role: "user",
    content: input.message,
  });
  await db
    .update(sessions)
    .set({
      title:
        session.title === "New chat"
          ? buildSessionTitle(input.message)
          : session.title,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, input.sessionId));

  let llmResponse: Response;

  try {
    llmResponse = await createChatCompletion({
      apiKey: input.apiKey,
      model: input.model,
      system: systemPrompt,
      messages: [...history, { role: "user", content: input.message }],
      stream: true,
      maxTokens: 1024,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create chat completion.",
      },
      { status: 500 },
    );
  }

  if (!llmResponse.body) {
    return Response.json(
      { error: "OpenRouter returned an empty stream." },
      { status: 500 },
    );
  }

  const stream = streamAssistantText(llmResponse.body, input.sessionId);

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function buildSessionTitle(message: string) {
  const title = message.replace(/\s+/g, " ").trim();

  return title.length > 64 ? `${title.slice(0, 61)}…` : title || "New chat";
}

function parseChatRequest(body: unknown) {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const payload = body as Record<string, unknown>;

  if (
    typeof payload.sessionId !== "string" ||
    typeof payload.personaId !== "string" ||
    typeof payload.message !== "string" ||
    payload.message.trim().length === 0
  ) {
    return null;
  }

  return {
    sessionId: payload.sessionId,
    personaId: payload.personaId,
    message: payload.message.trim(),
    apiKey:
      typeof payload.apiKey === "string" ? payload.apiKey.trim() || undefined : undefined,
    model:
      typeof payload.model === "string" ? payload.model.trim() || undefined : undefined,
  };
}

async function getSession(sessionId: string, personaId: string, userId: string) {
  const { db } = await import("@/lib/db");
  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.personaId, personaId),
        eq(sessions.userId, userId),
      ),
    )
    .limit(1);

  return session;
}

async function getPersona(personaId: string, userId: string) {
  const { db } = await import("@/lib/db");
  const [persona] = await db
    .select()
    .from(personas)
    .where(
      and(
        eq(personas.id, personaId),
        or(eq(personas.isBuiltIn, true), eq(personas.ownerUserId, userId)),
      ),
    )
    .limit(1);

  return persona;
}

async function getRecentMessages(sessionId: string): Promise<LlmMessage[]> {
  const { db } = await import("@/lib/db");
  const rows = await db
    .select({
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(desc(messages.createdAt))
    .limit(RECENT_MESSAGE_LIMIT);

  return rows.reverse().reduce<LlmMessage[]>((history, message) => {
    if (!isLlmRole(message.role)) {
      return history;
    }

    history.push({
      role: message.role,
      content: message.content,
    });

    return history;
  }, []);
}

function streamAssistantText(
  responseBody: ReadableStream<Uint8Array>,
  sessionId: string,
) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = responseBody.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";
      let assistantText = "";

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const text = parseStreamLine(line);

            if (!text) {
              continue;
            }

            assistantText += text;
            controller.enqueue(encoder.encode(text));
          }
        }

        if (assistantText.trim()) {
          const { db } = await import("@/lib/db");
          await db.insert(messages).values({
            sessionId,
            role: "assistant",
            content: assistantText,
          });
          await db
            .update(sessions)
            .set({ updatedAt: new Date() })
            .where(eq(sessions.id, sessionId));
          await refreshMemorySummary(sessionId).catch((error) => {
            console.error("Failed to refresh memory summary.", error);
          });
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

function parseStreamLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed.startsWith("data:")) {
    return "";
  }

  const data = trimmed.slice("data:".length).trim();

  if (!data || data === "[DONE]") {
    return "";
  }

  try {
    const parsed = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };

    return parsed.choices?.[0]?.delta?.content ?? "";
  } catch {
    return "";
  }
}

async function refreshMemorySummary(sessionId: string) {
  const { db } = await import("@/lib/db");
  const rows = await db
    .select({
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt));

  if (rows.length <= SUMMARY_TRIGGER_COUNT) {
    return;
  }

  const olderMessages = rows
    .slice(0, -RECENT_MESSAGE_LIMIT)
    .filter((message) => isLlmRole(message.role));

  if (olderMessages.length === 0) {
    return;
  }

  const transcript = olderMessages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  const summary = await createChatCompletionText({
    model: process.env.OPENROUTER_SUMMARY_MODEL,
    maxTokens: 220,
    messages: [
      {
        role: "user",
        content: `Summarize this earlier conversation in one concise paragraph. Preserve user goals, technical decisions, unresolved questions, and persona-relevant preferences.\n\n${transcript}`,
      },
    ],
  });

  if (!summary) {
    return;
  }

  await db
    .update(sessions)
    .set({ memorySummary: summary })
    .where(eq(sessions.id, sessionId));
}

function isLlmRole(role: string): role is "user" | "assistant" {
  return role === "user" || role === "assistant";
}
