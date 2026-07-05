import { requireUser } from "@/lib/auth-utils";
import { createChatCompletionText } from "@/lib/llm/client";
import type { PersonaData } from "@/lib/personas/promptBuilder";
import { cleanStringArray, sanitizePersonaData, slugify } from "@/lib/personas/validation";

type SourceType = "youtube-transcript" | "whatsapp-chat" | "other";

export async function POST(req: Request) {
  const user = await requireUser(req);

  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await parseRequestBody(req);
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const payload = parseGenerateRequest(body);

  if (!payload) {
    return Response.json(
      { error: "name, sourceType, and sourceText are required." },
      { status: 400 },
    );
  }

  const content = await createChatCompletionText({
    maxTokens: 1800,
    messages: [
      {
        role: "user",
        content: buildGenerationPrompt(payload),
      },
    ],
  });

  const draft = parsePersonaDraft(content, payload.name, payload.sourceText);

  return Response.json({ persona: draft });
}

async function parseRequestBody(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const pastedText = form.get("sourceText");
    const sourceText =
      file instanceof File
        ? await readTextFile(file)
        : typeof pastedText === "string"
          ? pastedText
          : "";

    return {
      name: form.get("name"),
      sourceType: form.get("sourceType"),
      sourceText,
    };
  }

  return req.json();
}

async function readTextFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".txt")) {
    throw new Error("Only .txt files are supported.");
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error("File is too large.");
  }

  return file.text();
}

function parseGenerateRequest(body: unknown) {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const payload = body as Record<string, unknown>;

  if (
    typeof payload.name !== "string" ||
    typeof payload.sourceType !== "string" ||
    typeof payload.sourceText !== "string" ||
    payload.name.trim().length < 2 ||
    payload.sourceText.trim().length < 200
  ) {
    return null;
  }

  if (!isSourceType(payload.sourceType)) {
    return null;
  }

  return {
    name: payload.name.trim(),
    sourceType: payload.sourceType,
    sourceText: payload.sourceText.trim().slice(0, 50000),
  };
}

function buildGenerationPrompt(payload: {
  name: string;
  sourceType: SourceType;
  sourceText: string;
}) {
  return `
Extract a compact chat persona from this ${payload.sourceType}.

Return only valid JSON with this exact shape:
{
  "persona_id": "slug-like-id",
  "name": "${payload.name}",
  "tagline": "short professional label",
  "bio": "one sentence summary",
  "identity": "short bio, background, teaching or communication philosophy",
  "catchphrases": ["..."],
  "tone_traits": ["..."],
  "teaching_pattern": "pattern string",
  "topics": ["..."],
  "starter_prompts": ["...", "...", "..."],
  "few_shot": [{"q":"...","a":"..."}],
  "source_count": 1
}

Rules:
- Do not include raw source text.
- Do not invent private biographical details.
- Preserve communication style, tone, vocabulary, and recurring advice.
- For WhatsApp chats, infer style from messages without exposing private content.
- Keep answers concise enough for a system prompt.
- Provide 3 to 6 few_shot examples.

Source text:
${payload.sourceText}
`.trim();
}

function parsePersonaDraft(content: string, name: string, sourceText: string) {
  const parsed = JSON.parse(extractJson(content)) as Partial<PersonaData>;
  const personaId = slugify(parsed.persona_id ?? name);
  const draft = sanitizePersonaData({
    persona_id: personaId,
    name,
    avatar_url: undefined,
    tagline: parsed.tagline ?? "Custom persona",
    bio: parsed.bio ?? parsed.identity ?? `Custom persona based on pasted text.`,
    identity: parsed.identity ?? `${name} communicates in the style captured by the provided source text.`,
    catchphrases: cleanStringArray(parsed.catchphrases),
    tone_traits: cleanStringArray(parsed.tone_traits),
    teaching_pattern:
      parsed.teaching_pattern ??
      "understand the question -> answer in the captured style -> give a practical next step",
    topics: cleanStringArray(parsed.topics),
    starter_prompts: cleanStringArray(parsed.starter_prompts).slice(0, 3),
    few_shot: Array.isArray(parsed.few_shot) ? parsed.few_shot.slice(0, 6) : [],
    source_count: Math.max(1, Math.ceil(sourceText.length / 30000)),
  } satisfies PersonaData);

  if (!draft) {
    throw new Error("Could not parse generated persona JSON.");
  }

  return draft;
}

function extractJson(content: string) {
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("Could not parse generated persona JSON.");
  }

  return content.slice(firstBrace, lastBrace + 1);
}

function isSourceType(value: string): value is SourceType {
  return (
    value === "youtube-transcript" ||
    value === "whatsapp-chat" ||
    value === "other"
  );
}
