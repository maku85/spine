"use server";

import { curateGenres } from "@/lib/genres";
import { GoogleBooksResponseSchema } from "./types";

export type GoogleBooksEnrichment = {
  description: string | null;
  categories: string[];
  averageRating: number | null;
  ratingsCount: number | null;
};

const EMPTY: GoogleBooksEnrichment = {
  description: null,
  categories: [],
  averageRating: null,
  ratingsCount: null,
};

function buildUrl(q: string, apiKey: string, langRestrict?: string) {
  const params = new URLSearchParams({ q, maxResults: "1", key: apiKey });
  if (langRestrict) params.set("langRestrict", langRestrict);
  return `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
}

async function fetchVolume(url: string) {
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const json = await res.json();
  const parsed = GoogleBooksResponseSchema.safeParse(json);
  return parsed.success ? (parsed.data.items?.[0] ?? null) : null;
}

// Optional enrichment: Google Books often has a cleaner, single-language
// description than Open Library (whose descriptions are frequently several
// languages concatenated), its own `categories` field, and reader ratings
// Open Library doesn't have at all. Requires a GOOGLE_BOOKS_API_KEY; without
// one, this quietly no-ops so callers (add-to-catalog, reading suggestions)
// keep working without it.
export async function fetchGoogleBooksEnrichment({
  isbn,
  title,
  authors,
}: {
  isbn: string | null;
  title: string;
  authors: string[];
}): Promise<GoogleBooksEnrichment> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (!apiKey) return EMPTY;

  const query = isbn
    ? `isbn:${isbn}`
    : authors[0]
      ? `intitle:${title} inauthor:${authors[0]}`
      : `intitle:${title}`;

  try {
    // Prefer an Italian-tagged edition, but fall back to whatever exists.
    const volume =
      (await fetchVolume(buildUrl(query, apiKey, "it"))) ??
      (await fetchVolume(buildUrl(query, apiKey)));

    if (!volume) return EMPTY;

    return {
      description: volume.volumeInfo.description ?? null,
      categories: curateGenres(volume.volumeInfo.categories),
      averageRating: volume.volumeInfo.averageRating ?? null,
      ratingsCount: volume.volumeInfo.ratingsCount ?? null,
    };
  } catch {
    return EMPTY;
  }
}
