const DEFAULT_MODEL_OPTIONS = [
  {
    label: "OpenAI",
    options: [
      { id: "openai/gpt-4o", label: "GPT-4o", description: "Balanced default for chat and persona work." },
      { id: "openai/gpt-4o-mini", label: "GPT-4o mini", description: "Fast, lower-cost OpenAI option." },
      { id: "openai/gpt-4.1", label: "GPT-4.1", description: "Strong instruction following and coding." },
      { id: "openai/gpt-4.1-mini", label: "GPT-4.1 mini", description: "Lighter GPT-4.1 option." },
    ],
  },
  {
    label: "Anthropic",
    options: [
      { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", description: "Thoughtful writing and analysis." },
      { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku", description: "Fast Claude responses." },
      { id: "anthropic/claude-3.7-sonnet", label: "Claude 3.7 Sonnet", description: "Deeper Claude reasoning." },
    ],
  },
  {
    label: "Google",
    options: [
      { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash", description: "Fast multimodal-friendly model." },
      { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Stronger Google reasoning model." },
      { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Fast Gemini 2.5 option." },
    ],
  },
  {
    label: "Meta/Open models",
    options: [
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B Instruct", description: "Open-weight general chat model." },
      { id: "mistralai/mistral-large", label: "Mistral Large", description: "Mistral's flagship general model." },
      { id: "deepseek/deepseek-chat", label: "DeepSeek Chat", description: "Capable general-purpose model." },
    ],
  },
];

export async function GET() {
  const defaultModel = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o";
  const modelOptions = getConfiguredModelOptions();

  return Response.json({
    auth: {
      githubEnabled: Boolean(
        process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
      ),
    },
    llm: {
      appApiKeyAvailable: Boolean(process.env.OPENROUTER_API_KEY),
      defaultModel,
      modelOptions: withDefaultModel(modelOptions, defaultModel),
    },
  });
}

function getConfiguredModelOptions() {
  const configuredIds = process.env.OPENROUTER_MODEL_OPTIONS?.split(",")
    .map((modelId) => modelId.trim())
    .filter(Boolean);

  if (!configuredIds?.length) {
    return DEFAULT_MODEL_OPTIONS;
  }

  const configuredIdSet = new Set(configuredIds);
  const knownGroups = DEFAULT_MODEL_OPTIONS.map((group) => ({
    ...group,
    options: group.options.filter((option) => configuredIdSet.has(option.id)),
  })).filter((group) => group.options.length > 0);
  const knownIds = new Set(knownGroups.flatMap((group) => group.options.map((option) => option.id)));
  const customOptions = configuredIds
    .filter((modelId) => !knownIds.has(modelId))
    .map((modelId) => ({
      id: modelId,
      label: modelId,
      description: "Configured OpenRouter model.",
    }));

  if (customOptions.length === 0) {
    return knownGroups;
  }

  return [
    ...knownGroups,
    {
      label: "Configured models",
      options: customOptions,
    },
  ];
}

function withDefaultModel(
  groups: typeof DEFAULT_MODEL_OPTIONS,
  defaultModel: string,
) {
  if (groups.some((group) => group.options.some((option) => option.id === defaultModel))) {
    return groups;
  }

  return [
    {
      label: "App default",
      options: [
        {
          id: defaultModel,
          label: defaultModel,
          description: "Server-configured app default model.",
        },
      ],
    },
    ...groups,
  ];
}
