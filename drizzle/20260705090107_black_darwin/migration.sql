CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"system_prompt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"persona_id" text NOT NULL,
	"memory_summary" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "messages_session_id_idx" ON "messages" ("session_id");--> statement-breakpoint
CREATE INDEX "messages_session_created_at_idx" ON "messages" ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "sessions_persona_id_idx" ON "sessions" ("persona_id");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_persona_id_personas_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id");