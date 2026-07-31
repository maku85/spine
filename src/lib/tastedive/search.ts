"use server";

import { TasteDiveResponseSchema } from "./types";

export type TasteDiveSuggestion = {
  name: string;
  teaser: string | null;
};

// TasteDive recommends similar books based on real taste/co-occurrence data
// (not just shared genre tags), given a book the user already liked.
// Requires TASTEDIVE_API_KEY; without one, this quietly returns [].
export async function fetchSimilarBooks(
  title: string,
  limit: number,
): Promise<TasteDiveSuggestion[]> {
  const apiKey = process.env.TASTEDIVE_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    q: `book:${title}`,
    type: "book",
    info: "1",
    limit: String(limit),
    k: apiKey,
  });

  try {
    const res = await fetch(`https://tastedive.com/api/similar?${params}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];

    const json = await res.json();
    const parsed = TasteDiveResponseSchema.safeParse(json);
    if (!parsed.success) return [];

    return (parsed.data.similar.results ?? []).map((result) => ({
      name: result.name,
      teaser: result.description ?? null,
    }));
  } catch {
    return [];
  }
}
