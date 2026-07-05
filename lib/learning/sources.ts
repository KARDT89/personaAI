import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { and, eq, sql } from "drizzle-orm";
import { PDFParse } from "pdf-parse";

import {
  learningSourceChunks,
  learningSources,
  type LearningSource,
} from "@/lib/db/schema";
import { createEmbedding } from "@/lib/llm/client";

export type LearningSourceKind = "book_pdf" | "podcast_transcript";

export type LearningCitation = {
  chunkIndex: number;
  label: string;
  pageEnd?: number | null;
  pageStart?: number | null;
  sourceId: string;
};

export type RetrievedLearningChunk = LearningCitation & {
  similarity: number;
  text: string;
};

type PageText = {
  page: number;
  text: string;
};

type LearningChunkInput = {
  chunkIndex: number;
  pageEnd?: number | null;
  pageStart?: number | null;
  text: string;
  tokenHint: number;
};

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_SOURCE_CHARS = 500000;
const MIN_SOURCE_CHARS = 200;
const MAX_CHUNK_CHARS = 1800;
const MIN_CHUNK_CHARS = 160;
const RETRIEVAL_LIMIT = 7;
let pdfWorkerDataUrl: string | null = null;

export async function createLearningSourceFromPdf({
  apiKey,
  file,
  title,
  userId,
}: {
  apiKey?: string;
  file: File;
  title?: string;
  userId: string;
}) {
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    throw new Error("Upload a PDF file.");
  }

  if (file.size > MAX_PDF_BYTES) {
    throw new Error("PDF is too large. Upload a file under 25 MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const pages = await extractPdfPages(buffer);
  const sourceText = pages.map((page) => page.text).join("\n\n").replace(/\s+/g, " ").trim();

  if (sourceText.length < MIN_SOURCE_CHARS) {
    throw new Error("Could not extract enough text. Scanned PDFs are not supported yet.");
  }

  const chunks = chunkPages(pages).slice(0, Math.ceil(MAX_SOURCE_CHARS / MIN_CHUNK_CHARS));

  return storeLearningSource({
    apiKey,
    chunks,
    originalFilename: file.name,
    pageCount: pages.length,
    sourceChars: Math.min(sourceText.length, MAX_SOURCE_CHARS),
    sourceKind: "book_pdf",
    title: normalizeTitle(title) || filenameToTitle(file.name),
    userId,
  });
}

export async function createLearningSourceFromTranscript({
  apiKey,
  episode,
  show,
  title,
  transcript,
  userId,
}: {
  apiKey?: string;
  episode?: string;
  show?: string;
  title: string;
  transcript: string;
  userId: string;
}) {
  const cleanTranscript = transcript.replace(/\s+/g, " ").trim();

  if (cleanTranscript.length < MIN_SOURCE_CHARS) {
    throw new Error("Paste at least 200 characters of transcript text.");
  }

  if (cleanTranscript.length > MAX_SOURCE_CHARS) {
    throw new Error("Transcript is too large. Keep it under 500k characters for v1.");
  }

  const sourceTitle = normalizeTitle(title) || normalizeTitle(episode) || "Podcast transcript";

  return storeLearningSource({
    apiKey,
    chunks: chunkPlainText(cleanTranscript),
    metadata: {
      episode: normalizeTitle(episode) || undefined,
      show: normalizeTitle(show) || undefined,
    },
    pageCount: null,
    sourceChars: cleanTranscript.length,
    sourceKind: "podcast_transcript",
    title: sourceTitle,
    userId,
  });
}

export async function retrieveLearningChunks({
  apiKey,
  query,
  sourceId,
  userId,
}: {
  apiKey?: string;
  query: string;
  sourceId: string;
  userId: string;
}) {
  let semanticRows: RetrievedLearningChunk[] = [];

  try {
    const embedding = await createEmbedding({ apiKey, input: query });
    const vector = toVectorLiteral(embedding);
    const { db } = await import("@/lib/db");
    const result = await db.execute<{
      chunk_index: number;
      page_end: number | null;
      page_start: number | null;
      similarity: number;
      source_id: string;
      text: string;
    }>(sql`
      SELECT
        "source_id",
        "chunk_index",
        "page_start",
        "page_end",
        "text",
        1 - ("embedding" <=> ${sql.raw(vector)}::vector) AS "similarity"
      FROM "learning_source_chunks"
      WHERE
        "source_id" = ${sourceId}
        AND "user_id" = ${userId}
        AND "embedding" IS NOT NULL
      ORDER BY "embedding" <=> ${sql.raw(vector)}::vector
      LIMIT ${RETRIEVAL_LIMIT}
    `);

    semanticRows = result.rows.map((row) => toRetrievedChunk(row));
  } catch (error) {
    console.error("Learning semantic retrieval failed; falling back to keyword retrieval.", error);
  }

  if (semanticRows.length > 0) {
    return semanticRows;
  }

  return retrieveKeywordLearningChunks({ query, sourceId, userId });
}

export function buildLearningSystemPrompt({
  chunks,
  source,
  userName,
}: {
  chunks: RetrievedLearningChunk[];
  source: LearningSource;
  userName?: string | null;
}) {
  const currentUser = userName?.trim() || "the current signed-in user";
  const sourceLabel = source.sourceKind === "book_pdf" ? "book" : "podcast transcript";
  const chunkBlock = chunks
    .map((chunk, index) => {
      return `Source ${index + 1} (${chunk.label}):\n${chunk.text}`;
    })
    .join("\n\n");

  return `
You are a self-development study assistant helping ${currentUser}.

Selected ${sourceLabel}: ${source.title}

Use the retrieved source excerpts to help ${currentUser} understand ideas, teachings, principles, mental models, practical takeaways, and reflection questions from the selected source.

Rules:
- Ground answers in the retrieved excerpts.
- If the excerpts do not support the answer, say the selected source does not provide enough evidence.
- Prefer useful synthesis over long quotes.
- Do not provide long copyrighted passages.
- Include compact source hints naturally, using labels like "Pages 12-14" or "Transcript chunk 3" when they help.
- Make answers practical: explain the idea, why it matters, how to apply it, and one next step when appropriate.

Retrieved excerpts:
${chunkBlock || "No relevant excerpts were retrieved."}
`.trim();
}

export function buildLearningCitationList(chunks: RetrievedLearningChunk[]) {
  const seen = new Set<string>();

  return chunks
    .map(({ chunkIndex, label, pageEnd, pageStart, sourceId }) => ({
      chunkIndex,
      label,
      pageEnd,
      pageStart,
      sourceId,
    }))
    .filter((citation) => {
      const key = `${citation.sourceId}-${citation.chunkIndex}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

async function extractPdfPages(buffer: Buffer): Promise<PageText[]> {
  PDFParse.setWorker(getPdfWorkerDataUrl());
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.pages
      .map((page) => ({
        page: page.num,
        text: page.text.replace(/\s+/g, " ").trim(),
      }))
      .filter((page) => page.text.length > 0);
  } finally {
    await parser.destroy();
  }
}

function getPdfWorkerDataUrl() {
  if (!pdfWorkerDataUrl) {
    const workerPath = path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.worker.mjs",
    );
    const workerSource = readFileSync(workerPath, "utf8");
    pdfWorkerDataUrl = `data:text/javascript;base64,${Buffer.from(workerSource).toString("base64")}`;
  }

  return pdfWorkerDataUrl;
}

async function storeLearningSource({
  apiKey,
  chunks,
  metadata = {},
  originalFilename,
  pageCount,
  sourceChars,
  sourceKind,
  title,
  userId,
}: {
  apiKey?: string;
  chunks: LearningChunkInput[];
  metadata?: Record<string, unknown>;
  originalFilename?: string;
  pageCount?: number | null;
  sourceChars: number;
  sourceKind: LearningSourceKind;
  title: string;
  userId: string;
}) {
  if (chunks.length === 0) {
    throw new Error("Could not split this source into searchable chunks.");
  }

  const { db } = await import("@/lib/db");
  const [source] = await db
    .insert(learningSources)
    .values({
      chunkCount: chunks.length,
      metadataJson: metadata,
      originalFilename: originalFilename ?? null,
      pageCount: pageCount ?? null,
      sourceChars,
      sourceKind,
      title,
      updatedAt: new Date(),
      userId,
    })
    .returning();

  if (!source) {
    throw new Error("Could not save learning source.");
  }

  for (const chunk of chunks) {
    let embedding: number[] | null = null;

    try {
      embedding = await createEmbedding({
        apiKey,
        input: chunk.text,
      });
    } catch (error) {
      console.error("Failed to embed learning source chunk.", error);
    }

    await db.insert(learningSourceChunks).values({
      chunkIndex: chunk.chunkIndex,
      embedding,
      metadataJson: {},
      pageEnd: chunk.pageEnd ?? null,
      pageStart: chunk.pageStart ?? null,
      sourceId: source.id,
      text: chunk.text,
      tokenHint: chunk.tokenHint,
      userId,
    });
  }

  return source;
}

function chunkPages(pages: PageText[]) {
  const chunks: LearningChunkInput[] = [];
  let current = "";
  let pageStart: number | null = null;
  let pageEnd: number | null = null;
  let usedChars = 0;

  for (const page of pages) {
    if (usedChars >= MAX_SOURCE_CHARS) {
      break;
    }

    const remainingChars = MAX_SOURCE_CHARS - usedChars;
    const pageText = page.text.slice(0, remainingChars);
    usedChars += pageText.length;

    for (const text of splitOversizedText(pageText)) {
      const next = current ? `${current}\n\n${text}` : text;

      if (next.length > MAX_CHUNK_CHARS && current.length >= MIN_CHUNK_CHARS) {
        chunks.push(toChunk(chunks.length, current, pageStart, pageEnd));
        current = text;
        pageStart = page.page;
        pageEnd = page.page;
      } else {
        current = next;
        pageStart = pageStart ?? page.page;
        pageEnd = page.page;
      }
    }
  }

  if (current.trim().length >= MIN_CHUNK_CHARS) {
    chunks.push(toChunk(chunks.length, current, pageStart, pageEnd));
  }

  return chunks;
}

function chunkPlainText(text: string) {
  const chunks: LearningChunkInput[] = [];
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  let current = "";

  for (const paragraph of paragraphs.length ? paragraphs : [text]) {
    for (const segment of splitOversizedText(paragraph)) {
      if ((current + "\n" + segment).length > MAX_CHUNK_CHARS && current.length >= MIN_CHUNK_CHARS) {
        chunks.push(toChunk(chunks.length, current));
        current = segment;
      } else {
        current = current ? `${current}\n${segment}` : segment;
      }
    }
  }

  if (current.trim().length >= MIN_CHUNK_CHARS) {
    chunks.push(toChunk(chunks.length, current));
  }

  return chunks;
}

function splitOversizedText(text: string) {
  if (text.length <= MAX_CHUNK_CHARS) {
    return [text];
  }

  const segments: string[] = [];

  for (let index = 0; index < text.length; index += MAX_CHUNK_CHARS) {
    const segment = text.slice(index, index + MAX_CHUNK_CHARS).trim();

    if (segment) {
      segments.push(segment);
    }
  }

  return segments;
}

async function retrieveKeywordLearningChunks({
  query,
  sourceId,
  userId,
}: {
  query: string;
  sourceId: string;
  userId: string;
}) {
  const { db } = await import("@/lib/db");
  const rows = await db
    .select({
      chunkIndex: learningSourceChunks.chunkIndex,
      pageEnd: learningSourceChunks.pageEnd,
      pageStart: learningSourceChunks.pageStart,
      sourceId: learningSourceChunks.sourceId,
      text: learningSourceChunks.text,
    })
    .from(learningSourceChunks)
    .where(
      and(
        eq(learningSourceChunks.sourceId, sourceId),
        eq(learningSourceChunks.userId, userId),
      ),
    )
    .limit(60);
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3);

  return rows
    .map((row) => ({
      ...row,
      label: formatCitationLabel(row),
      similarity: keywordScore(row.text, terms),
    }))
    .filter((row) => row.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, RETRIEVAL_LIMIT);
}

function toChunk(
  chunkIndex: number,
  text: string,
  pageStart?: number | null,
  pageEnd?: number | null,
): LearningChunkInput {
  return {
    chunkIndex,
    pageEnd: pageEnd ?? null,
    pageStart: pageStart ?? null,
    text: text.trim().slice(0, MAX_CHUNK_CHARS + 400),
    tokenHint: estimateTokenHint(text),
  };
}

function toRetrievedChunk(row: {
  chunk_index: number;
  page_end: number | null;
  page_start: number | null;
  similarity: number;
  source_id: string;
  text: string;
}): RetrievedLearningChunk {
  return {
    chunkIndex: row.chunk_index,
    label: formatCitationLabel({
      chunkIndex: row.chunk_index,
      pageEnd: row.page_end,
      pageStart: row.page_start,
    }),
    pageEnd: row.page_end,
    pageStart: row.page_start,
    similarity: Number(row.similarity) || 0,
    sourceId: row.source_id,
    text: row.text,
  };
}

function formatCitationLabel({
  chunkIndex,
  pageEnd,
  pageStart,
}: {
  chunkIndex: number;
  pageEnd?: number | null;
  pageStart?: number | null;
}) {
  if (pageStart && pageEnd && pageStart !== pageEnd) {
    return `Pages ${pageStart}-${pageEnd}`;
  }

  if (pageStart) {
    return `Page ${pageStart}`;
  }

  return `Transcript chunk ${chunkIndex + 1}`;
}

function filenameToTitle(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "Book";
}

function normalizeTitle(value?: string) {
  return value?.replace(/\s+/g, " ").trim().slice(0, 160) ?? "";
}

function estimateTokenHint(text: string) {
  return Math.ceil(text.length / 4);
}

function keywordScore(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
}

function toVectorLiteral(embedding: number[]) {
  return `'[${embedding.map((value) => Number(value).toFixed(8)).join(",")}]'`;
}
