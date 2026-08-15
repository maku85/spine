"use server";

import { getMongoClient } from "@/lib/mongo/client";

const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION ?? "books";
const LISTS_COLLECTION = process.env.MONGODB_LISTS_COLLECTION ?? "lists";
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export type CatalogStats = {
  totalBooks: number;
  pendingReview: number;
  withItalian: number;
  withEnglish: number;
  withOlWorkKey: number;
  enrichCandidates: number;
  hardcoverCandidates: number;
  totalLists: number;
  listIsbnsTotal: number;
  listIsbnsUnresolved: number;
  translationRetryCandidates: number;
} | null;

export async function fetchCatalogStats(): Promise<CatalogStats> {
  const client = getMongoClient();
  if (!client) return null;

  try {
    const db = client.db(DB_NAME);
    const books = db.collection(COLLECTION_NAME);
    const lists = db.collection(LISTS_COLLECTION);
    const staleCutoff = new Date(Date.now() - STALE_AFTER_MS);

    const [
      totalBooks,
      pendingReview,
      withItalian,
      withEnglish,
      withOlWorkKey,
      enrichCandidates,
      hardcoverCandidates,
      translationRetryCandidates,
      listDocs,
    ] = await Promise.all([
      books.countDocuments({}),
      books.countDocuments({ pendingReview: true }),
      books.countDocuments({ "translations.it": { $exists: true } }),
      books.countDocuments({ "translations.en": { $exists: true } }),
      books.countDocuments({ olWorkKey: { $ne: null } }),
      books.countDocuments({
        "translations.it": { $exists: true },
        pendingReview: { $ne: true },
        enrichedAt: { $exists: false },
      }),
      books.countDocuments({
        "translations.en.isbn": { $exists: true, $ne: null },
        $or: [
          { hardcoverCheckedAt: { $exists: false } },
          { hardcoverCheckedAt: { $lt: staleCutoff } },
        ],
      }),
      books.countDocuments({
        "translations.it": { $exists: false },
        pendingReview: { $ne: true },
        $or: [
          { listResolutionCheckedAt: { $exists: false } },
          { listResolutionCheckedAt: { $lt: staleCutoff } },
        ],
      }),
      lists.find({}).toArray(),
    ]);

    const listIsbns = [
      ...new Set(
        listDocs.flatMap((list) =>
          (list.entries as Array<{ isbn: string }>).map((e) => e.isbn),
        ),
      ),
    ];

    const matchedBooks =
      listIsbns.length === 0
        ? []
        : await books
            .aggregate([
              {
                $addFields: {
                  _translationIsbns: {
                    $map: {
                      input: {
                        $objectToArray: { $ifNull: ["$translations", {}] },
                      },
                      as: "t",
                      in: "$$t.v.isbn",
                    },
                  },
                },
              },
              {
                $match: {
                  $or: [
                    { alternateIsbns: { $in: listIsbns } },
                    { _translationIsbns: { $in: listIsbns } },
                  ],
                },
              },
              { $project: { alternateIsbns: 1, _translationIsbns: 1 } },
            ])
            .toArray();

    const resolvedIsbns = new Set<string>();
    for (const doc of matchedBooks as Array<{
      alternateIsbns?: string[];
      _translationIsbns?: string[];
    }>) {
      for (const isbn of doc.alternateIsbns ?? []) resolvedIsbns.add(isbn);
      for (const isbn of doc._translationIsbns ?? []) {
        if (isbn) resolvedIsbns.add(isbn);
      }
    }
    const listIsbnsUnresolved = listIsbns.filter(
      (isbn) => !resolvedIsbns.has(isbn),
    ).length;

    return {
      totalBooks,
      pendingReview,
      withItalian,
      withEnglish,
      withOlWorkKey,
      enrichCandidates,
      hardcoverCandidates,
      totalLists: listDocs.length,
      listIsbnsTotal: listIsbns.length,
      listIsbnsUnresolved,
      translationRetryCandidates,
    };
  } catch {
    return null;
  }
}
