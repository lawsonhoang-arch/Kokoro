// Milestone badges — derived purely from the profile stats the page already
// has, so they're computed client-side (no extra query) and update live as the
// user adds favorites. Each badge has a single threshold; earned when reached.
import type { ProfileStats } from "@/lib/profile";

export type Badge = {
  key: string;
  icon: string; // emoji glyph
  label: string;
  desc: string; // the requirement / flavor line
  value: number; // current progress
  goal: number; // threshold to earn
  earned: boolean;
  progress: number; // 0–1 toward the goal
};

export function computeBadges(s: ProfileStats, favCount: number): Badge[] {
  const defs: Omit<Badge, "earned" | "progress">[] = [
    // Titles completed
    { key: "starter", icon: "🌱", label: "First Steps", desc: "Complete your first title", value: s.completed, goal: 1 },
    { key: "ten", icon: "📺", label: "Getting Into It", desc: "Complete 10 titles", value: s.completed, goal: 10 },
    { key: "fifty", icon: "🎯", label: "Half-Century", desc: "Complete 50 titles", value: s.completed, goal: 50 },
    { key: "century", icon: "💯", label: "Centurion", desc: "Complete 100 titles", value: s.completed, goal: 100 },
    { key: "legend", icon: "👑", label: "Legend", desc: "Complete 250 titles", value: s.completed, goal: 250 },
    // Episodes watched
    { key: "eps", icon: "🔥", label: "Marathoner", desc: "Watch 1,000 episodes", value: s.episodesWatched, goal: 1000 },
    { key: "eps5k", icon: "🎬", label: "Binge Lord", desc: "Watch 5,000 episodes", value: s.episodesWatched, goal: 5000 },
    // Hours watched
    { key: "hours", icon: "⏳", label: "Time Sink", desc: "100 hours watched", value: s.hours, goal: 100 },
    { key: "hours500", icon: "🛋️", label: "Devoted", desc: "500 hours watched", value: s.hours, goal: 500 },
    // Manga — chapters read + titles finished
    { key: "manga", icon: "📚", label: "Bookworm", desc: "Read 500 chapters", value: s.chaptersRead, goal: 500 },
    { key: "manga2k", icon: "📖", label: "Librarian", desc: "Read 2,000 chapters", value: s.chaptersRead, goal: 2000 },
    { key: "mangadone", icon: "🔖", label: "Page Turner", desc: "Finish 10 manga", value: s.mangaCompleted, goal: 10 },
    // Genres explored
    { key: "genres", icon: "🧭", label: "Explorer", desc: "Explore 15 genres", value: s.genresDistinct, goal: 15 },
    { key: "genres25", icon: "🗺️", label: "Connoisseur", desc: "Explore 25 genres", value: s.genresDistinct, goal: 25 },
    // Reviews written
    { key: "critic", icon: "✍️", label: "Critic", desc: "Write 10 reviews", value: s.reviews, goal: 10 },
    { key: "critic50", icon: "📝", label: "Wordsmith", desc: "Write 50 reviews", value: s.reviews, goal: 50 },
    // Curation / organization
    { key: "curator", icon: "⭐", label: "Curator", desc: "Pick 6 favorites", value: favCount, goal: 6 },
    { key: "lists", icon: "🗂️", label: "Organizer", desc: "Build 5 lists", value: s.lists, goal: 5 },
    { key: "collector", icon: "🗄️", label: "Collector", desc: "Track 100 titles", value: s.tracked, goal: 100 },
    // Habits — in rotation now + backlog
    { key: "juggler", icon: "🤹", label: "Juggler", desc: "Watch 8 titles at once", value: s.watching, goal: 8 },
    { key: "backlog", icon: "🗃️", label: "The Pile", desc: "Stack up 25 planned titles", value: s.planned, goal: 25 },
  ];
  return defs.map((d) => ({
    ...d,
    earned: d.value >= d.goal,
    progress: d.goal ? Math.min(1, d.value / d.goal) : 1,
  }));
}
