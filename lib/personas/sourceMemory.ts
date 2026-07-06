import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { personaMemoryChunks, personaSources } from "@/lib/db/schema";
import { createEmbedding } from "@/lib/llm/client";

export type SourceKind = "youtube-transcript" | "whatsapp-chat" | "other";

export type SourceMemoryChunkInput = {
  chunkIndex: number;
  speaker?: string | null;
  text: string;
  tokenHint?: number;
  metadata?: Record<string, unknown>;
};

export type SourceMemoryPayload = {
  sourceType: SourceKind;
  sourceChars: number;
  targetSpeaker?: string | null;
  userSpeaker?: string | null;
  metadata?: Record<string, unknown>;
  chunks: SourceMemoryChunkInput[];
};

const MAX_MEMORY_CHUNKS = 80;
const MAX_CHUNK_CHARS = 1800;
const MIN_CHUNK_CHARS = 160;
const RETRIEVAL_LIMIT = 6;

type ParsedChatMessage = {
  speaker: string | null;
  text: string;
  timestamp?: string;
};

export function buildSourceMemoryPayload({
  sourceText,
  sourceType,
  targetSpeaker,
  userSpeaker,
}: {
  sourceText: string;
  sourceType: SourceKind;
  targetSpeaker?: string | null;
  userSpeaker?: string | null;
}): SourceMemoryPayload {
  const chunks =
    sourceType === "whatsapp-chat"
      ? chunkWhatsappSource(sourceText)
      : chunkPlainSource(sourceText);

  return {
    sourceType,
    sourceChars: sourceText.length,
    targetSpeaker: targetSpeaker ?? null,
    userSpeaker: userSpeaker ?? null,
    metadata: {
      generatedAt: new Date().toISOString(),
      memoryMode: "high_fidelity_source_memory",
    },
    chunks: chunks.slice(0, MAX_MEMORY_CHUNKS),
  };
}

export function cleanSourceMemoryPayload(value: unknown): SourceMemoryPayload | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const payload = value as Partial<SourceMemoryPayload>;

  if (!isSourceKind(payload.sourceType) || !Array.isArray(payload.chunks)) {
    return null;
  }

  const chunks = payload.chunks
    .map((chunk, index): SourceMemoryChunkInput | null => {
      if (typeof chunk !== "object" || chunk === null) {
        return null;
      }

      const item = chunk as Partial<SourceMemoryChunkInput>;

      if (typeof item.text !== "string") {
        return null;
      }

      const text = item.text.replace(/\s+/g, " ").trim().slice(0, MAX_CHUNK_CHARS + 400);

      if (text.length < MIN_CHUNK_CHARS) {
        return null;
      }

      return {
        chunkIndex:
          typeof item.chunkIndex === "number" && Number.isFinite(item.chunkIndex)
            ? Math.max(0, Math.round(item.chunkIndex))
            : index,
        speaker:
          typeof item.speaker === "string" ? item.speaker.trim().slice(0, 120) || null : null,
        text,
        tokenHint:
          typeof item.tokenHint === "number" && Number.isFinite(item.tokenHint)
            ? Math.max(0, Math.round(item.tokenHint))
            : estimateTokenHint(text),
        metadata:
          typeof item.metadata === "object" && item.metadata !== null ? item.metadata : {},
      } satisfies SourceMemoryChunkInput;
    })
    .filter((chunk): chunk is SourceMemoryChunkInput => Boolean(chunk))
    .slice(0, MAX_MEMORY_CHUNKS);

  if (chunks.length === 0) {
    return null;
  }

  return {
    sourceType: payload.sourceType,
    sourceChars:
      typeof payload.sourceChars === "number" && Number.isFinite(payload.sourceChars)
        ? Math.max(0, Math.round(payload.sourceChars))
        : chunks.reduce((total, chunk) => total + chunk.text.length, 0),
    targetSpeaker:
      typeof payload.targetSpeaker === "string"
        ? payload.targetSpeaker.trim().slice(0, 120) || null
        : null,
    userSpeaker:
      typeof payload.userSpeaker === "string"
        ? payload.userSpeaker.trim().slice(0, 120) || null
        : null,
    metadata:
      typeof payload.metadata === "object" && payload.metadata !== null
        ? payload.metadata
        : {},
    chunks,
  };
}

export async function storePersonaSourceMemory({
  apiKey,
  memory,
  personaId,
  userId,
}: {
  apiKey?: string;
  memory: SourceMemoryPayload;
  personaId: string;
  userId: string;
}) {
  const { db } = await import("@/lib/db");

  await db
    .delete(personaSources)
    .where(and(eq(personaSources.personaId, personaId), eq(personaSources.userId, userId)));

  const [source] = await db
    .insert(personaSources)
    .values({
      personaId,
      userId,
      sourceType: memory.sourceType,
      targetSpeaker: memory.targetSpeaker ?? null,
      userSpeaker: memory.userSpeaker ?? null,
      sourceChars: memory.sourceChars,
      chunkCount: memory.chunks.length,
      metadataJson: memory.metadata ?? {},
    })
    .returning({ id: personaSources.id });

  if (!source) {
    return;
  }

  for (const chunk of memory.chunks) {
    let embedding: number[] | null = null;

    try {
      embedding = await createEmbedding({
        apiKey,
        input: chunk.text,
      });
    } catch (error) {
      console.error("Failed to embed persona memory chunk.", error);
    }

    await db.insert(personaMemoryChunks).values({
      personaId,
      sourceId: source.id,
      userId,
      chunkIndex: chunk.chunkIndex,
      speaker: chunk.speaker ?? null,
      text: chunk.text,
      tokenHint: chunk.tokenHint ?? estimateTokenHint(chunk.text),
      metadataJson: chunk.metadata ?? {},
      embedding,
    });
  }
}

export async function retrieveRelevantSourceMemories({
  apiKey,
  personaId,
  query,
  userId,
}: {
  apiKey?: string;
  personaId: string;
  query: string;
  userId: string;
}) {
  const hasMemory = await hasSourceMemory({ personaId, userId });

  if (!hasMemory) {
    return [];
  }

  let semanticRows: Array<{ text: string; speaker: string | null; similarity: number }> = [];

  try {
    const embedding = await createEmbedding({ apiKey, input: query });
    const vector = toVectorLiteral(embedding);
    const { db } = await import("@/lib/db");
    const result = await db.execute<{
      text: string;
      speaker: string | null;
      similarity: number;
    }>(sql`
      SELECT
        "text",
        "speaker",
        1 - ("embedding" <=> ${sql.raw(vector)}::vector) AS "similarity"
      FROM "persona_memory_chunks"
      WHERE
        "persona_id" = ${personaId}
        AND "user_id" = ${userId}
        AND "embedding" IS NOT NULL
      ORDER BY "embedding" <=> ${sql.raw(vector)}::vector
      LIMIT ${RETRIEVAL_LIMIT}
    `);

    semanticRows = result.rows.map((row) => ({
      text: row.text,
      speaker: row.speaker,
      similarity: Number(row.similarity) || 0,
    }));
  } catch (error) {
    console.error("Semantic memory retrieval failed; falling back to keyword retrieval.", error);
  }

  if (semanticRows.length > 0) {
    return semanticRows;
  }

  return retrieveKeywordSourceMemories({ personaId, query, userId });
}

async function hasSourceMemory({
  personaId,
  userId,
}: {
  personaId: string;
  userId: string;
}) {
  const { db } = await import("@/lib/db");
  const [row] = await db
    .select({ id: personaMemoryChunks.id })
    .from(personaMemoryChunks)
    .where(
      and(
        eq(personaMemoryChunks.personaId, personaId),
        eq(personaMemoryChunks.userId, userId),
      ),
    )
    .limit(1);

  return Boolean(row);
}

function chunkPlainSource(sourceText: string): SourceMemoryChunkInput[] {
  const paragraphs = sourceText
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const chunks: SourceMemoryChunkInput[] = [];
  let current = "";

  for (const paragraph of paragraphs.length ? paragraphs : [sourceText]) {
    if ((current + "\n" + paragraph).length > MAX_CHUNK_CHARS && current.length >= MIN_CHUNK_CHARS) {
      chunks.push(toChunk(chunks.length, null, current));
      current = paragraph;
    } else {
      current = current ? `${current}\n${paragraph}` : paragraph;
    }
  }

  if (current.trim().length >= MIN_CHUNK_CHARS) {
    chunks.push(toChunk(chunks.length, null, current));
  }

  return chunks;
}

function chunkWhatsappSource(sourceText: string): SourceMemoryChunkInput[] {
  const messages = parseWhatsappMessages(sourceText);

  if (messages.length === 0) {
    return chunkPlainSource(sourceText);
  }

  const chunks: SourceMemoryChunkInput[] = [];
  let current: ParsedChatMessage[] = [];
  let currentChars = 0;

  for (const message of messages) {
    const line = formatChatMessage(message);

    if (currentChars + line.length > MAX_CHUNK_CHARS && current.length > 0) {
      chunks.push(chatMessagesToChunk(chunks.length, current));
      current = [];
      currentChars = 0;
    }

    current.push(message);
    currentChars += line.length;
  }

  if (current.length > 0) {
    chunks.push(chatMessagesToChunk(chunks.length, current));
  }

  return chunks;
}

function parseWhatsappMessages(sourceText: string): ParsedChatMessage[] {
  const messages: ParsedChatMessage[] = [];
  const lines = sourceText.split(/\r?\n/);
  const date = String.raw`\d{1,2}[/-]\d{1,2}[/-]\d{2,4}`;
  const time = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:[\s\u00a0\u202f]*[AP]M)?`;
  const plainPattern =
    new RegExp(String.raw`^(${date},?[\s\u00a0\u202f]+${time})[\s\u00a0\u202f]+-[\s\u00a0\u202f]+([^:]+):[\s\u00a0\u202f]*(.*)$`, "i");
  const bracketPattern =
    new RegExp(String.raw`^\[?(${date},?[\s\u00a0\u202f]+${time})\]?[\s\u00a0\u202f]+([^:]+):[\s\u00a0\u202f]*(.*)$`, "i");

  for (const line of lines) {
    const normalizedLine = normalizeWhatsappLine(line);
    const match = normalizedLine.match(plainPattern) ?? normalizedLine.match(bracketPattern);

    if (match) {
      const text = cleanMessageText(match[3] ?? "");

      if (text) {
        messages.push({
          timestamp: match[1],
          speaker: match[2]?.trim() ?? null,
          text,
        });
      }

      continue;
    }

    const continuation = cleanMessageText(line);

    if (continuation && messages.length > 0) {
      const last = messages[messages.length - 1];
      last.text = `${last.text}\n${continuation}`;
    }
  }

  return messages;
}

function cleanMessageText(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (
    !cleaned ||
    cleaned === "<Media omitted>" ||
    cleaned.toLowerCase().includes("message was deleted") ||
    cleaned.toLowerCase().includes("end-to-end encrypted")
  ) {
    return "";
  }

  return cleaned;
}

function normalizeWhatsappLine(line: string) {
  return line
    .replace(/[\u200e\u200f]/g, "")
    .replace(/[\u00a0\u202f]/g, " ");
}

function chatMessagesToChunk(index: number, messages: ParsedChatMessage[]): SourceMemoryChunkInput {
  const speakerCounts = messages.reduce<Record<string, number>>((counts, message) => {
    const speaker = message.speaker ?? "Unknown";
    counts[speaker] = (counts[speaker] ?? 0) + 1;
    return counts;
  }, {});
  const dominantSpeaker =
    Object.entries(speakerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const text = messages.map(formatChatMessage).join("\n");

  return toChunk(index, dominantSpeaker, text, {
    firstTimestamp: messages[0]?.timestamp,
    lastTimestamp: messages[messages.length - 1]?.timestamp,
    messageCount: messages.length,
    speakers: Object.keys(speakerCounts),
  });
}

function formatChatMessage(message: ParsedChatMessage) {
  return `${message.timestamp ? `${message.timestamp} ` : ""}${message.speaker ?? "Unknown"}: ${message.text}`;
}

function toChunk(
  chunkIndex: number,
  speaker: string | null,
  text: string,
  metadata: Record<string, unknown> = {},
): SourceMemoryChunkInput {
  return {
    chunkIndex,
    speaker,
    text: text.trim(),
    tokenHint: estimateTokenHint(text),
    metadata,
  };
}

async function retrieveKeywordSourceMemories({
  personaId,
  query,
  userId,
}: {
  personaId: string;
  query: string;
  userId: string;
}) {
  const { db } = await import("@/lib/db");
  const rows = await db
    .select({
      text: personaMemoryChunks.text,
      speaker: personaMemoryChunks.speaker,
    })
    .from(personaMemoryChunks)
    .where(
      and(
        eq(personaMemoryChunks.personaId, personaId),
        eq(personaMemoryChunks.userId, userId),
      ),
    )
    .limit(40);
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3);

  return rows
    .map((row) => ({
      ...row,
      similarity: keywordScore(row.text, terms),
    }))
    .filter((row) => row.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, RETRIEVAL_LIMIT);
}

function keywordScore(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
}

function estimateTokenHint(text: string) {
  return Math.ceil(text.length / 4);
}

function isSourceKind(value: unknown): value is SourceKind {
  return value === "youtube-transcript" || value === "whatsapp-chat" || value === "other";
}

function toVectorLiteral(embedding: number[]) {
  return `'[${embedding.map((value) => Number(value).toFixed(8)).join(",")}]'`;
}
