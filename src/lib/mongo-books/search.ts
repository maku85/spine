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
  description: string | null;
  categories: string[];
  nytRank: number | null;
  nytWeeksOnList: number | null;
  nytListName: string | null;
  rating: number | null;
  ratingsCount: number | null;
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
  | "year_asc"
  | "author_asc"
  | "author_desc";

type Translation = {
  isbn: string;
  title: string;
  description: string | null;
};

type StoredBook = {
  _id: string;
  authors: string[];
  year: number | null;
  categories: string[];
  alternateIsbns?: string[];
  translations?: Partial<Record<string, Translation>>;
  nytRank?: number;
  nytWeeksOnList?: number;
  nytListName?: string;
  rating?: number;
  ratingsCount?: number;
  moodTags?: string[];
  series?: Array<{ name: string; position: number | null }>;
  pendingReview?: boolean;
};

function pickTranslation(
  doc: StoredBook,
  preferredLanguage: PreferredLanguage,
): Translation | undefined {
  const translations = doc.translations ?? {};
  const preferred = preferredLanguage === "it" ? translations.it : undefined;
  return (
    preferred ??
    translations.en ??
    translations.it ??
    Object.values(translations).find(Boolean)
  );
}

function toResult(
  doc: StoredBook,
  preferredLanguage: PreferredLanguage,
): MongoBookResult {
  const translation = pickTranslation(doc, preferredLanguage);
  return {
    mongoId: doc._id,
    isbn: translation?.isbn ?? null,
    title: translation?.title ?? "",
    authors: doc.authors ?? [],
    year: doc.year ?? null,
    description: translation?.description ?? null,
    categories: doc.categories ?? [],
    nytRank: doc.nytRank ?? null,
    nytWeeksOnList: doc.nytWeeksOnList ?? null,
    nytListName: doc.nytListName ?? null,
    rating: doc.rating ?? null,
    ratingsCount: doc.ratingsCount ?? null,
    moodTags: doc.moodTags ?? [],
    series: doc.series ?? [],
  };
}

const NOT_PENDING_REVIEW_MONGO_FILTER = { pendingReview: { $ne: true } };
const NOT_PENDING_REVIEW_SEARCH_FILTER = {
  compound: { mustNot: [{ exists: { path: "pendingReview" } }] },
};

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
    const filter = [NOT_PENDING_REVIEW_SEARCH_FILTER];

    const searchStage = isbn
      ? {
          compound: {
            must: [
              {
                text: {
                  query: isbn,
                  path: [
                    "alternateIsbns",
                    "translations.it.isbn",
                    "translations.en.isbn",
                  ],
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
                  { autocomplete: { query: word, path: "authors" } },
                  {
                    autocomplete: {
                      query: word,
                      path: "translations.it.title",
                    },
                  },
                  {
                    autocomplete: {
                      query: word,
                      path: "translations.en.title",
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

function displayTitleExpr(preferredLanguage: PreferredLanguage) {
  return preferredLanguage === "it"
    ? { $ifNull: ["$translations.it.title", "$translations.en.title"] }
    : { $ifNull: ["$translations.en.title", "$translations.it.title"] };
}

const BROWSE_SORT_SPECS: Record<BrowseSortKey, Record<string, 1 | -1>> = {
  rating_desc: { rating: -1 },
  title_asc: { displayTitle: 1 },
  title_desc: { displayTitle: -1 },
  year_desc: { year: -1 },
  year_asc: { year: 1 },
  author_asc: { displayAuthor: 1 },
  author_desc: { displayAuthor: -1 },
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
    const filter = NOT_PENDING_REVIEW_MONGO_FILTER;

    const [totalCount, docs] = await Promise.all([
      collection.countDocuments(filter),
      collection
        .aggregate<StoredBook>([
          { $match: filter },
          {
            $addFields: {
              displayTitle: displayTitleExpr(preferredLanguage),
              displayAuthor: {
                $ifNull: [{ $arrayElemAt: ["$authors", 0] }, ""],
              },
            },
          },
          { $sort: BROWSE_SORT_SPECS[sort] },
          { $skip: (page - 1) * SEARCH_PAGE_SIZE },
          { $limit: SEARCH_PAGE_SIZE },
        ])
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
