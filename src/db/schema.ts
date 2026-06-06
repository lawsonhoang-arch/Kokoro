import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  uuid,
  jsonb,
  primaryKey,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ============================================================
// AUTH.JS TABLES (Drizzle adapter shape + a passwordHash for the
// Credentials provider). accounts/sessions/verificationTokens are kept so
// adding OAuth/email later is a config-only change.
// ============================================================
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  // public handle; required (auto-generated if the user leaves it blank)
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  // null for OAuth-only users; set for email/password sign-ups
  passwordHash: text("password_hash"),
  // user | moderator | admin — gates the description review queue
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ============================================================
// WATCHLIST DATA MODEL
// ============================================================

// The shared anime catalog. Seeded titles use slug ids ("frieren"); titles
// added from search use the AniList id as a string ("anilist:16498").
export const titles = pgTable("titles", {
  id: text("id").primaryKey(),
  // "anime" | "manga" — the same catalog/search/ratings system serves both.
  kind: text("kind").notNull().default("anime"),
  title: text("title").notNull(),
  year: integer("year").notNull(),
  genres: text("genres").array().notNull().default([]),
  // for manga this counts chapters rather than episodes
  episodes: integer("episodes").notNull().default(0),
  seasons: integer("seasons").notNull().default(1),
  // enrichment from AniList (nullable; seed rows leave these empty)
  nativeTitle: text("native_title"),
  cover: text("cover"),
  description: text("description"),
  format: text("format"),
  score: integer("score"), // catalog score ×100 (MAL), for ranking/filtering
  // MyAnimeList id (anime only) — used to attach Jikan rankings to catalog rows
  malId: integer("mal_id"),
  // popularity signal (member count) — powers the "Trending" shelf
  popularity: integer("popularity"),
  // community description: who authored the currently-live description
  descriptionAuthorId: uuid("description_author_id").references(() => users.id, {
    onDelete: "set null",
  }),
  // lowercased title + synonyms, for the self-hosted pg_trgm search index
  searchText: text("search_text"),
});

// A user's watchlist (one card in the gallery).
export const watchlists = pgTable(
  "watchlists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    hue: text("hue").notNull().default("warm"),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastEditedAt: timestamp("last_edited_at").notNull().defaultNow(),
  },
  (t) => [index("watchlists_user_idx").on(t.userId)],
);

// A manual collection (tab/group) inside a watchlist; may nest via parentId.
export const groups = pgTable(
  "groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    watchlistId: uuid("watchlist_id")
      .notNull()
      .references(() => watchlists.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("New collection"),
    parentId: uuid("parent_id").references((): AnyPgColumn => groups.id, {
      onDelete: "cascade",
    }),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("groups_watchlist_idx").on(t.watchlistId)],
);

// A title placed in a watchlist, with the user's per-title data.
export const watchlistEntries = pgTable(
  "watchlist_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    watchlistId: uuid("watchlist_id")
      .notNull()
      .references(() => watchlists.id, { onDelete: "cascade" }),
    titleId: text("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    // belongs to at most one collection (matches the app's model)
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
    status: text("status").notNull().default("planned"), // watching | completed | planned
    feeling: text("feeling"), // loved | liked | mixed | dropped | null
    progress: integer("progress"),
    watchedAt: text("watched_at"),
    take: text("take").notNull().default(""),
    dims: jsonb("dims").notNull().default({ story: 0, art: 0, music: 0, pacing: 0 }),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("entries_watchlist_idx").on(t.watchlistId)],
);

// Global (groupId null) or collection-scoped rule tokens.
export const rules = pgTable(
  "rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    watchlistId: uuid("watchlist_id")
      .notNull()
      .references(() => watchlists.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    category: text("category").notNull(), // group | sort | color | tag
    ruleKey: text("rule_key").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("rules_watchlist_idx").on(t.watchlistId)],
);

// Community-submitted descriptions, moderated before going live (the
// AniList-style contribution model — descriptions are written by users, not
// borrowed). Approving one copies its body onto titles.description.
export const descriptionSubmissions = pgTable(
  "description_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    titleId: text("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at"),
  },
  (t) => [index("submissions_status_idx").on(t.status), index("submissions_title_idx").on(t.titleId)],
);

export type DbUser = typeof users.$inferSelect;
export type DbWatchlist = typeof watchlists.$inferSelect;
export type DbTitle = typeof titles.$inferSelect;
export type DbSubmission = typeof descriptionSubmissions.$inferSelect;
