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

type Translation = { isbn: string; title: string; description: string | null };

type StoredBook = {
  _id: string;
  authors: string[];
  year: number | null;
  categories: string[];
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

function toSuggestedBook(
  doc: StoredBook,
  preferredLanguage: PreferredLanguage,
): SuggestedBook {
  const translations = doc.translations ?? {};
  const translation =
    preferredLanguage === "it"
      ? (translations.it ?? Object.values(translations).find(Boolean))
      : (translations.en ??
        translations.it ??
        Object.values(translations).find(Boolean));
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
        ? { "translations.it": { $exists: true } }
        : {};
    const docs = await collection
      .find({
        ratingsCount: { $gte: MIN_RATINGS_COUNT },
        pendingReview: { $ne: true },
        ...displayFilter,
      })
      .sort({ rating: -1, ratingsCount: -1 })
      .toArray();

    return docs.map((doc) => toSuggestedBook(doc, preferredLanguage));
  } catch {
    return [];
  }
}
