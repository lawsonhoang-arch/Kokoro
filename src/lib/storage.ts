import type { HueKey } from "./palette";

// The serializable watchlist DTO shared between the server data layer
// (lib/watchlists.ts) and the gallery client. Timestamps are epoch ms.
// (Persistence moved from localStorage to Supabase — see lib/watchlists.ts.)
export type Watchlist = {
  id: string;
  title: string;
  desc: string;
  hue: HueKey;
  pinned: boolean;
  titleCount: number;
  watching: number;
  /** up to 4 cover images from the list's first titles (for the card mosaic) */
  covers?: string[];
  /** extra rating axes shared by every title in the list */
  customAxes: string[];
  createdAt: number;
  lastEdited: number;
};
