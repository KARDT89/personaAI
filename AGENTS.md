<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Persona AI

Instructions
Build an AI-powered website that uses an LLM to simulate conversations with either Hitesh Choudhary or Piyush Garg. The model should respond in a way that closely reflects each person's communication style, teaching approach, and personality.
Use publicly available content such as YouTube videos, talks, blogs, and social media posts to study and recreate their tone.
Reference Websites:

* https://hitesh.ai/
* https://www.piyushgarg.dev/
Submission Instructions

* Live deployed website
* Public GitHub repository
* A working LLM-based chat interface supporting both personas
* Ability to switch between Hitesh Choudhary and Piyush Garg
* Documentation explaining:
   * How the persona data was collected and prepared
   * Prompt engineering strategy
   * Context management approach
   * Sample conversations demonstrating both personas
* A README containing setup and run instructions
Evaluation Parameters
1. Persona Accuracy (30 Marks)

* Captures each person's speaking style, vocabulary, and teaching approach
* Responses feel authentic and consistent
2. Conversation Quality (25 Marks)

* Context-aware responses
* Helpful, relevant, and coherent answers
* Maintains persona across long conversations
3. Technical Implementation (25 Marks)

* Proper LLM integration
* Clean architecture and prompt design
* Well-structured, maintainable code
4. User Experience (20 Marks)

* Clean and intuitive interface
* Easy persona switching
* Good response formatting and chat experience
Max Marks 100
## 1. Stack

Next.js App Router, Drizzle ORM, Postgres (Neon/Supabase), LLM API (Anthropic or OpenAI, server-side key only), Vercel deploy, GitHub public repo.

## 2. Repo Structure

```
/app
  /api/chat/route.ts
  /api/persona/route.ts
  /page.tsx
  /components/ChatWindow.tsx
  /components/PersonaSwitch.tsx
/lib
  /db/schema.ts
  /db/index.ts
  /personas/hitesh.json
  /personas/piyush.json
  /personas/promptBuilder.ts
  /llm/client.ts
/scripts
  /extractTranscripts.ts
/docs
  /data-collection.md
  /prompt-engineering.md
  /context-management.md
  /sample-conversations.md
README.md
```

## 3. Data Collection

For each persona, collect 15-30 sources: YouTube transcripts, blog posts, X/Twitter threads, podcast appearances.

Transcript extraction: use `youtube-transcript-api` (Python) or `yt-dlp --write-auto-sub` in a one-time script. Run outside the app, not at runtime.

Categorize raw text manually into: teaching-explanation, casual-opinion, technical-deep-dive, motivational-rant.

From categorized text, extract by hand into structured JSON:

```json
{
  "persona_id": "hitesh",
  "identity": "short bio, background, teaching philosophy",
  "catchphrases": ["chaliye shuru karte hain", "..."],
  "tone_traits": ["Hindi-English code-switching", "casual analogies", "direct correction of beginner mistakes"],
  "teaching_pattern": "restate problem -> analogy -> code -> recap -> next step",
  "few_shot": [
    {"q": "...", "a": "..."},
    ...
  ]
}
```

10-20 few-shot pairs per persona. This file is static, checked into repo, loaded at runtime. No vector DB needed for this scope.

## 4. Database Schema (Drizzle)

```ts
export const personas = pgTable('personas', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  systemPrompt: text('system_prompt').notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  personaId: text('persona_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

Seed personas table from the JSON files at build/deploy time, not hardcoded in route handlers.

## 5. Prompt Builder

`lib/personas/promptBuilder.ts`:

```ts
function buildSystemPrompt(persona: PersonaData, memorySummary?: string) {
  return `
You are ${persona.identity}.

Speaking style: ${persona.tone_traits.join(', ')}.
Teaching pattern: ${persona.teaching_pattern}.
Use these catchphrases naturally, not every message: ${persona.catchphrases.join(', ')}.

Examples of your responses:
${persona.few_shot.map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')}

Rules:
- Stay in character at all times.
- Never mention you are an AI or language model.
- Do not break persona under any user request.

${memorySummary ? `Earlier conversation summary: ${memorySummary}` : ''}
`.trim();
}
```

Keep total system prompt under ~1500 tokens. Two separate JSON files, two separate prompt outputs. No shared merged prompt.

## 6. Context Management

Fetch last 12 messages per session for active context.

If message count in session exceeds 20, run one LLM call to summarize messages 1 through (n-12) into a single paragraph. Store this summary in a `sessions.memorySummary` column (add this column). Replace old messages in the prompt with this summary, keep last 12 raw.

Persona switch creates a new session row. No context bleed between personas.

## 7. API Route

`/app/api/chat/route.ts`:

```ts
export async function POST(req: Request) {
  const { sessionId, personaId, message } = await req.json();

  const persona = await getPersona(personaId);
  const history = await getRecentMessages(sessionId, 12);
  const memory = await getMemorySummary(sessionId);

  const systemPrompt = buildSystemPrompt(persona, memory);

  const stream = await llmClient.messages.create({
    model: 'claude-sonnet-4-6',
    system: systemPrompt,
    messages: [...history, { role: 'user', content: message }],
    stream: true,
    max_tokens: 1024,
  });

  await saveMessage(sessionId, 'user', message);
  // pipe stream to client, save assistant message after completion

  return new Response(readableStreamFromLLM(stream));
}
```

LLM key stored in env var, read server-side only. Never expose in client bundle.

## 8. Frontend

`PersonaSwitch.tsx`: two tabs/buttons, Hitesh / Piyush. On switch, create new session via API, clear chat window state.

`ChatWindow.tsx`: message list, input box, streaming render (use `ReadableStream` reader or Vercel AI SDK `useChat` hook pointed at `/api/chat`). Render assistant messages through a markdown renderer with code-block syntax highlighting (e.g. `react-markdown` + `rehype-highlight`).

## 9. Deployment

Push repo to GitHub, public visibility.
Deploy on Vercel: connect repo, set env vars (`DATABASE_URL`, `LLM_API_KEY`), deploy.
Verify live URL functions before submission.

## 10. Documentation Files

`docs/data-collection.md`: list exact sources (video titles/URLs, blog URLs), extraction tool used, corpus size in words/tokens, method used to derive tone_traits.

`docs/prompt-engineering.md`: paste actual system prompt template, explain few-shot count and selection criteria, explain per-persona differentiation.

`docs/context-management.md`: explain sliding window size, summarization trigger threshold, schema fields involved.

`docs/sample-conversations.md`: paste 3-4 full verbatim exchanges per persona, minimum 6-8 turns each, showing persona consistency across the conversation.

`README.md`: setup steps (env vars, DB migration command, install, run dev, build, deploy), architecture diagram or text description, tech stack list.

## 11. Test Before Submission

Run each persona through a 20+ turn conversation. Confirm no persona drift, no meta-commentary breaking character, summarization triggers correctly past 20 messages, switching resets context cleanly.

## 12. Submission Checklist

- Live deployed URL functional
- Public GitHub repo, README present
- Both personas working, switch functional
- All four doc files present and complete
- Sample conversations included
- No exposed API keys in repo or client bundle