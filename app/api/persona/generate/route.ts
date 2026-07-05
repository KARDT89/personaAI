import { requireUser } from "@/lib/auth-utils";
import { createChatCompletionText } from "@/lib/llm/client";
import type { GenerationMeta, GenerationMode, PersonaData } from "@/lib/personas/promptBuilder";
import {
  buildSourceMemoryPayload,
} from "@/lib/personas/sourceMemory";
import { sanitizePersonaData, slugify } from "@/lib/personas/validation";

type SourceType = "youtube-transcript" | "whatsapp-chat" | "other";

const MAX_SOURCE_CHARS = 50000;
const CHUNK_SIZE = 8500;
const MAX_HIGH_FIDELITY_CHUNKS = 8;

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

  try {
    const result =
      payload.generationMode === "high_fidelity"
        ? await generateHighFidelityDraft(payload)
        : await generateSinglePassDraft(payload);

    return Response.json({
      meta: result.meta,
      persona: result.persona,
      sourceMemory: result.sourceMemory,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not generate persona draft.",
      },
      { status: 500 },
    );
  }
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
      apiKey: form.get("apiKey"),
      generationMode: form.get("generationMode"),
      model: form.get("model"),
      name: form.get("name"),
      sourceType: form.get("sourceType"),
      sourceText,
      targetSpeaker: form.get("targetSpeaker"),
      userSpeaker: form.get("userSpeaker"),
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

  const trimmedSource = payload.sourceText.trim();

  return {
    apiKey: typeof payload.apiKey === "string" ? payload.apiKey.trim() || undefined : undefined,
    generationMode: parseGenerationMode(payload.generationMode),
    model: typeof payload.model === "string" ? payload.model.trim() || undefined : undefined,
    name: payload.name.trim(),
    sourceType: payload.sourceType,
    sourceChars: trimmedSource.length,
    sourceText: trimmedSource.slice(0, MAX_SOURCE_CHARS),
    sourceTruncated: trimmedSource.length > MAX_SOURCE_CHARS,
    targetSpeaker:
      typeof payload.targetSpeaker === "string"
        ? payload.targetSpeaker.trim() || undefined
        : undefined,
    userSpeaker:
      typeof payload.userSpeaker === "string"
        ? payload.userSpeaker.trim() || undefined
        : undefined,
  };
}

async function generateSinglePassDraft(payload: GeneratePayload) {
  const isCompact = payload.generationMode === "compact";
  const content = await createChatCompletionText({
    apiKey: payload.apiKey,
    maxTokens: isCompact ? 1800 : 4300,
    model: payload.model,
    messages: [
      {
        role: "user",
        content: isCompact
          ? buildCompactGenerationPrompt(payload)
          : buildDetailedGenerationPrompt(payload),
      },
    ],
  });

  const meta = buildGenerationMeta(payload, 1, 1);

  return {
    meta,
    persona: await parsePersonaDraft(content, payload, meta),
    sourceMemory: undefined,
  };
}

async function generateHighFidelityDraft(payload: GeneratePayload) {
  const allChunks = chunkSourceText(payload.sourceText);
  const chunks = allChunks.slice(0, MAX_HIGH_FIDELITY_CHUNKS);
  const sourceMemory = buildSourceMemoryPayload({
    sourceText: payload.sourceText,
    sourceType: payload.sourceType,
    targetSpeaker: payload.targetSpeaker,
    userSpeaker: payload.userSpeaker,
  });
  const meta = buildGenerationMeta(payload, chunks.length, chunks.length + 1, {
    memoryChunkCount: sourceMemory.chunks.length,
    sourceTruncated: payload.sourceTruncated || allChunks.length > chunks.length,
  });
  const analyses: string[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const analysis = await createChatCompletionText({
      apiKey: payload.apiKey,
      maxTokens: 1700,
      model: payload.model,
      messages: [
        {
          role: "user",
          content: buildChunkAnalysisPrompt(payload, chunks[index], index + 1, chunks.length),
        },
      ],
    });

    analyses.push(analysis);
  }

  const content = await createChatCompletionText({
    apiKey: payload.apiKey,
    maxTokens: 4700,
    model: payload.model,
    messages: [
      {
        role: "user",
        content: buildHighFidelityMergePrompt(payload, analyses),
      },
    ],
  });

  return {
    meta,
    persona: await parsePersonaDraft(content, payload, meta),
    sourceMemory,
  };
}

type GeneratePayload = {
  apiKey?: string;
  generationMode: GenerationMode;
  model?: string;
  name: string;
  sourceChars: number;
  sourceType: SourceType;
  sourceText: string;
  sourceTruncated: boolean;
  targetSpeaker?: string;
  userSpeaker?: string;
};

function buildCompactGenerationPrompt(payload: GeneratePayload) {
  return `
Extract a compact chat persona from this ${payload.sourceType}.

Return only valid JSON matching this shape:
${personaJsonShape(payload.name)}

Rules:
- Return JSON only. No markdown fences, no commentary.
- Do not include raw source text.
- Do not invent private biographical details.
- Preserve communication style, tone, vocabulary, and recurring advice.
- Provide 3 to 6 few_shot examples.
- Set generation_mode to "compact".

Source text:
${payload.sourceText}
`.trim();
}

function buildDetailedGenerationPrompt(payload: GeneratePayload) {
  return `
Extract a detailed behavioral simulation profile from this ${payload.sourceType}.

The goal is not a summary. Capture how ${payload.name} speaks, reasons, teaches, reacts, corrects, encourages, jokes, transitions, and chooses words so another model can respond as if the user is talking to this person.

Return only valid JSON matching this shape:
${personaJsonShape(payload.name)}

Requirements:
- Return JSON only. No markdown fences, no commentary.
- Set generation_mode to "detailed".
- Do not include raw source text or private content.
- Do not invent private biography. If uncertain, describe observable communication style.
- Capture sentence rhythm, punctuation habits, code-switching, filler words, common transitions, humor, directness, and emotional stance.
- Capture reasoning style, teaching moves, disagreement style, follow-up behavior, and correction style.
- Include a phrase_bank with greetings, transitions, encouragement, corrections, and closings when supported by source.
- Include 6 to 10 scenario_examples covering explanation, debugging, roadmap, review, motivation, disagreement, and casual chat where possible.
- Include style_confidence notes about traits strongly supported by the source.

Source text:
${payload.sourceText}
`.trim();
}

function buildChunkAnalysisPrompt(
  payload: GeneratePayload,
  chunk: string,
  index: number,
  total: number,
) {
  return `
Analyze chunk ${index} of ${total} for a high-fidelity persona profile of ${payload.name}.

Return only valid JSON with:
{
  "voice_observations": ["..."],
  "language_observations": ["..."],
  "reasoning_observations": ["..."],
  "interaction_observations": ["..."],
  "phrase_candidates": {
    "greetings": ["..."],
    "transitions": ["..."],
    "encouragement": ["..."],
    "corrections": ["..."],
    "closings": ["..."]
  },
  "do_rules": ["..."],
  "dont_rules": ["..."],
  "scenario_seeds": [{"scenario":"...","q":"...","a":"..."}],
  "confidence_notes": ["..."]
}

Rules:
- Return JSON only. No markdown fences, no commentary.
- Extract behavior and style, not raw transcript.
- Avoid private details unless explicitly public/professional in the source.
- Keep each item concise but specific.

Chunk:
${chunk}
`.trim();
}

function buildHighFidelityMergePrompt(payload: GeneratePayload, analyses: string[]) {
  return `
Merge these chunk analyses into one canonical high-fidelity persona for ${payload.name}.

Return only valid JSON matching this shape:
${personaJsonShape(payload.name)}

Requirements:
- Return JSON only. No markdown fences, no commentary.
- Set generation_mode to "high_fidelity".
- Prioritize repeated, high-confidence style patterns over one-off details.
- Preserve the person’s speaking rhythm, language mix, transitions, correction style, and teaching behavior.
- Include 8 to 10 scenario_examples with rich answers that demonstrate the captured style.
- Do not include raw source text.
- Do not invent private biographical details.

Chunk analyses:
${analyses.map((analysis, index) => `Analysis ${index + 1}:\n${analysis}`).join("\n\n")}
`.trim();
}

function personaJsonShape(name: string) {
  return `{
  "persona_id": "slug-like-id",
  "generation_mode": "compact|detailed|high_fidelity",
  "name": "${name}",
  "tagline": "short professional label",
  "bio": "observable one or two sentence summary",
  "identity": "detailed public/professional identity and communication philosophy",
  "voice_profile": "sentence rhythm, punctuation, directness, humor, warmth, filler words",
  "language_profile": "language mix, vocabulary, repeated transitions, common wording",
  "reasoning_profile": "how they explain, simplify, challenge, debug, and teach",
  "interaction_rules": "how to handle vague questions, disagreement, praise, confusion, follow-ups",
  "addressing_rules": "how this persona should speak directly to the current signed-in user in a one-on-one chat",
  "phrase_bank": {
    "greetings": ["..."],
    "transitions": ["..."],
    "encouragement": ["..."],
    "corrections": ["..."],
    "closings": ["..."]
  },
  "do_rules": ["..."],
  "dont_rules": ["..."],
  "catchphrases": ["..."],
  "tone_traits": ["..."],
  "teaching_pattern": "pattern string",
  "topics": ["..."],
  "starter_prompts": ["...", "...", "..."],
  "few_shot": [{"q":"...","a":"..."}],
  "scenario_examples": [{"scenario":"...","q":"...","a":"..."}],
  "style_confidence": ["..."],
  "source_count": 1
}`;
}

async function parsePersonaDraft(
  content: string,
  payload: GeneratePayload,
  meta: GenerationMeta,
) {
  const parsed = await parsePersonaJsonWithRepair(content, payload);
  const personaId = slugify(parsed.persona_id ?? payload.name);
  const draft = sanitizePersonaData({
    ...parsed,
    persona_id: personaId,
    name: payload.name,
    avatar_url: undefined,
    tagline: parsed.tagline ?? "Custom persona",
    bio:
      parsed.bio ??
      parsed.identity ??
      "Custom persona based on provided source material.",
    identity:
      parsed.identity ??
      `${payload.name} communicates in the style captured by the provided source material.`,
    catchphrases: parsed.catchphrases ?? [],
    tone_traits: parsed.tone_traits ?? [],
    teaching_pattern:
      parsed.teaching_pattern ??
      "understand the question -> answer in the captured style -> give a practical next step",
    topics: parsed.topics ?? [],
    starter_prompts: parsed.starter_prompts ?? [],
    few_shot: parsed.few_shot ?? [],
    scenario_examples: parsed.scenario_examples ?? [],
    generation_mode: payload.generationMode,
    generation_meta: meta,
    source_kind: payload.sourceType,
    target_speaker: payload.targetSpeaker,
    user_speaker: payload.userSpeaker,
    addressing_rules:
      parsed.addressing_rules ??
      `Speak directly to the signed-in user in a one-on-one conversation. Use the source material as background, not as the current audience.`,
    source_count: Math.max(1, Math.ceil(payload.sourceText.length / 30000)),
  } satisfies PersonaData);

  if (!draft) {
    throw new Error("Could not parse generated persona JSON.");
  }

  return draft;
}

async function parsePersonaJsonWithRepair(content: string, payload: GeneratePayload) {
  try {
    return JSON.parse(extractJson(content)) as Partial<PersonaData>;
  } catch {
    const repaired = await createChatCompletionText({
      apiKey: payload.apiKey,
      maxTokens: 4300,
      model: payload.model,
      messages: [
        {
          role: "user",
          content: `
Repair this malformed persona JSON. Return only valid JSON matching this shape:
${personaJsonShape(payload.name)}

Malformed output:
${content}
`.trim(),
        },
      ],
    });

    try {
      return JSON.parse(extractJson(repaired)) as Partial<PersonaData>;
    } catch {
      throw new Error("The model returned malformed JSON twice. Try again or use Detailed mode.");
    }
  }
}

function buildGenerationMeta(
  payload: GeneratePayload,
  chunkCount: number,
  analysisPasses: number,
  overrides: Partial<GenerationMeta> = {},
): GenerationMeta {
  return {
    analysisPasses,
    chunkCount,
    generationMode: payload.generationMode,
    sourceChars: payload.sourceChars,
    sourceTruncated: payload.sourceTruncated,
    ...overrides,
  };
}

function chunkSourceText(sourceText: string) {
  const paragraphs = sourceText.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;

    if (next.length > CHUNK_SIZE && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.flatMap((chunk) => {
    if (chunk.length <= CHUNK_SIZE * 1.3) {
      return [chunk];
    }

    const splitChunks: string[] = [];

    for (let index = 0; index < chunk.length; index += CHUNK_SIZE) {
      splitChunks.push(chunk.slice(index, index + CHUNK_SIZE));
    }

    return splitChunks;
  });
}

function extractJson(content: string) {
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("Could not parse generated persona JSON.");
  }

  return content.slice(firstBrace, lastBrace + 1);
}

function parseGenerationMode(value: unknown): GenerationMode {
  return value === "compact" || value === "high_fidelity" ? value : "detailed";
}

function isSourceType(value: string): value is SourceType {
  return (
    value === "youtube-transcript" ||
    value === "whatsapp-chat" ||
    value === "other"
  );
}
