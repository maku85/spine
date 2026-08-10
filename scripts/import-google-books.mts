// Importa libri in italiano dalle API di Google Books in MongoDB Atlas.
//
// Uso:
//   node --env-file=.env.local scripts/import-google-books.mts [query...] [opzioni]
//   pnpm import-books [query...] [opzioni]
//
// Esempi:
//   pnpm import-books "romanzo fantascienza" "romanzo giallo"
//   pnpm import-books --max=400 "inauthor:Italo Calvino"
//   pnpm import-books --order-by=newest "romanzo storico"
//

import { MongoClient } from "mongodb";
import { normalizeTitle } from "../src/lib/text.ts";

const GOOGLE_BOOKS_ENDPOINT = "https://www.googleapis.com/books/v1/volumes";
const PAGE_SIZE = 40;
const REQUEST_DELAY_MS = 250;
const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION ?? "books";

const DEFAULT_QUERIES = [
  "romanzo",
  "romanzo fantascienza",
  "romanzo fantasy",
  "romanzo giallo",
  "romanzo storico",
  "racconti",
];

type GoogleBooksVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    publisher?: string;
    description?: string;
    categories?: string[];
    language?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    averageRating?: number;
    ratingsCount?: number;
  };
};

type GoogleBooksResponse = {
  totalItems?: number;
  items?: GoogleBooksVolume[];
};

type ImportedBook = {
  _id: string;
  isbn: string;
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  description: string | null;
  categories: string[];
  averageRating: number | null;
  ratingsCount: number | null;
  workKey: string;
};

function parseArgs(argv: string[]) {
  const queries: string[] = [];
  let maxPerQuery = 200;
  let dryRun = false;
  let orderBy: "relevance" | "newest" = "relevance";

  for (const arg of argv) {
    if (arg.startsWith("--max=")) {
      maxPerQuery = Number(arg.slice("--max=".length));
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--order-by=")) {
      const value = arg.slice("--order-by=".length);
      if (value !== "relevance" && value !== "newest") {
        throw new Error(
          `--order-by non valido: "${value}" (usa relevance o newest)`,
        );
      }
      orderBy = value;
    } else {
      queries.push(arg);
    }
  }

  return {
    queries: queries.length > 0 ? queries : DEFAULT_QUERIES,
    maxPerQuery,
    dryRun,
    orderBy,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractYear(publishedDate: string | undefined): number | null {
  const match = publishedDate?.match(/^\d{4}/);
  return match ? Number(match[0]) : null;
}

function isEarlierEdition(
  candidateYear: number | null,
  existingYear: number | null,
): boolean {
  if (candidateYear === null) return false;
  if (existingYear === null) return true;
  return candidateYear < existingYear;
}

function extractIsbn(
  identifiers: Array<{ type: string; identifier: string }> | undefined,
): string | null {
  if (!identifiers) return null;
  const isbn13 = identifiers.find((id) => id.type === "ISBN_13");
  if (isbn13) return isbn13.identifier;
  const isbn10 = identifiers.find((id) => id.type === "ISBN_10");
  return isbn10?.identifier ?? null;
}

function isNarrativa(categories: string[]): boolean {
  return categories.some((category) => /fiction|narrativa/i.test(category));
}

function isStudyGuide(title: string): boolean {
  return /analisi del libro|riassunto|guida (alla lettura|allo studio)|scheda (di lettura|libro)/i.test(
    title,
  );
}

function toImportedBook(volume: GoogleBooksVolume): ImportedBook | null {
  const info = volume.volumeInfo;
  if (!info?.title || info.language !== "it") return null;
  if (isStudyGuide(info.title)) return null;

  const isbn = extractIsbn(info.industryIdentifiers);
  if (!isbn) return null;

  const categories = info.categories ?? [];
  if (!isNarrativa(categories)) return null;

  const authors = info.authors ?? [];
  const workKey = `${normalizeTitle(info.title)}::${normalizeTitle(authors[0] ?? "")}`;

  return {
    _id: volume.id,
    isbn,
    title: info.title,
    authors,
    year: extractYear(info.publishedDate),
    publisher: info.publisher ?? null,
    description: info.description ?? null,
    categories,
    averageRating: info.averageRating ?? null,
    ratingsCount: info.ratingsCount ?? null,
    workKey,
  };
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 500;

async function fetchPage(
  query: string,
  startIndex: number,
  orderBy: "relevance" | "newest",
  apiKey: string | undefined,
): Promise<GoogleBooksResponse> {
  const params = new URLSearchParams({
    q: query,
    langRestrict: "it",
    printType: "books",
    orderBy,
    startIndex: String(startIndex),
    maxResults: String(PAGE_SIZE),
  });
  if (apiKey) params.set("key", apiKey);

  const url = `${GOOGLE_BOOKS_ENDPOINT}?${params.toString()}`;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);

    if (res.ok) return res.json();

    const retryable = RETRYABLE_STATUSES.has(res.status);
    if (!retryable || attempt >= MAX_RETRIES) {
      const hint = res.status === 403 ? " (quota superata?)" : "";
      throw new Error(
        `Google Books ha risposto ${res.status}${hint} per query "${query}"`,
      );
    }

    const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
    console.warn(
      `  Google Books ha risposto ${res.status} (tentativo ${attempt + 1}/${MAX_RETRIES}), riprovo tra ${delay}ms...`,
    );
    await sleep(delay);
  }
}

async function* fetchItalianBooks(
  query: string,
  maxPerQuery: number,
  orderBy: "relevance" | "newest",
  apiKey: string | undefined,
): AsyncGenerator<ImportedBook> {
  let startIndex = 0;
  let fetched = 0;
  let totalItems = Number.POSITIVE_INFINITY;

  while (startIndex < totalItems && fetched < maxPerQuery) {
    const page = await fetchPage(query, startIndex, orderBy, apiKey);
    totalItems = page.totalItems ?? 0;

    const items = page.items ?? [];
    if (items.length === 0) break;

    for (const volume of items) {
      const book = toImportedBook(volume);
      if (book) yield book;
    }

    fetched += items.length;
    startIndex += items.length;
    await sleep(REQUEST_DELAY_MS);
  }
}

async function main() {
  const { queries, maxPerQuery, dryRun, orderBy } = parseArgs(
    process.argv.slice(2),
  );
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

  if (!apiKey) {
    console.warn(
      "Attenzione: GOOGLE_BOOKS_API_KEY non impostata, la quota API sarà molto bassa.",
    );
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!dryRun && !mongoUri) {
    console.error("MONGODB_URI non impostata. Aggiungila a .env.local.");
    process.exit(1);
  }

  const client = dryRun || !mongoUri ? null : new MongoClient(mongoUri);
  let imported = 0;
  let refreshed = 0;
  let skippedEditions = 0;

  try {
    if (client) await client.connect();
    const collection = client
      ?.db(DB_NAME)
      .collection<ImportedBook>(COLLECTION_NAME);

    await collection?.createIndex({ workKey: 1 });

    for (const query of queries) {
      console.log(`Query: "${query}"`);

      for await (const book of fetchItalianBooks(
        query,
        maxPerQuery,
        orderBy,
        apiKey,
      )) {
        if (dryRun || !collection) {
          console.log(
            `  [dry-run] (${book.isbn}) ${book.title} — ${book.authors.join(", ") || "?"}`,
          );
          imported += 1;
          continue;
        }

        const sameEdition = await collection.findOne({ _id: book._id });
        if (sameEdition) {
          await collection.replaceOne({ _id: book._id }, book);
          refreshed += 1;
          continue;
        }

        const existingForWork = await collection.findOne({
          workKey: book.workKey,
        });
        if (!existingForWork) {
          await collection.insertOne(book);
          imported += 1;
          console.log(`  + ${book.title} (${book.year ?? "anno ignoto"})`);
        } else if (isEarlierEdition(book.year, existingForWork.year)) {
          await collection.deleteOne({ _id: existingForWork._id });
          await collection.insertOne(book);
          imported += 1;
          console.log(
            `  ~ ${book.title}: ${existingForWork.year ?? "?"} → ${book.year ?? "?"} (edizione più vecchia trovata)`,
          );
        } else {
          skippedEditions += 1;
        }
      }
    }
  } finally {
    await client?.close();
  }

  console.log(
    `Fatto. Nuove opere importate: ${imported}${
      dryRun
        ? ""
        : `, edizioni aggiornate: ${refreshed}, edizioni più recenti scartate: ${skippedEditions}`
    }.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
