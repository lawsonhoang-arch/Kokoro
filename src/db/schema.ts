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
  // public profile bio (markdown-free plain text)
  bio: text("bio").notNull().default(""),
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
  title: text("title").notNull(), // romaji / original title
  englishTitle: text("english_title"), // preferred for display when present
  year: integer("year").notNull(),
  season: text("season"), // winter | spring | summer | fall (anime only)
  status: text("status"), // finished | ongoing | upcoming (anime only)
  nsfw: boolean("nsfw").notNull().default(false), // adult/explicit — hidden on Home
  genres: text("genres").array().notNull().default([]),
  // for manga this counts chapters rather than episodes
  episodes: integer("episodes").notNull().default(0),
  seasons: integer("seasons").notNull().default(1),
  // enrichment from AniList (nullable; seed rows leave these empty)
  nativeTitle: text("native_title"),
  cover: text("cover"),
  // wide hero/banner art (AniList bannerImage). '' = checked, none available;
  // null = not yet enriched. Falls back to `cover` when absent.
  banner: text("banner"),
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
    // extra rating axes shared by every title in this list (beyond the fixed
    // story/art/music/pacing) — an array of axis names
    customAxes: jsonb("custom_axes").notNull().default([]),
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
    // how the user rates this title: glyphs (feeling) | axes (dims) | symbols
    rateMode: text("rate_mode").notNull().default("glyphs"),
    // symbols rating, when rateMode = symbols: { style: stars|grades|emoji, value }
    symbol: jsonb("symbol"),
    // `progress` = number of episodes watched (= watchedEps length); kept for
    // the progress bars / quick-bump. `watchedEps` = the specific episode numbers
    // the user marked watched (granular per-episode tracking).
    progress: integer("progress"),
    watchedEps: integer("watched_eps").array().notNull().default([]),
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

// Editorial picks shown on the Home page — managed from the in-app editor
// (/editorial) by moderators/admins, so they can be updated without code.
export const editorialPicks = pgTable(
  "editorial_picks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kicker: text("kicker").notNull().default(""),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    hue: integer("hue").notNull().default(1), // 1 blue · 2 orange · 3 purple
    avatarHue: integer("avatar_hue").notNull().default(2),
    byline: text("byline").notNull().default(""),
    href: text("href"), // optional link the card opens
    cover: text("cover"), // optional image (else a generated gradient)
    position: integer("position").notNull().default(0),
    published: boolean("published").notNull().default(true),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("editorial_position_idx").on(t.position)],
);

// Steam-style event banner shown full-bleed at the top of Home. Managed from
// the in-app editor (/events) by moderators/admins. Only the top active banner
// that's within its optional schedule window is shown.
export const eventBanners = pgTable(
  "event_banners",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // "manual" (admin override) | "auto-premiere" | "auto-season" — render
    // priority: manual > auto-premiere > auto-season
    source: text("source").notNull().default("manual"),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    ctaLabel: text("cta_label").notNull().default(""),
    ctaHref: text("cta_href"),
    image: text("image"), // background art URL
    accent: text("accent"), // optional CSS color for the CTA/glow (else app accent)
    active: boolean("active").notNull().default(false),
    startsAt: timestamp("starts_at"), // optional schedule window
    endsAt: timestamp("ends_at"),
    position: integer("position").notNull().default(0),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("event_banners_active_idx").on(t.active)],
);

// News briefing stories shown on /news. Curated by moderators in /news/admin.
// `position` is prominence — the lowest (0) is the lead story, and prominence
// decreases as it grows, so smaller stories sit further down the page.
export const newsStories = pgTable(
  "news_stories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    category: text("category").notNull().default("Industry"), // Industry | Releases | Adaptations | Interviews
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    source: text("source").notNull().default(""),
    href: text("href"), // optional outbound link
    cover: text("cover"), // optional art URL (else a hue gradient)
    hue: integer("hue").notNull().default(1), // 1–8, drives the gradient art
    publishedAt: timestamp("published_at").notNull().defaultNow(),
    position: integer("position").notNull().default(0), // prominence: lower = bigger / higher up
    published: boolean("published").notNull().default(true),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("news_position_idx").on(t.position)],
);

// A user's private journal — time-ordered notes, optionally about a catalog
// title (titleId), with an episode marker, feeling, and an optional saved quote.
export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: text("title_id").references(() => titles.id, { onDelete: "set null" }),
    episode: text("episode").notNull().default(""), // free-text marker e.g. "EP 17"
    isTake: boolean("is_take").notNull().default(false), // the title's overall "take" (mirrors watchlist entry)
    heading: text("heading").notNull().default(""), // optional note title (auto-derived if blank)
    // rating — mirrors watchlist entries: pick a method per note
    rateMode: text("rate_mode").notNull().default("glyphs"), // glyphs | axes | symbols
    feeling: text("feeling"), // loved | liked | mixed | dropped | null  (glyphs)
    symbol: jsonb("symbol"), // { style: stars|grades|emoji, value }       (symbols)
    dims: jsonb("dims").notNull().default({ story: 0, art: 0, music: 0, pacing: 0 }), // (axes)
    quote: text("quote").notNull().default(""),
    body: text("body").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("journal_user_idx").on(t.userId)],
);

// A title the user marked watched/done WITHOUT adding it to a list. Counts
// toward profile stats (completed / episodes / hours) just like a list entry.
export const completions = pgTable(
  "completions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: text("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.titleId] })],
);

// Titles the user has hand-picked as favorites (manually curated, independent
// of list ratings) — shown on their profile.
export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: text("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.titleId] })],
);

// ============================================================
// COMMUNITY — a public "subreddit" per title: discussions + reviews, with
// likes and replies. Posts may be episode-tagged (mirrors the journal's "EP n").
// ============================================================
export const communityPosts = pgTable(
  "community_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // the title this post belongs to (its community/subreddit)
    titleId: text("title_id").references(() => titles.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("discussion"), // discussion | review
    episode: text("episode").notNull().default(""), // free-text marker e.g. "EP 12"
    heading: text("heading").notNull().default(""), // thread title / review headline
    body: text("body").notNull().default(""),
    // review rating — mirrors the journal/watchlist "rate it your way" model
    rateMode: text("rate_mode").notNull().default("glyphs"), // glyphs | axes | symbols
    feeling: text("feeling"), // loved | liked | mixed | dropped (glyphs)
    symbol: jsonb("symbol"), // { style: stars|grades|emoji, value } (symbols)
    dims: jsonb("dims").notNull().default({ story: 0, art: 0, music: 0, pacing: 0 }), // (axes)
    rating: integer("rating"), // legacy quick-stars (kept for back-compat; unused)
    spoiler: boolean("spoiler").notNull().default(false),
    // denormalized engagement counts kept in sync on like/reply
    likeCount: integer("like_count").notNull().default(0),
    replyCount: integer("reply_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("community_posts_title_idx").on(t.titleId),
    index("community_posts_created_idx").on(t.createdAt),
  ],
);

export const communityLikes = pgTable(
  "community_likes",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

export const communityReplies = pgTable(
  "community_replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("community_replies_post_idx").on(t.postId)],
);

export type DbUser = typeof users.$inferSelect;
export type DbEditorialPick = typeof editorialPicks.$inferSelect;
export type DbEventBanner = typeof eventBanners.$inferSelect;
export type DbNewsStory = typeof newsStories.$inferSelect;
export type DbJournalEntry = typeof journalEntries.$inferSelect;
export type DbWatchlist = typeof watchlists.$inferSelect;
export type DbTitle = typeof titles.$inferSelect;
export type DbSubmission = typeof descriptionSubmissions.$inferSelect;
export type DbCommunityPost = typeof communityPosts.$inferSelect;
export type DbCommunityReply = typeof communityReplies.$inferSelect;
