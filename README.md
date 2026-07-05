# PersonaAI

PersonaAI is a private AI workspace for building chat personas and study libraries from real source material. It lets you chat with built-in coding mentors, generate custom personas from transcripts or conversations, upload study sources, and ask source-grounded questions with citations.

The app is built for people who want AI conversations that are less generic and more grounded in actual material: transcripts, WhatsApp-style chats, PDFs, podcast notes, and curated persona profiles.

## What It Does

PersonaAI has two main workspaces:

- **Persona Studio**: chat with built-in mentors or generate your own persona from source text.
- **Study Library**: upload PDFs or paste podcast transcripts, then chat with the source using retrieval and citations.

Core capabilities:

- Built-in Hitesh and Piyush coding personas with high-fidelity Hinglish style profiles.
- Custom persona generation from YouTube transcripts, WhatsApp chats, or pasted text.
- High-fidelity persona mode with source memory chunks for later retrieval.
- Study library for book PDFs and podcast transcripts.
- Source-grounded learning chat with compact citations.
- Account-based private workspaces.
- Server app API key mode plus personal OpenRouter API key mode.
- Curated model picker for users who bring their own OpenRouter key.
- Markdown-like chat rendering with code blocks, copy buttons, and lightweight syntax highlighting.

## Tech Stack

- **Framework**: Next.js 16 App Router
- **UI**: React 19, Tailwind CSS, shadcn-style local components, Base UI primitives
- **Auth**: Better Auth with email/password and optional GitHub OAuth
- **Database**: PostgreSQL via Drizzle ORM
- **Vector search**: pgvector with 1536-dimensional embeddings
- **LLM provider**: OpenRouter chat completions and embeddings
- **PDF parsing**: `pdf-parse`
- **Icons**: Lucide React

## Project Structure

```txt
app/
  api/                     API routes for auth, chat, personas, sessions, and learning sources
  app/page.tsx             Authenticated app shell
  components/ChatWindow.tsx Main workspace UI
  page.tsx                 Landing page
components/ui/             Local UI primitives
lib/
  auth.ts                  Better Auth configuration
  db/                      Drizzle schema and database client
  learning/                PDF/transcript extraction, chunking, retrieval
  llm/                     OpenRouter client
  personas/                Built-in personas, prompt builder, validation, source memory
scripts/
  seedPersonas.ts          Seeds built-in Hitesh and Piyush personas
drizzle/                   Database migrations
docs/                      Local transcript/reference material
```

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL database
- pgvector extension available in PostgreSQL
- OpenRouter API key for app-level AI usage or personal-key usage in the UI

The migrations include `CREATE EXTENSION IF NOT EXISTS vector;`, but your database user must have permission to create extensions. If not, enable pgvector manually before running migrations.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env
```

3. Fill in at least:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/personaai
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://localhost:3000
OPENROUTER_API_KEY=sk-or-your-key
OPENROUTER_MODEL=openai/gpt-4o
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_TITLE=PersonaAI
```

4. Run database migrations:

```bash
npm run db:migrate
```

5. Seed the built-in personas:

```bash
npm run db:seed
```

6. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Drizzle and Better Auth. |
| `BETTER_AUTH_SECRET` | Production | Secret for Better Auth. Local dev falls back to a placeholder, but production must set this. |
| `BETTER_AUTH_URL` | Recommended | Base URL for Better Auth callbacks and session handling. |
| `GITHUB_CLIENT_ID` | Optional | Enables GitHub login when paired with `GITHUB_CLIENT_SECRET`. |
| `GITHUB_CLIENT_SECRET` | Optional | Enables GitHub login when paired with `GITHUB_CLIENT_ID`. |
| `OPENROUTER_API_KEY` | Optional but recommended | Server-side app API key. Required if users should be able to use the app-paid key mode. |
| `OPENROUTER_MODEL` | Optional | Server default chat model. Defaults to `openai/gpt-4o`. |
| `OPENROUTER_MODEL_OPTIONS` | Optional | Comma-separated curated model IDs for personal-key model selection. |
| `OPENROUTER_SUMMARY_MODEL` | Optional | Model override for summary/title helper calls. |
| `OPENROUTER_EMBEDDING_MODEL` | Optional | Embedding model override. Defaults to `openai/text-embedding-3-small`. |
| `OPENROUTER_SITE_URL` | Optional | Sent to OpenRouter as `HTTP-Referer`. |
| `OPENROUTER_APP_TITLE` | Optional | Sent to OpenRouter as `X-OpenRouter-Title`. |

## AI Key and Model Behavior

PersonaAI supports two AI usage modes in Settings:

- **Use App API Key**: requests use the server-configured `OPENROUTER_API_KEY` and the server default model, expected to be `openai/gpt-4o`.
- **Use My API Key**: users store an OpenRouter key in their browser and can choose from curated model options or enter a custom OpenRouter model ID.

Personal keys are stored in browser localStorage and sent only with AI requests when personal-key mode is selected.

## Database Commands

```bash
npm run db:generate   # Generate Drizzle migrations from schema changes
npm run db:migrate    # Apply migrations
npm run db:push       # Push schema directly, useful for local iteration
npm run db:check      # Validate migration/schema state
npm run db:studio     # Open Drizzle Studio
npm run db:seed       # Seed built-in personas
```

## Built-In Personas

The built-in personas live in `lib/personas/`:

- `hitesh.json`: practical chai-style coding mentor, written in English-script Hinglish.
- `piyush.json`: systems-minded AI engineering educator, English-heavy Hinglish with architecture focus.

After changing built-in persona JSON, run:

```bash
npm run db:seed
```

That upserts the built-in persona records into the database.

## Persona Generation

Custom personas can be generated from:

- YouTube transcripts
- WhatsApp-style chat exports
- Other pasted text

Generation modes:

- **Compact**: faster, smaller persona profile.
- **Detailed**: richer behavior and examples.
- **High fidelity**: chunked analysis plus source memory payload for better retrieval-backed persona context.

The generated persona schema supports voice profile, language profile, reasoning profile, phrase banks, do/don't rules, scenario examples, style confidence, source kind, and speaker metadata.

## Study Library

The learning workspace supports:

- Text-based PDF upload
- Podcast transcript paste
- Source chunking
- Embeddings
- Source-grounded chat
- Citation metadata attached to learning answers

Learning source data is stored in:

- `learning_sources`
- `learning_source_chunks`
- `learning_sessions`
- `learning_messages`

## Development Scripts

```bash
npm run dev       # Start the Next.js dev server
npm run build     # Build for production
npm run start     # Start the production server
npm run lint      # Run ESLint
```

Recommended verification before committing:

```bash
npm run lint
npm exec tsc -- --noEmit
```

## Common Workflows

### Add or refine a built-in persona

1. Edit the persona JSON in `lib/personas/`.
2. Validate JSON syntax.
3. Run `npm run db:seed`.
4. Start the app and test representative prompts.

### Add a new database-backed feature

1. Update `lib/db/schema.ts`.
2. Run `npm run db:generate`.
3. Review the generated migration.
4. Run `npm run db:migrate`.
5. Add or update API routes and UI.

### Test source-grounded learning

1. Sign in.
2. Open the Study Library.
3. Upload a text-based PDF or paste a podcast transcript.
4. Ask questions that should require source retrieval.
5. Confirm citations appear on relevant assistant replies.

## Notes and Constraints

- PDF support expects text-based PDFs. Scanned image PDFs may not extract useful text.
- Embeddings are normalized to 1536 dimensions in the LLM client.
- pgvector indexes are created by migrations for persona memory and learning source chunks.
- Built-in persona transcript material in `docs/` is reference material and is not automatically used at runtime.
- The app is private by default: data is scoped to the signed-in user.

## Roadmap Ideas

- Full markdown rendering with a mature parser.
- Shiki-based syntax highlighting.
- Persona evaluation prompts and regression tests.
- Better source preview for citations.
- Importers for more transcript formats.
- Admin tools for managing built-in personas.

## License

No license has been declared yet. Add one before distributing or accepting external contributions.

---

Made with ❤️ by DT89
