ALTER TABLE "sessions" ADD COLUMN "title" text DEFAULT 'New chat' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
CREATE INDEX "sessions_user_updated_at_idx" ON "sessions" ("user_id","updated_at");