"use server";

import { getMongoClient } from "@/lib/mongo/client";
import type { PreferredLanguage } from "@/lib/supabase/database.types";

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
  moodTags: string[];
  series: Array<{ name: string; position: number | null }>;
};

type Translation = { isbn: string; title: string; description: string | null };

type StoredBook = {
  _id: string;
  isbn: string | null;
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  description: string | null;
  categories: string[];
  language?: string | null;
  translations?: { it?: Translation; en?: Translation };
  nytRank?: number;
  nytWeeksOnList?: number;
  nytListName?: string;
  olRating?: number;
  olRatingsCount?: number;
  moodTags?: string[];
  series?: Array<{ name: string; position: number | null }>;
  pendingReview?: boolean;
};

function toSuggestedBook(
  doc: StoredBook,
  preferredLanguage: PreferredLanguage,
): SuggestedBook {
  const translation =
    preferredLanguage === "it"
      ? doc.translations?.it
      : preferredLanguage === "en"
        ? doc.translations?.en
        : undefined;
  return {
    mongoId: doc._id,
    isbn: translation?.isbn ?? doc.isbn ?? null,
    title: translation?.title ?? doc.title,
    authors: doc.authors ?? [],
    year: doc.year ?? null,
    publisher: doc.publisher ?? null,
    description:
      (translation ? translation.description : doc.description) ?? null,
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

export async function fetchTopRatedBooks(
  preferredLanguage: PreferredLanguage = "it",
): Promise<SuggestedBook[]> {
  const client = getMongoClient();
  if (!client) return [];

  try {
    const collection = client
      .db(DB_NAME)
      .collection<StoredBook>(COLLECTION_NAME);
    const displayFilter =
      preferredLanguage === "it"
        ? {
            $or: [
              { language: { $in: [null, "it"] } },
              { "translations.it": { $exists: true } },
            ],
          }
        : {};
    const docs = await collection
      .find({
        olRatingsCount: { $gte: MIN_RATINGS_COUNT },
        pendingReview: { $ne: true },
        ...displayFilter,
      })
      .sort({ olRating: -1 })
      .toArray();

    return docs.map((doc) => toSuggestedBook(doc, preferredLanguage));
  } catch {
    return [];
  }
}
