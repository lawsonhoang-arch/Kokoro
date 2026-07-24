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
  uniqueIndex,
  customType,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// raw binary column (Postgres bytea) — postgres.js round-trips it as a Buffer
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

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
  // catalog title id whose art fills the profile banner (null = default gradient).
  // plain text (no FK) so a deleted title just falls back to the default.
  bannerTitleId: text("banner_title_id"),
  // CSS background-position for the banner art ("x% y%"), so users can shift the
  // art to frame its key area. null = the default framing.
  bannerPos: text("banner_pos"),
  // when the user finished the first-run onboarding flow. null = not yet onboarded
  // (new sign-ups); existing accounts are backfilled to now() so they skip it.
  onboardedAt: timestamp("onboarded_at"),
  // focus areas the user picked in onboarding ("what do you want to track most?").
  // Drives Home shelf order on desktop and which shelves show on mobile. null/[] =
  // the default order. Values are keys from HOME_FOCUS (seasonal, manga, …).
  homeFocus: text("home_focus").array(),
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
  // franchise key linking a manga to its anime adaptation(s) (and vice versa),
  // so they can share one community. Filled by `db:link-adaptations` from Jikan
  // relations; null when unlinked. Titles with the same seriesId are one series.
  seriesId: text("series_id"),
}, (t) => [
  // studio/person/character pages map Jikan works back to our catalog by MAL id;
  // without this the lookup seq-scans all ~43k titles (run `db:setup-title-mal-index`)
  index("titles_mal_idx").on(t.malId),
]);

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
    // Bookmarked tab strip — the ordered tab keys ("all", "g:<uuid>", …). Stored
    // server-side so bookmarks follow you between mobile and desktop. null =
    // fall back to the default (Board + every top-level collection).
    tabOrder: text("tab_order").array(),
    // the Board tab's label (was localStorage-only, so it didn't travel)
    boardName: text("board_name"),
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
    onHome: boolean("on_home").notNull().default(true), // show in the Home news carousel
    layout: text("layout").notNull().default("card"), // news-tab placement: card | list
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

// A user following an entity that lives outside our catalog (a studio, a person
// — voice actor / staff, or a character). These come from Jikan (MAL), so we
// snapshot the display fields here rather than joining a catalog table.
export const entityFollows = pgTable(
  "entity_follows",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // studio | person | character
    entityId: text("entity_id").notNull(), // MAL id (as text)
    name: text("name").notNull(),
    image: text("image"),
    subtitle: text("subtitle").notNull().default(""), // e.g. "Voice actor", "Studio"
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.kind, t.entityId] }),
    index("entity_follows_user_idx").on(t.userId),
  ],
);

// Bell notifications: someone liked/replied to your post, or recommended you a
// title. `key` is the dedup handle (the post id for like/reply, the title id for
// a recommendation) so re-triggering just bumps the existing one unread.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // recipient
    actorId: uuid("actor_id").notNull().references(() => users.id, { onDelete: "cascade" }), // who triggered it
    type: text("type").notNull(), // like | reply | recommend
    key: text("key").notNull(), // dedup key: postId (like/reply) or titleId (recommend)
    postId: uuid("post_id").references(() => communityPosts.id, { onDelete: "cascade" }),
    titleId: text("title_id").references(() => titles.id, { onDelete: "cascade" }),
    note: text("note").notNull().default(""),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.createdAt),
    uniqueIndex("notifications_dedup_idx").on(t.userId, t.actorId, t.type, t.key),
  ],
);

// Each row = one rewatch (anime) / reread (manga) pass the user logged for a
// title. The count of rows is how many times they've been back; the original
// watch isn't stored here (it's the completion / watchlist entry).
export const rewatches = pgTable(
  "rewatches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: text("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("rewatches_user_title_idx").on(t.userId, t.titleId)],
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
// CALENDAR
// ============================================================

// Curated calendar entries: major anime events (conventions like Anime Expo)
// and hand-picked premieres of highly anticipated titles. Managed in-app at
// /calendar/admin by moderators/admins (mirrors editorial / news).
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull().default("event"), // event | premiere
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    // date-only (mode:"string" -> "YYYY-MM-DD") so calendar math is timezone-safe.
    startsOn: text("starts_on").notNull(), // event date / premiere date
    endsOn: text("ends_on"), // multi-day events (conventions); null = single day
    location: text("location").notNull().default(""), // conventions
    url: text("url"), // optional outbound link
    cover: text("cover"), // optional art (else a hue gradient)
    accent: text("accent"), // optional CSS color for the chip/glow
    // optional link to a catalog title (premieres) — powers "add to list" etc.
    titleId: text("title_id").references(() => titles.id, { onDelete: "set null" }),
    hue: integer("hue").notNull().default(1), // 1–6, drives the gradient when no cover
    position: integer("position").notNull().default(0),
    published: boolean("published").notNull().default(true),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("calendar_events_start_idx").on(t.startsOn)],
);

// A user is "tracking" an ongoing anime: its weekly episode releases appear on
// the calendar. `weekday` (0=Sun … 6=Sat) + `time` are fetched once from Jikan
// when the user starts tracking, so no global broadcast sync is needed.
export const calendarTracks = pgTable(
  "calendar_tracks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: text("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    malId: integer("mal_id"), // cached for the Jikan broadcast lookup
    weekday: integer("weekday"), // 0=Sun … 6=Sat; null if unknown / not airing
    time: text("time"), // broadcast time e.g. "23:00" (JST); null if unknown
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

// Directed social graph: `follower_id` follows `following_id` (like AniList /
// Twitter — not mutual by default; a mutual pair is surfaced as "friends").
export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: uuid("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("follows_following_idx").on(t.followingId),
  ],
);

// Moderator overrides for the live (RSS) news feed, keyed by the article's
// stable id (guid/link). Lets admins hide a pulled story or attach a cover.
// The currently-released "wave" of pulled news — a frozen snapshot readers see.
// A single row (id = 'singleton'). Incoming pulled stories replace live_items
// when a moderator publishes, or automatically 2 days after they first appear.
export const newsWave = pgTable("news_wave", {
  id: text("id").primaryKey(), // always 'singleton'
  liveItems: jsonb("live_items").notNull().default([]), // snapshot of released stories
  liveAt: timestamp("live_at").notNull().defaultNow(), // when the live wave was published
  pendingSince: timestamp("pending_since"), // when an unreleased incoming wave first appeared
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const newsOverrides = pgTable("news_overrides", {
  newsId: text("news_id").primaryKey(),
  hidden: boolean("hidden").notNull().default(false), // dismissed/rejected from the review queue
  approved: boolean("approved").notNull().default(false), // released to readers (must be verified first)
  cover: text("cover"),
  onHome: boolean("on_home"), // null = auto (shown); false = pulled from Home; true = kept
  layout: text("layout"), // null = auto tiering; card | list  (news-tab placement)
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Admin-uploaded images (e.g. news covers), stored inline. Served as binary at
// /api/uploads/[id]; the referencing row just keeps that short URL.
export const uploads = pgTable("uploads", {
  id: uuid("id").defaultRandom().primaryKey(),
  mime: text("mime").notNull(),
  bytes: bytea("bytes").notNull(),
  size: integer("size").notNull(),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
export type DbCalendarEvent = typeof calendarEvents.$inferSelect;
export type DbCalendarTrack = typeof calendarTracks.$inferSelect;
