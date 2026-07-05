import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
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

export const personaSources = pgTable(
  "persona_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personaId: text("persona_id")
      .notNull()
      .references(() => personas.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    targetSpeaker: text("target_speaker"),
    userSpeaker: text("user_speaker"),
    sourceChars: integer("source_chars").default(0).notNull(),
    chunkCount: integer("chunk_count").default(0).notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("persona_sources_persona_id_idx").on(table.personaId),
    index("persona_sources_user_id_idx").on(table.userId),
  ],
);

export const personaMemoryChunks = pgTable(
  "persona_memory_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personaId: text("persona_id")
      .notNull()
      .references(() => personas.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => personaSources.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    speaker: text("speaker"),
    text: text("text").notNull(),
    tokenHint: integer("token_hint").default(0).notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("persona_memory_chunks_persona_id_idx").on(table.personaId),
    index("persona_memory_chunks_source_id_idx").on(table.sourceId),
    index("persona_memory_chunks_user_id_idx").on(table.userId),
  ],
);

export const learningSources = pgTable(
  "learning_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sourceKind: text("source_kind").notNull(),
    originalFilename: text("original_filename"),
    sourceChars: integer("source_chars").default(0).notNull(),
    pageCount: integer("page_count"),
    chunkCount: integer("chunk_count").default(0).notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("learning_sources_user_id_idx").on(table.userId),
    index("learning_sources_user_updated_at_idx").on(table.userId, table.updatedAt),
  ],
);

export const learningSourceChunks = pgTable(
  "learning_source_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => learningSources.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    pageStart: integer("page_start"),
    pageEnd: integer("page_end"),
    text: text("text").notNull(),
    tokenHint: integer("token_hint").default(0).notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("learning_source_chunks_source_id_idx").on(table.sourceId),
    index("learning_source_chunks_user_id_idx").on(table.userId),
  ],
);

export const learningSessions = pgTable(
  "learning_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => learningSources.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").default("New chat").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("learning_sessions_source_id_idx").on(table.sourceId),
    index("learning_sessions_user_id_idx").on(table.userId),
    index("learning_sessions_user_updated_at_idx").on(table.userId, table.updatedAt),
  ],
);

export const learningMessages = pgTable(
  "learning_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => learningSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    citationsJson: jsonb("citations_json")
      .$type<Array<{ label: string; sourceId: string; chunkIndex: number }>>()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("learning_messages_session_id_idx").on(table.sessionId),
    index("learning_messages_session_created_at_idx").on(table.sessionId, table.createdAt),
  ],
);

export type Persona = typeof personas.$inferSelect;
export type NewPersona = typeof personas.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type PersonaSource = typeof personaSources.$inferSelect;
export type NewPersonaSource = typeof personaSources.$inferInsert;
export type PersonaMemoryChunk = typeof personaMemoryChunks.$inferSelect;
export type NewPersonaMemoryChunk = typeof personaMemoryChunks.$inferInsert;
export type LearningSource = typeof learningSources.$inferSelect;
export type NewLearningSource = typeof learningSources.$inferInsert;
export type LearningSourceChunk = typeof learningSourceChunks.$inferSelect;
export type NewLearningSourceChunk = typeof learningSourceChunks.$inferInsert;
export type LearningSession = typeof learningSessions.$inferSelect;
export type NewLearningSession = typeof learningSessions.$inferInsert;
export type LearningMessage = typeof learningMessages.$inferSelect;
export type NewLearningMessage = typeof learningMessages.$inferInsert;
