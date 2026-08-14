"use server";

import { getMongoClient } from "@/lib/mongo/client";
import { SEARCH_PAGE_SIZE } from "@/lib/search-books-constants";
import type { PreferredLanguage } from "@/lib/supabase/database.types";
import { normalizeIsbn } from "@/lib/text";

const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION ?? "books";
const SEARCH_INDEX_NAME = "books_autocomplete";

export type MongoBookResult = {
  mongoId: string;
  isbn: string | null;
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  description: string | null;
  categories: string[];
  nytRank: number | null;
  nytWeeksOnList: number | null;
  nytListName: string | null;
  olRating: number | null;
  olRatingsCount: number | null;
  moodTags: string[];
  series: Array<{ name: string; position: number | null }>;
};

export type MongoSearchPage = {
  items: MongoBookResult[];
  totalCount: number;
};

export type BrowseSortKey =
  | "rating_desc"
  | "title_asc"
  | "title_desc"
  | "year_desc"
  | "year_asc";

type Translation = { isbn: string; title: string; description: string | null };

type StoredBook = {
  _id: string;
  isbn: string | null;
  alternateIsbns?: string[];
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  description: string | null;
  categories: string[];
  language?: string | null;
  translations?: { it?: Translation };
  nytRank?: number;
  nytWeeksOnList?: number;
  nytListName?: string;
  olRating?: number;
  olRatingsCount?: number;
  moodTags?: string[];
  series?: Array<{ name: string; position: number | null }>;
};

function toResult(
  doc: StoredBook,
  preferredLanguage: PreferredLanguage,
): MongoBookResult {
  const it = preferredLanguage === "it" ? doc.translations?.it : undefined;
  return {
    mongoId: doc._id,
    isbn: it?.isbn ?? doc.isbn ?? null,
    title: it?.title ?? doc.title,
    authors: doc.authors ?? [],
    year: doc.year ?? null,
    publisher: doc.publisher ?? null,
    description: (it ? it.description : doc.description) ?? null,
    categories: doc.categories ?? [],
    nytRank: doc.nytRank ?? null,
    nytWeeksOnList: doc.nytWeeksOnList ?? null,
    nytListName: doc.nytListName ?? null,
    olRating: doc.olRating ?? null,
    olRatingsCount: doc.olRatingsCount ?? null,
    moodTags: doc.moodTags ?? [],
    series: doc.series ?? [],
  };
}

const ITALIAN_OR_LEGACY_MONGO_FILTER = {
  $or: [
    { language: { $in: [null, "it"] } },
    { "translations.it": { $exists: true } },
  ],
};
const ITALIAN_OR_LEGACY_SEARCH_FILTER = {
  compound: {
    should: [
      { equals: { path: "language", value: "it" } },
      { exists: { path: "translations.it.isbn" } },
    ],
    minimumShouldMatch: 1,
  },
};

function mongoDisplayFilter(preferredLanguage: PreferredLanguage) {
  return preferredLanguage === "it" ? ITALIAN_OR_LEGACY_MONGO_FILTER : {};
}

function searchDisplayFilter(preferredLanguage: PreferredLanguage) {
  return preferredLanguage === "it" ? [ITALIAN_OR_LEGACY_SEARCH_FILTER] : [];
}

export async function searchMongoBooks(
  query: string,
  page = 1,
  preferredLanguage: PreferredLanguage = "it",
): Promise<MongoSearchPage> {
  const empty: MongoSearchPage = { items: [], totalCount: 0 };

  const client = getMongoClient();
  if (!client) return empty;

  const trimmed = query.trim();
  if (!trimmed) return empty;

  try {
    const collection = client
      .db(DB_NAME)
      .collection<StoredBook>(COLLECTION_NAME);
    const isbn = normalizeIsbn(trimmed);
    const words = trimmed.split(/\s+/).filter(Boolean);
    const filter = searchDisplayFilter(preferredLanguage);

    const searchStage = isbn
      ? {
          compound: {
            must: [
              {
                text: {
                  query: isbn,
                  path: ["isbn", "alternateIsbns", "translations.it.isbn"],
                },
              },
            ],
            filter,
          },
        }
      : {
          compound: {
            must: words.map((word) => ({
              compound: {
                should: [
                  { autocomplete: { query: word, path: "title" } },
                  { autocomplete: { query: word, path: "authors" } },
                  {
                    autocomplete: {
                      query: word,
                      path: "translations.it.title",
                    },
                  },
                ],
                minimumShouldMatch: 1,
              },
            })),
            filter,
          },
        };

    const [meta] = await collection
      .aggregate<{ count?: { total?: number } }>([
        {
          $searchMeta: {
            index: SEARCH_INDEX_NAME,
            ...searchStage,
            count: { type: "total" },
          },
        },
      ])
      .toArray();

    const docs = await collection
      .aggregate<StoredBook>([
        { $search: { index: SEARCH_INDEX_NAME, ...searchStage } },
        { $skip: (page - 1) * SEARCH_PAGE_SIZE },
        { $limit: SEARCH_PAGE_SIZE },
      ])
      .toArray();

    return {
      items: docs.map((doc) => toResult(doc, preferredLanguage)),
      totalCount: meta?.count?.total ?? 0,
    };
  } catch {
    return empty;
  }
}

const BROWSE_SORT_SPECS: Record<BrowseSortKey, Record<string, 1 | -1>> = {
  rating_desc: { olRating: -1 },
  title_asc: { title: 1 },
  title_desc: { title: -1 },
  year_desc: { year: -1 },
  year_asc: { year: 1 },
};

export async function browseMongoBooks(
  sort: BrowseSortKey,
  page = 1,
  preferredLanguage: PreferredLanguage = "it",
): Promise<MongoSearchPage> {
  const empty: MongoSearchPage = { items: [], totalCount: 0 };

  const client = getMongoClient();
  if (!client) return empty;

  try {
    const collection = client
      .db(DB_NAME)
      .collection<StoredBook>(COLLECTION_NAME);
    const filter = mongoDisplayFilter(preferredLanguage);

    const [totalCount, docs] = await Promise.all([
      collection.countDocuments(filter),
      collection
        .find(filter)
        .sort(BROWSE_SORT_SPECS[sort])
        .skip((page - 1) * SEARCH_PAGE_SIZE)
        .limit(SEARCH_PAGE_SIZE)
        .toArray(),
    ]);

    return {
      items: docs.map((doc) => toResult(doc, preferredLanguage)),
      totalCount,
    };
  } catch {
    return empty;
  }
}
