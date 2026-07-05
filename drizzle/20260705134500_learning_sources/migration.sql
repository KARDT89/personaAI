CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "learning_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "source_kind" text NOT NULL,
  "original_filename" text,
  "source_chars" integer DEFAULT 0 NOT NULL,
  "page_count" integer,
  "chunk_count" integer DEFAULT 0 NOT NULL,
  "metadata_json" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
CREATE TABLE "learning_source_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "chunk_index" integer NOT NULL,
  "page_start" integer,
  "page_end" integer,
  "text" text NOT NULL,
  "token_hint" integer DEFAULT 0 NOT NULL,
  "metadata_json" jsonb DEFAULT '{}',
  "embedding" vector(1536),
  "created_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
CREATE TABLE "learning_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "title" text DEFAULT 'New chat' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
CREATE TABLE "learning_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "citations_json" jsonb DEFAULT '[]',
  "created_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "learning_sources" ADD CONSTRAINT "learning_sources_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "learning_source_chunks" ADD CONSTRAINT "learning_source_chunks_source_id_learning_sources_id_fkey" FOREIGN KEY ("source_id") REFERENCES "learning_sources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "learning_source_chunks" ADD CONSTRAINT "learning_source_chunks_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_source_id_learning_sources_id_fkey" FOREIGN KEY ("source_id") REFERENCES "learning_sources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "learning_messages" ADD CONSTRAINT "learning_messages_session_id_learning_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX "learning_sources_user_id_idx" ON "learning_sources" ("user_id");--> statement-breakpoint
CREATE INDEX "learning_sources_user_updated_at_idx" ON "learning_sources" ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "learning_source_chunks_source_id_idx" ON "learning_source_chunks" ("source_id");--> statement-breakpoint
CREATE INDEX "learning_source_chunks_user_id_idx" ON "learning_source_chunks" ("user_id");--> statement-breakpoint
CREATE INDEX "learning_source_chunks_embedding_idx" ON "learning_source_chunks" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);--> statement-breakpoint
CREATE INDEX "learning_sessions_source_id_idx" ON "learning_sessions" ("source_id");--> statement-breakpoint
CREATE INDEX "learning_sessions_user_id_idx" ON "learning_sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "learning_sessions_user_updated_at_idx" ON "learning_sessions" ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "learning_messages_session_id_idx" ON "learning_messages" ("session_id");--> statement-breakpoint
CREATE INDEX "learning_messages_session_created_at_idx" ON "learning_messages" ("session_id","created_at");
