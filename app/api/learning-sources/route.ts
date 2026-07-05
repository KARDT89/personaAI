import { desc, eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth-utils";
import { learningSources } from "@/lib/db/schema";
import {
  createLearningSourceFromPdf,
  createLearningSourceFromTranscript,
} from "@/lib/learning/sources";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser(req);

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { db } = await import("@/lib/db");
  const rows = await db
    .select()
    .from(learningSources)
    .where(eq(learningSources.userId, user.id))
    .orderBy(desc(learningSources.updatedAt));

  return Response.json({
    sources: rows.map(toLearningSourceSummary),
  });
}

export async function POST(req: Request) {
  const user = await requireUser(req);

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    const source = contentType.includes("multipart/form-data")
      ? await createFromMultipart(req, user.id)
      : await createFromJson(req, user.id);

    return Response.json({ source: toLearningSourceSummary(source) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save learning source." },
      { status: 400 },
    );
  }
}

async function createFromMultipart(req: Request, userId: string) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    throw new Error("Upload a PDF file.");
  }

  return createLearningSourceFromPdf({
    apiKey: stringValue(form.get("apiKey")),
    file,
    title: stringValue(form.get("title")),
    userId,
  });
}

async function createFromJson(req: Request, userId: string) {
  const body = (await req.json()) as Record<string, unknown>;
  const sourceKind = stringValue(body.sourceKind);

  if (sourceKind !== "podcast_transcript") {
    throw new Error("Invalid learning source type.");
  }

  return createLearningSourceFromTranscript({
    apiKey: stringValue(body.apiKey),
    episode: stringValue(body.episode),
    show: stringValue(body.show),
    title: stringValue(body.title) || "Podcast transcript",
    transcript: stringValue(body.transcript) ?? "",
    userId,
  });
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function toLearningSourceSummary(source: typeof learningSources.$inferSelect) {
  return {
    id: source.id,
    title: source.title,
    sourceKind: source.sourceKind,
    originalFilename: source.originalFilename,
    sourceChars: source.sourceChars,
    pageCount: source.pageCount,
    chunkCount: source.chunkCount,
    metadata: source.metadataJson ?? {},
    createdAt: source.createdAt?.toISOString() ?? null,
    updatedAt: source.updatedAt?.toISOString() ?? null,
  };
}
