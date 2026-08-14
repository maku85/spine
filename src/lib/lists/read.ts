"use server";

import { getMongoClient } from "@/lib/mongo/client";
import type { SuggestedBook } from "@/lib/suggestions/read";
import type { PreferredLanguage } from "@/lib/supabase/database.types";

const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION ?? "books";
const LISTS_COLLECTION = process.env.MONGODB_LISTS_COLLECTION ?? "lists";

type ListSource = "nyt" | "hardcover";

type ListEntry = {
  isbn: string;
  position: number | null;
};

type ListDoc = {
  _id: string;
  source: ListSource;
  name: string;
  followersCount: number | null;
  entries: ListEntry[];
};

type Translation = { isbn: string; title: string; description: string | null };

type StoredBook = {
  _id: string;
  isbn: string | null;
  alternateIsbns?: string[];
  englishIsbn?: string | null;
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  description: string | null;
  categories: string[];
  language?: string | null;
  translations?: { it?: Translation };
  moodTags?: string[];
  series?: Array<{ name: string; position: number | null }>;
};

function isDisplayable(
  doc: StoredBook,
  preferredLanguage: PreferredLanguage,
): boolean {
  if (preferredLanguage === "all") return true;
  return (
    doc.language == null ||
    doc.language === "it" ||
    Boolean(doc.translations?.it)
  );
}

export type SuggestedListEntry = {
  book: SuggestedBook;
  position: number | null;
};

export type SuggestedList = {
  key: string;
  source: ListSource;
  name: string;
  followersCount: number | null;
  entries: SuggestedListEntry[];
};

function toSuggestedBook(
  doc: StoredBook,
  preferredLanguage: PreferredLanguage,
): SuggestedBook {
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
    nytRank: null,
    nytWeeksOnList: null,
    nytListName: null,
    moodTags: doc.moodTags ?? [],
    series: doc.series ?? [],
    olRating: null,
    olRatingsCount: null,
  };
}

export async function fetchNotableLists(
  preferredLanguage: PreferredLanguage = "it",
): Promise<SuggestedList[]> {
  const client = getMongoClient();
  if (!client) return [];

  try {
    const db = client.db(DB_NAME);
    const listsCollection = db.collection<ListDoc>(LISTS_COLLECTION);
    const booksCollection = db.collection<StoredBook>(COLLECTION_NAME);

    const lists = await listsCollection.find({}).toArray();
    if (lists.length === 0) return [];

    const allIsbns = [
      ...new Set(lists.flatMap((list) => list.entries.map((e) => e.isbn))),
    ];

    const matchedBooks = await booksCollection
      .find({
        $or: [
          { isbn: { $in: allIsbns } },
          { alternateIsbns: { $in: allIsbns } },
          { englishIsbn: { $in: allIsbns } },
          { "translations.it.isbn": { $in: allIsbns } },
        ],
      })
      .toArray();

    const byIsbn = new Map<string, StoredBook>();
    for (const book of matchedBooks) {
      if (book.isbn) byIsbn.set(book.isbn, book);
      for (const alt of book.alternateIsbns ?? []) byIsbn.set(alt, book);
      if (book.englishIsbn) byIsbn.set(book.englishIsbn, book);
      if (book.translations?.it?.isbn)
        byIsbn.set(book.translations.it.isbn, book);
    }

    return lists
      .map((list) => {
        const sortedEntries = [...list.entries].sort(
          (a, b) => (a.position ?? Infinity) - (b.position ?? Infinity),
        );

        const seenBookIds = new Set<string>();
        const entries: SuggestedListEntry[] = [];
        for (const entry of sortedEntries) {
          const match = byIsbn.get(entry.isbn);
          if (
            !match ||
            seenBookIds.has(match._id) ||
            !isDisplayable(match, preferredLanguage)
          )
            continue;
          seenBookIds.add(match._id);
          entries.push({
            book: toSuggestedBook(match, preferredLanguage),
            position: entry.position,
          });
        }

        return {
          key: list._id,
          source: list.source,
          name: list.name,
          followersCount: list.followersCount ?? null,
          entries,
        };
      })
      .filter((list) => list.entries.length > 0);
  } catch {
    return [];
  }
}
