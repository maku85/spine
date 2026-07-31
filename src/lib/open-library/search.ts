"use server";

import { curateGenres } from "@/lib/genres";
import { isItalian } from "@/lib/language";
import { SEARCH_PAGE_SIZE } from "@/lib/search-books-constants";
import { normalizeIsbn, normalizeTitle } from "@/lib/text";
import {
  type OLDoc,
  OLSearchResponseSchema,
  type OLSearchResult,
} from "./types";

async function fetchDocs(url: string) {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];

    const json = await res.json();
    const parsed = OLSearchResponseSchema.safeParse(json);
    return parsed.success ? parsed.data.docs : [];
  } catch {
    // Network-level failure (e.g. Open Library unreachable/down) — degrade
    // to "no results" instead of crashing the page, same as every other
    // external source in this app.
    return [];
  }
}

// Public-domain classics tend to have dozens of unmerged duplicate "work"
// records on Open Library (one per reprint/self-publisher), rather than one
// work with many editions. Normalizing the title (stripping accents,
// punctuation, and a leading article) lets us collapse those duplicates into
// a single search result.
function dedupeByWork(docs: OLDoc[]): OLDoc[] {
  const bestByKey = new Map<string, OLDoc>();
  const order: string[] = [];

  for (const doc of docs) {
    const key = `${normalizeTitle(doc.title)}::${normalizeTitle(doc.author_name?.[0] ?? "")}`;
    const existing = bestByKey.get(key);

    if (!existing) {
      bestByKey.set(key, doc);
      order.push(key);
      continue;
    }

    // Prefer the edition with the earliest first-publish year (closer to the
    // true original), falling back to whichever has more known editions.
    const year = doc.first_publish_year ?? Number.POSITIVE_INFINITY;
    const existingYear =
      existing.first_publish_year ?? Number.POSITIVE_INFINITY;
    const better =
      year < existingYear ||
      (year === existingYear &&
        (doc.edition_count ?? 0) > (existing.edition_count ?? 0));

    if (better) bestByKey.set(key, doc);
  }

  return order.map((key) => {
    const doc = bestByKey.get(key);
    if (!doc) throw new Error("Unreachable: missing dedup entry");
    return doc;
  });
}

const RAW_FETCH_LIMIT = 100;

export type OLSearchPage = {
  items: OLSearchResult[];
  totalCount: number;
};

export async function searchOpenLibrary(
  query: string,
  page = 1,
): Promise<OLSearchPage> {
  const empty: OLSearchPage = { items: [], totalCount: 0 };

  const trimmed = query.trim();
  if (!trimmed) return empty;

  const isbn = normalizeIsbn(trimmed);
  const searchParam = isbn
    ? `isbn=${encodeURIComponent(isbn)}`
    : `q=${encodeURIComponent(trimmed)}`;
  // Fetch more raw results than we'll show, since many will collapse into
  // the same book once deduplicated by work — and to have enough of a pool
  // to paginate through client-side (Open Library's own paging doesn't line
  // up with post-dedup pages).
  const base = `https://openlibrary.org/search.json?${searchParam}&limit=${RAW_FETCH_LIMIT}&fields=key,title,author_name,isbn,edition_key,first_publish_year,edition_count`;

  // Prefer editions available in Italian, but don't exclude books that only
  // exist in other languages: fall back to the unfiltered search for those.
  let docs = await fetchDocs(`${base}&language=ita`);
  if (docs.length === 0) {
    docs = await fetchDocs(base);
  }

  const deduped = dedupeByWork(docs);
  const start = (page - 1) * SEARCH_PAGE_SIZE;

  return {
    items: deduped.slice(start, start + SEARCH_PAGE_SIZE).map((doc) => ({
      workKey: doc.key.replace("/works/", ""),
      title: doc.title,
      authors: doc.author_name ?? [],
      isbn: doc.isbn?.[0] ?? null,
      editionKey: doc.edition_key?.[0] ?? null,
      firstPublishYear: doc.first_publish_year ?? null,
    })),
    totalCount: deduped.length,
  };
}

export type WorkDetails = {
  description: string | null;
  subjects: string[];
};

// Open Library descriptions for well-known books are often several
// languages concatenated as separate paragraphs (e.g. an English blurb
// followed by an Italian one). Keep only the Italian paragraphs when we can
// tell them apart; if none are detected, fall back to the full text rather
// than showing nothing.
function keepItalianParagraphs(description: string): string {
  const paragraphs = description
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1) return description;

  const italian = paragraphs.filter((paragraph) => isItalian(paragraph));

  return italian.length > 0 ? italian.join("\n\n") : description;
}

export async function fetchWorkDetails(workKey: string): Promise<WorkDetails> {
  try {
    const res = await fetch(`https://openlibrary.org/works/${workKey}.json`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { description: null, subjects: [] };

    const json = await res.json();
    const rawDescription =
      typeof json.description === "string"
        ? json.description
        : typeof json.description?.value === "string"
          ? json.description.value
          : null;

    return {
      description: rawDescription
        ? keepItalianParagraphs(rawDescription)
        : null,
      subjects: curateGenres(json.subjects),
    };
  } catch {
    return { description: null, subjects: [] };
  }
}
