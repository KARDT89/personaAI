export async function GET() {
  return Response.json({
    auth: {
      githubEnabled: Boolean(
        process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
      ),
    },
    llm: {
      appApiKeyAvailable: Boolean(process.env.OPENROUTER_API_KEY),
      defaultModel: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o",
    },
  });
}
