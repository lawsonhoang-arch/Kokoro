import type { Entry, Feeling, SymbolStyle } from "./types";

// Sample library — port of data.js.
// feeling: loved | liked | mixed | dropped
// status:  watching | completed | planned
// dims are private personal axes, 1–5 (never aggregated publicly)
export const LIBRARY: Entry[] = [
  {
    id: "frieren", title: "Frieren: Beyond Journey's End", year: 2023,
    genres: ["Fantasy", "Adventure", "Drama"], episodes: 28, seasons: 1,
    status: "completed", feeling: "loved", watched: "2024-03-02",
    dims: { story: 5, art: 5, music: 5, pacing: 4 },
    take: "A show about the spaces between adventures. The slowness is the point — grief measured in centuries, kindness measured in small errands. I have not stopped thinking about the mirror-lotus field.",
    air: { day: "Fri", time: "23:00" },
  },
  {
    id: "vinland", title: "Vinland Saga", year: 2019,
    genres: ["Action", "Drama", "Historical"], episodes: 24, seasons: 2,
    status: "completed", feeling: "loved", watched: "2023-11-18",
    dims: { story: 5, art: 4, music: 4, pacing: 4 },
    take: "Season 2 trades the sword for the plough and it is braver for it. A revenge story that earns the right to be about something else entirely.",
    air: { day: "Mon", time: "00:00" },
  },
  {
    id: "mushishi", title: "Mushishi", year: 2005,
    genres: ["Supernatural", "Slice of Life", "Mystery"], episodes: 26, seasons: 1,
    status: "completed", feeling: "loved", watched: "2022-08-09",
    dims: { story: 4, art: 5, music: 5, pacing: 3 },
    take: "Closest thing anime has to a held breath. Ginko walks, listens, leaves. Watch one episode before bed; never two.",
    air: { day: "—", time: "" },
  },
  {
    id: "monster", title: "Monster", year: 2004,
    genres: ["Thriller", "Psychological", "Drama"], episodes: 74, seasons: 1,
    status: "completed", feeling: "loved", watched: "2023-02-21",
    dims: { story: 5, art: 4, music: 4, pacing: 4 },
    take: "74 episodes and not one wasted. A moral thriller that keeps asking the same quiet question: is any life worth more than another?",
    air: { day: "—", time: "" },
  },
  {
    id: "bebop", title: "Cowboy Bebop", year: 1998,
    genres: ["Action", "Sci-Fi", "Drama"], episodes: 26, seasons: 1,
    status: "completed", feeling: "loved", watched: "2021-06-30",
    dims: { story: 4, art: 5, music: 5, pacing: 5 },
    take: "The soundtrack does half the storytelling. Cool as a posture that's secretly about loneliness. See you, space cowboy.",
    air: { day: "—", time: "" },
  },
  {
    id: "lustrous", title: "Land of the Lustrous", year: 2017,
    genres: ["Fantasy", "Action", "Drama"], episodes: 12, seasons: 1,
    status: "completed", feeling: "loved", watched: "2023-09-14",
    dims: { story: 5, art: 5, music: 4, pacing: 4 },
    take: "The CG everyone warned me about turned out to be the best argument for it. A body-horror coming-of-age where the body is gemstone. Devastating.",
    air: { day: "—", time: "" },
  },
  {
    id: "antarctica", title: "A Place Further Than the Universe", year: 2018,
    genres: ["Adventure", "Drama", "Slice of Life"], episodes: 13, seasons: 1,
    status: "completed", feeling: "loved", watched: "2024-01-05",
    dims: { story: 5, art: 4, music: 4, pacing: 5 },
    take: "Four girls go to Antarctica and I cried four separate times. The 'reading the emails' scene lives rent-free.",
    air: { day: "—", time: "" },
  },
  {
    id: "march", title: "March Comes in Like a Lion", year: 2016,
    genres: ["Drama", "Slice of Life"], episodes: 44, seasons: 2,
    status: "completed", feeling: "loved", watched: "2022-12-01",
    dims: { story: 5, art: 5, music: 4, pacing: 3 },
    take: "Depression rendered with more tenderness than any show has a right to. Shaft's visual language finally pointed at something that needed it.",
    air: { day: "—", time: "" },
  },
  {
    id: "mob", title: "Mob Psycho 100", year: 2016,
    genres: ["Action", "Comedy", "Supernatural"], episodes: 25, seasons: 3,
    status: "completed", feeling: "liked", watched: "2023-05-22",
    dims: { story: 4, art: 5, music: 3, pacing: 4 },
    take: "The action is a flex but the heart is a kid learning that being kind isn't a superpower, it's a choice. Reigen is a menace and a saint.",
    air: { day: "—", time: "" },
  },
  {
    id: "bocchi", title: "Bocchi the Rock!", year: 2022,
    genres: ["Comedy", "Music", "Slice of Life"], episodes: 12, seasons: 1,
    status: "completed", feeling: "liked", watched: "2024-02-11",
    dims: { story: 3, art: 5, music: 4, pacing: 4 },
    take: "Anxiety as a visual playground. The animation throws everything at the wall and somehow it all sticks. Felt seen, uncomfortably.",
    air: { day: "Sat", time: "23:30" },
  },
  {
    id: "dungeon", title: "Delicious in Dungeon", year: 2024,
    genres: ["Fantasy", "Adventure", "Comedy"], episodes: 24, seasons: 1,
    status: "completed", feeling: "liked", watched: "2024-06-20",
    dims: { story: 4, art: 4, music: 3, pacing: 4 },
    take: "A cooking show wearing a dungeon crawler's armour. Worldbuilding by way of recipes — somehow it works and it's warm.",
    air: { day: "Thu", time: "22:00" },
  },
  {
    id: "csm", title: "Chainsaw Man", year: 2022,
    genres: ["Action", "Horror", "Supernatural"], episodes: 12, seasons: 1,
    status: "completed", feeling: "mixed", watched: "2023-01-09",
    dims: { story: 4, art: 5, music: 4, pacing: 3 },
    take: "Looks incredible, but the cinematic restraint sands off the manga's gremlin energy. Admired more than I loved it. Will give S2 a chance.",
    air: { day: "Tue", time: "24:00" },
  },
  {
    id: "oshi", title: "Oshi no Ko", year: 2023,
    genres: ["Drama", "Mystery", "Psychological"], episodes: 11, seasons: 1,
    status: "completed", feeling: "mixed", watched: "2023-07-12",
    dims: { story: 3, art: 4, music: 4, pacing: 2 },
    take: "An 80-minute first episode that's a masterpiece, attached to a show that can't decide what it wants to be. The idol-industry satire is sharp when it shows up.",
    air: { day: "Wed", time: "23:00" },
  },
  {
    id: "apothecary", title: "The Apothecary Diaries", year: 2023,
    genres: ["Mystery", "Drama", "Historical"], episodes: 24, seasons: 1,
    status: "watching", feeling: null, watched: null,
    dims: { story: 0, art: 0, music: 0, pacing: 0 },
    take: "",
    air: { day: "Sat", time: "22:30" }, progress: 14,
  },
  {
    id: "frieren-rewatch", title: "Apocalypse Hotel", year: 2025,
    genres: ["Sci-Fi", "Comedy", "Drama"], episodes: 12, seasons: 1,
    status: "watching", feeling: null, watched: null,
    dims: { story: 0, art: 0, music: 0, pacing: 0 },
    take: "",
    air: { day: "Mon", time: "23:00" }, progress: 6,
  },
  {
    id: "bleach", title: "Bleach: Thousand-Year Blood War", year: 2022,
    genres: ["Action", "Supernatural"], episodes: 52, seasons: 1,
    status: "watching", feeling: null, watched: null,
    dims: { story: 0, art: 0, music: 0, pacing: 0 },
    take: "",
    air: { day: "Sat", time: "23:00" }, progress: 33,
  },
  {
    id: "ping-pong", title: "Ping Pong the Animation", year: 2014,
    genres: ["Sports", "Drama", "Psychological"], episodes: 11, seasons: 1,
    status: "planned", feeling: null, watched: null,
    dims: { story: 0, art: 0, music: 0, pacing: 0 },
    take: "",
    air: { day: "—", time: "" },
  },
  {
    id: "houseki", title: "Sonny Boy", year: 2021,
    genres: ["Sci-Fi", "Mystery", "Drama"], episodes: 12, seasons: 1,
    status: "planned", feeling: null, watched: null,
    dims: { story: 0, art: 0, music: 0, pacing: 0 },
    take: "",
    air: { day: "—", time: "" },
  },
];

/** Feeling metadata — order = tier (loved highest). */
export const FEELINGS: Record<Feeling, { label: string; tier: number }> = {
  loved: { label: "Loved it", tier: 0 },
  liked: { label: "Liked it", tier: 1 },
  mixed: { label: "Mixed", tier: 2 },
  dropped: { label: "Dropped", tier: 3 },
};

/** Symbol rating styles (the "symbols" rate mode). Values run 1–5, 5 = best. */
export const SYMBOL_STYLES: Record<SymbolStyle, { label: string }> = {
  stars: { label: "Stars" },
  grades: { label: "Grades" },
  emoji: { label: "Mood" },
};
/** Letter grade per value (index = value 1–5; "" is unused index 0). */
export const GRADE_LETTERS = ["", "D", "C", "B", "A", "S"];
/** Mood emoji per value (index = value 1–5). */
export const MOOD_EMOJI = ["", "💀", "😴", "😐", "🙂", "😍"];
