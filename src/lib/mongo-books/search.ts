"use server";

import { getMongoClient } from "@/lib/mongo/client";
import { SEARCH_PAGE_SIZE } from "@/lib/search-books-constants";
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
};

export type MongoSearchPage = {
  items: MongoBookResult[];
  totalCount: number;
};

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
  nytRank?: number;
  nytWeeksOnList?: number;
  nytListName?: string;
};

function toResult(doc: StoredBook): MongoBookResult {
  return {
    mongoId: doc._id,
    isbn: doc.isbn ?? null,
    title: doc.title,
    authors: doc.authors ?? [],
    year: doc.year ?? null,
    publisher: doc.publisher ?? null,
    description: doc.description ?? null,
    categories: doc.categories ?? [],
    nytRank: doc.nytRank ?? null,
    nytWeeksOnList: doc.nytWeeksOnList ?? null,
    nytListName: doc.nytListName ?? null,
  };
}

export async function searchMongoBooks(
  query: string,
  page = 1,
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

    const searchStage = isbn
      ? { text: { query: isbn, path: ["isbn", "alternateIsbns"] } }
      : {
          compound: {
            must: words.map((word) => ({
              compound: {
                should: [
                  { autocomplete: { query: word, path: "title" } },
                  { autocomplete: { query: word, path: "authors" } },
                ],
                minimumShouldMatch: 1,
              },
            })),
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

    return { items: docs.map(toResult), totalCount: meta?.count?.total ?? 0 };
  } catch {
    return empty;
  }
}
