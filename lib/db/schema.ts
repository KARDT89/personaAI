import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { PersonaData } from "@/lib/personas/promptBuilder";

import { user } from "./auth-schema";

export const personas = pgTable("personas", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  personaJson: jsonb("persona_json").$type<PersonaData>(),
  ownerUserId: text("owner_user_id").references(() => user.id, {
    onDelete: "cascade",
  }),
  isBuiltIn: boolean("is_built_in").default(false).notNull(),
  avatarUrl: text("avatar_url"),
  tagline: text("tagline"),
  bio: text("bio"),
  topicsJson: jsonb("topics_json").$type<string[]>().default([]),
  starterPromptsJson: jsonb("starter_prompts_json").$type<string[]>().default([]),
  sourceCount: integer("source_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    personaId: text("persona_id")
      .notNull()
      .references(() => personas.id),
    title: text("title").default("New chat").notNull(),
    memorySummary: text("memory_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("sessions_persona_id_idx").on(table.personaId),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_user_updated_at_idx").on(table.userId, table.updatedAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("messages_session_id_idx").on(table.sessionId),
    index("messages_session_created_at_idx").on(table.sessionId, table.createdAt),
  ],
);

export type Persona = typeof personas.$inferSelect;
export type NewPersona = typeof personas.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
