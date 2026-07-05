export async function GET() {
  return Response.json({
    auth: {
      githubEnabled: Boolean(
        process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
      ),
    },
  });
}
