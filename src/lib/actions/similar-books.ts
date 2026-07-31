"use server";

import { fetchGoogleBooksEnrichment } from "@/lib/google-books/search";
import { searchOpenLibrary } from "@/lib/open-library/search";
import type { OLSearchResult } from "@/lib/open-library/types";
import { createClient } from "@/lib/supabase/server";
import { fetchSimilarBooks } from "@/lib/tastedive/search";
import { stripSeriesSuffix } from "@/lib/text";

const SIMILAR_LIMIT = 8;

export type SimilarBookSuggestion = {
  result: OLSearchResult;
  averageRating: number | null;
  ratingsCount: number | null;
};

// On-demand (called from a button, not on every page load): asks TasteDive
// what's similar to a specific book, resolves each to a real Open Library
// work, and drops anything already in the user's catalog.
export async function getSimilarBooks(
  title: string,
): Promise<SimilarBookSuggestion[]> {
  const supabase = await createClient();
  const { data: userBooks } = await supabase
    .from("user_books")
    .select("books(ol_work_key)");

  const ownedWorkKeys = new Set(
    (userBooks ?? [])
      .map((userBook) => userBook.books?.ol_work_key)
      .filter((key): key is string => Boolean(key)),
  );

  const similar = await fetchSimilarBooks(title, SIMILAR_LIMIT);

  const resolved = await Promise.all(
    similar.map(async (suggestion) => {
      const { items } = await searchOpenLibrary(
        stripSeriesSuffix(suggestion.name),
      );
      const [match] = items;
      if (!match || ownedWorkKeys.has(match.workKey)) return null;

      const { averageRating, ratingsCount } = await fetchGoogleBooksEnrichment({
        isbn: match.isbn,
        title: match.title,
        authors: match.authors,
      });

      return { result: match, averageRating, ratingsCount };
    }),
  );

  return resolved.filter((item) => item !== null);
}
