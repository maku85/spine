"use server";

import { getMongoClient } from "@/lib/mongo/client";

const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION ?? "books";

const MIN_RATINGS_COUNT = 15;

export type SuggestedBook = {
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
};

type StoredBook = {
  _id: string;
  isbn: string | null;
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  description: string | null;
  categories: string[];
  nytRank?: number;
  nytWeeksOnList?: number;
  nytListName?: string;
  olRating?: number;
  olRatingsCount?: number;
};

function toSuggestedBook(doc: StoredBook): SuggestedBook {
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
    olRating: doc.olRating ?? null,
    olRatingsCount: doc.olRatingsCount ?? null,
  };
}

export async function fetchNytBestsellerBooks(): Promise<SuggestedBook[]> {
  const client = getMongoClient();
  if (!client) return [];

  try {
    const collection = client
      .db(DB_NAME)
      .collection<StoredBook>(COLLECTION_NAME);
    const docs = await collection
      .find({ nytRank: { $exists: true } })
      .sort({ nytRank: 1 })
      .toArray();

    return docs.map(toSuggestedBook);
  } catch {
    return [];
  }
}

export async function fetchTopRatedBooks(): Promise<SuggestedBook[]> {
  const client = getMongoClient();
  if (!client) return [];

  try {
    const collection = client
      .db(DB_NAME)
      .collection<StoredBook>(COLLECTION_NAME);
    const docs = await collection
      .find({ olRatingsCount: { $gte: MIN_RATINGS_COUNT } })
      .sort({ olRating: -1 })
      .toArray();

    return docs.map(toSuggestedBook);
  } catch {
    return [];
  }
}
