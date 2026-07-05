import "server-only";

export type LlmMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatRequest = {
  apiKey?: string;
  system?: string;
  messages: LlmMessage[];
  model?: string;
  maxTokens?: number;
  stream?: boolean;
};

const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";

export function getOpenRouterModel() {
  return process.env.OPENROUTER_MODEL ?? "openai/gpt-4o";
}

export function getOpenRouterEmbeddingModel() {
  return process.env.OPENROUTER_EMBEDDING_MODEL ?? "openai/text-embedding-3-small";
}

export async function createChatCompletion(request: ChatRequest) {
  const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: getHeaders(request.apiKey),
    body: JSON.stringify({
      model: request.model ?? getOpenRouterModel(),
      messages: [
        ...(request.system
          ? [{ role: "system" as const, content: request.system }]
          : []),
        ...request.messages,
      ],
      max_tokens: request.maxTokens ?? 1024,
      stream: request.stream ?? false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter request failed with ${response.status}: ${errorText}`,
    );
  }

  return response;
}

export async function createChatCompletionText(request: ChatRequest) {
  const response = await createChatCompletion({ ...request, stream: false });
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function createEmbedding({
  apiKey,
  input,
  model,
}: {
  apiKey?: string;
  input: string;
  model?: string;
}) {
  const response = await fetch(OPENROUTER_EMBEDDINGS_URL, {
    method: "POST",
    headers: getHeaders(apiKey),
    body: JSON.stringify({
      model: model ?? getOpenRouterEmbeddingModel(),
      input,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter embedding request failed with ${response.status}: ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embedding = data.data?.[0]?.embedding;

  if (!embedding?.length) {
    throw new Error("OpenRouter returned an empty embedding.");
  }

  return normalizeEmbeddingDimensions(embedding, 1536);
}

function normalizeEmbeddingDimensions(embedding: number[], dimensions: number) {
  if (embedding.length === dimensions) {
    return embedding;
  }

  if (embedding.length > dimensions) {
    return embedding.slice(0, dimensions);
  }

  return [...embedding, ...Array.from({ length: dimensions - embedding.length }, () => 0)];
}

function getHeaders(apiKeyOverride?: string) {
  const apiKey = apiKeyOverride || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("Add an OpenRouter API key in Settings or configure OPENROUTER_API_KEY.");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (process.env.OPENROUTER_SITE_URL) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  }

  if (process.env.OPENROUTER_APP_TITLE) {
    headers["X-OpenRouter-Title"] = process.env.OPENROUTER_APP_TITLE;
  }

  return headers;
}
