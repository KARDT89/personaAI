import { and, desc, eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth-utils";
import { learningMessages, learningSessions, learningSources } from "@/lib/db/schema";
import {
  buildLearningCitationList,
  buildLearningSystemPrompt,
  retrieveLearningChunks,
} from "@/lib/learning/sources";
import { createChatCompletion, type LlmMessage } from "@/lib/llm/client";

const RECENT_MESSAGE_LIMIT = 10;

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

  const input = parseLearningChatRequest(body);

  if (!input) {
    return Response.json(
      { error: "sourceId, sessionId, and message are required." },
      { status: 400 },
    );
  }

  const { db } = await import("@/lib/db");
  const [source] = await db
    .select()
    .from(learningSources)
    .where(and(eq(learningSources.id, input.sourceId), eq(learningSources.userId, user.id)))
    .limit(1);

  if (!source) {
    return Response.json({ error: "Learning source not found." }, { status: 404 });
  }

  const [session] = await db
    .select()
    .from(learningSessions)
    .where(
      and(
        eq(learningSessions.id, input.sessionId),
        eq(learningSessions.sourceId, input.sourceId),
        eq(learningSessions.userId, user.id),
      ),
    )
    .limit(1);

  if (!session) {
    return Response.json({ error: "Learning session not found." }, { status: 404 });
  }

  const history = await getRecentMessages(input.sessionId);
  const retrievedChunks = await retrieveLearningChunks({
    apiKey: input.apiKey,
    query: input.message,
    sourceId: input.sourceId,
    userId: user.id,
  });
  const citations = buildLearningCitationList(retrievedChunks);
  const systemPrompt = buildLearningSystemPrompt({
    chunks: retrievedChunks,
    source,
    userName: user.name,
  });

  await db.insert(learningMessages).values({
    sessionId: input.sessionId,
    role: "user",
    content: input.message,
  });
  await db
    .update(learningSessions)
    .set({
      title: session.title === "New chat" ? buildSessionTitle(input.message) : session.title,
      updatedAt: new Date(),
    })
    .where(eq(learningSessions.id, input.sessionId));
  await db
    .update(learningSources)
    .set({ updatedAt: new Date() })
    .where(eq(learningSources.id, input.sourceId));

  let llmResponse: Response;

  try {
    llmResponse = await createChatCompletion({
      apiKey: input.apiKey,
      maxTokens: 1100,
      messages: [...history, { role: "user", content: input.message }],
      model: input.model,
      stream: true,
      system: systemPrompt,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Learning chat request failed." },
      { status: 500 },
    );
  }

  if (!llmResponse.body) {
    return Response.json({ error: "Learning chat response was empty." }, { status: 500 });
  }

  return new Response(streamAssistantText(llmResponse.body, input.sessionId, citations), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Learning-Citations": encodeURIComponent(JSON.stringify(citations)),
    },
  });
}

function parseLearningChatRequest(body: unknown) {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const payload = body as Record<string, unknown>;

  if (
    typeof payload.sourceId !== "string" ||
    typeof payload.sessionId !== "string" ||
    typeof payload.message !== "string" ||
    !payload.sourceId.trim() ||
    !payload.sessionId.trim() ||
    !payload.message.trim()
  ) {
    return null;
  }

  return {
    apiKey: typeof payload.apiKey === "string" ? payload.apiKey.trim() || undefined : undefined,
    message: payload.message.trim(),
    model: typeof payload.model === "string" ? payload.model.trim() || undefined : undefined,
    sessionId: payload.sessionId.trim(),
    sourceId: payload.sourceId.trim(),
  };
}

async function getRecentMessages(sessionId: string): Promise<LlmMessage[]> {
  const { db } = await import("@/lib/db");
  const rows = await db
    .select({
      role: learningMessages.role,
      content: learningMessages.content,
      createdAt: learningMessages.createdAt,
    })
    .from(learningMessages)
    .where(eq(learningMessages.sessionId, sessionId))
    .orderBy(desc(learningMessages.createdAt))
    .limit(RECENT_MESSAGE_LIMIT);

  return rows.reverse().reduce<LlmMessage[]>((history, message) => {
    if (message.role !== "user" && message.role !== "assistant") {
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
  citations: Array<{ chunkIndex: number; label: string; sourceId: string }>,
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
            const text = line.trim();

            if (!text.startsWith("data:")) {
              continue;
            }

            const payload = text.replace(/^data:\s*/, "");

            if (payload === "[DONE]") {
              continue;
            }

            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                assistantText += content;
                controller.enqueue(encoder.encode(content));
              }
            } catch {
              continue;
            }
          }
        }

        if (assistantText.trim()) {
          const { db } = await import("@/lib/db");
          await db.insert(learningMessages).values({
            citationsJson: citations,
            content: assistantText,
            role: "assistant",
            sessionId,
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

function buildSessionTitle(message: string) {
  const title = message.replace(/\s+/g, " ").trim();
  return title.length > 48 ? `${title.slice(0, 45)}...` : title || "New chat";
}
