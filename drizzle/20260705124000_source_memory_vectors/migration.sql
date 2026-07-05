CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "persona_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "persona_id" text NOT NULL,
  "user_id" text,
  "source_type" text NOT NULL,
  "target_speaker" text,
  "user_speaker" text,
  "source_chars" integer DEFAULT 0 NOT NULL,
  "chunk_count" integer DEFAULT 0 NOT NULL,
  "metadata_json" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
CREATE TABLE "persona_memory_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "persona_id" text NOT NULL,
  "source_id" uuid NOT NULL,
  "user_id" text,
  "chunk_index" integer NOT NULL,
  "speaker" text,
  "text" text NOT NULL,
  "token_hint" integer DEFAULT 0 NOT NULL,
  "metadata_json" jsonb DEFAULT '{}',
  "embedding" vector(1536),
  "created_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "persona_sources" ADD CONSTRAINT "persona_sources_persona_id_personas_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "persona_sources" ADD CONSTRAINT "persona_sources_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "persona_memory_chunks" ADD CONSTRAINT "persona_memory_chunks_persona_id_personas_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personas"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "persona_memory_chunks" ADD CONSTRAINT "persona_memory_chunks_source_id_persona_sources_id_fkey" FOREIGN KEY ("source_id") REFERENCES "persona_sources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "persona_memory_chunks" ADD CONSTRAINT "persona_memory_chunks_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE INDEX "persona_sources_persona_id_idx" ON "persona_sources" ("persona_id");--> statement-breakpoint
CREATE INDEX "persona_sources_user_id_idx" ON "persona_sources" ("user_id");--> statement-breakpoint
CREATE INDEX "persona_memory_chunks_persona_id_idx" ON "persona_memory_chunks" ("persona_id");--> statement-breakpoint
CREATE INDEX "persona_memory_chunks_source_id_idx" ON "persona_memory_chunks" ("source_id");--> statement-breakpoint
CREATE INDEX "persona_memory_chunks_user_id_idx" ON "persona_memory_chunks" ("user_id");--> statement-breakpoint
CREATE INDEX "persona_memory_chunks_embedding_idx" ON "persona_memory_chunks" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
