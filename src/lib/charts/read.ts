"use server";

import { getMongoClient } from "@/lib/mongo/client";

const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const CHARTS_COLLECTION = process.env.MONGODB_CHARTS_COLLECTION ?? "charts";

export type ChartEntry = {
  rank: number;
  isbn: string | null;
  title: string;
  author: string | null;
  description: string | null;
  averageRating: number | null;
  ratingsCount: number | null;
};

export type Chart = {
  id: string;
  source: "nyt" | "google-books" | "curated";
  type: "bestseller" | "popularity" | "importance";
  category: string;
  sourceNote: string | null;
  entries: ChartEntry[];
};

type ChartDoc = Omit<Chart, "id"> & { _id: string };

// Legge le classifiche popolate da scripts/import-charts.mts (snapshot
// statico, non chiamate live) — usate dalla pagina Suggerimenti al posto
// di interrogare NYT/Google Books a ogni caricamento. Richiede MONGODB_URI;
// senza, o a cluster irraggiungibile, ritorna [] e il chiamante degrada a
// "nessun suggerimento" invece di far fallire la pagina.
export async function fetchCharts(type?: Chart["type"]): Promise<Chart[]> {
  const client = getMongoClient();
  if (!client) return [];

  try {
    const collection = client
      .db(DB_NAME)
      .collection<ChartDoc>(CHARTS_COLLECTION);
    const docs = await collection.find(type ? { type } : {}).toArray();

    return docs.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
  } catch {
    return [];
  }
}
