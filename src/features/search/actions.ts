"use server";

import { searchCatalog } from "@/lib/catalog";
import type { SearchResult } from "./types";

// Self-hosted search over your own catalog (no external API).
export async function searchAnimeAction(query: string): Promise<SearchResult[]> {
  try {
    return await searchCatalog(query);
  } catch {
    return [];
  }
}
