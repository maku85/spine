import { MongoClient } from "mongodb";
import { computeWorkKey, type Translation } from "./lib/catalog-upsert.mts";

const GOOGLE_BOOKS_ENDPOINT = "https://www.googleapis.com/books/v1/volumes";
const PAGE_SIZE = 40;
const REQUEST_DELAY_MS = 250;
const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION ?? "books";

const DEFAULT_QUERIES_BY_LANG: Record<string, string[]> = {
  it: [
    "romanzo",
    "romanzo fantascienza",
    "romanzo fantasy",
    "romanzo giallo",
    "romanzo storico",
    "racconti",
  ],
  en: [
    "novel",
    "science fiction novel",
    "fantasy novel",
    "mystery novel",
    "historical novel",
    "short stories",
  ],
};

const STUDY_GUIDE_PATTERNS: Record<string, RegExp> = {
  it: /analisi del libro|riassunto|guida (alla lettura|allo studio)|scheda (di lettura|libro)/i,
  en: /study guide|book summary|summary of|sparknotes|reading guide|literature guide/i,
};

type GoogleBooksVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    categories?: string[];
    language?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
  };
};

type GoogleBooksResponse = {
  totalItems?: number;
  items?: GoogleBooksVolume[];
};

type ImportedBook = {
  _id: string;
  lang: string;
  authors: string[];
  year: number | null;
  categories: string[];
  translation: Translation;
};

type StoredBook = {
  _id: string;
  authors: string[];
  year: number | null;
  categories: string[];
  alternateIsbns: string[];
  translations: Partial<Record<string, Translation>>;
  pendingReview?: boolean;
  enrichedAt?: Date;
};

function labelOf(doc: Pick<StoredBook, "translations">): string {
  const entry = Object.values(doc.translations ?? {}).find(Boolean);
  return entry?.title ?? "?";
}

function parseArgs(argv: string[]) {
  const queries: string[] = [];
  let maxPerQuery = 200;
  let dryRun = false;
  let orderBy: "relevance" | "newest" = "relevance";
  let langs = ["it", "en"];

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
    } else if (arg.startsWith("--lang=")) {
      langs = arg
        .slice("--lang=".length)
        .split(",")
        .map((lang) => lang.trim())
        .filter(Boolean);
    } else {
      queries.push(arg);
    }
  }

  for (const lang of langs) {
    if (!(lang in DEFAULT_QUERIES_BY_LANG) && queries.length === 0) {
      throw new Error(
        `Nessuna query predefinita per la lingua "${lang}": passa query esplicite.`,
      );
    }
  }

  return { queries, maxPerQuery, dryRun, orderBy, langs };
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

function isStudyGuide(title: string, lang: string): boolean {
  return STUDY_GUIDE_PATTERNS[lang]?.test(title) ?? false;
}

function toImportedBook(
  volume: GoogleBooksVolume,
  lang: string,
): ImportedBook | null {
  const info = volume.volumeInfo;
  if (!info?.title || info.language !== lang) return null;
  if (isStudyGuide(info.title, lang)) return null;

  const isbn = extractIsbn(info.industryIdentifiers);
  if (!isbn) return null;

  const categories = info.categories ?? [];
  if (!isNarrativa(categories)) return null;

  const authors = info.authors ?? [];

  return {
    _id: volume.id,
    lang,
    authors,
    year: extractYear(info.publishedDate),
    categories,
    translation: {
      isbn,
      title: info.title,
      description: info.description ?? null,
      workKey: computeWorkKey(info.title, authors[0]),
    },
  };
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 6;
const RETRY_BASE_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 20_000;

async function fetchPage(
  query: string,
  lang: string,
  startIndex: number,
  orderBy: "relevance" | "newest",
  apiKey: string | undefined,
): Promise<GoogleBooksResponse> {
  const params = new URLSearchParams({
    q: query,
    langRestrict: lang,
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

    const delay = Math.min(
      RETRY_BASE_DELAY_MS * 2 ** attempt,
      MAX_RETRY_DELAY_MS,
    );
    console.warn(
      `  Google Books ha risposto ${res.status} (tentativo ${attempt + 1}/${MAX_RETRIES}), riprovo tra ${delay}ms...`,
    );
    await sleep(delay);
  }
}

async function* fetchBooksForLanguage(
  query: string,
  lang: string,
  maxPerQuery: number,
  orderBy: "relevance" | "newest",
  apiKey: string | undefined,
): AsyncGenerator<ImportedBook> {
  let startIndex = 0;
  let fetched = 0;
  let totalItems = Number.POSITIVE_INFINITY;

  while (startIndex < totalItems && fetched < maxPerQuery) {
    const page = await fetchPage(query, lang, startIndex, orderBy, apiKey);
    totalItems = page.totalItems ?? 0;

    const items = page.items ?? [];
    if (items.length === 0) break;

    for (const volume of items) {
      const book = toImportedBook(volume, lang);
      if (book) yield book;
    }

    fetched += items.length;
    startIndex += items.length;
    await sleep(REQUEST_DELAY_MS);
  }
}

async function main() {
  const { queries, maxPerQuery, dryRun, orderBy, langs } = parseArgs(
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
  let skippedKnownIsbn = 0;

  try {
    if (client) await client.connect();
    const collection = client
      ?.db(DB_NAME)
      .collection<StoredBook>(COLLECTION_NAME);

    await collection?.createIndex({ "translations.it.workKey": 1 });
    await collection?.createIndex({ "translations.en.workKey": 1 });

    for (const lang of langs) {
      const langQueries =
        queries.length > 0 ? queries : DEFAULT_QUERIES_BY_LANG[lang];

      for (const query of langQueries) {
        console.log(`Query [${lang}]: "${query}"`);

        for await (const book of fetchBooksForLanguage(
          query,
          lang,
          maxPerQuery,
          orderBy,
          apiKey,
        )) {
          if (dryRun || !collection) {
            console.log(
              `  [dry-run] (${book.translation.isbn}) ${book.translation.title} — ${book.authors.join(", ") || "?"}`,
            );
            imported += 1;
            continue;
          }

          const sameEdition = await collection.findOne({ _id: book._id });
          if (sameEdition) {
            const currentTranslation = sameEdition.translations?.[book.lang];
            if (sameEdition.enrichedAt) {
              const freshIsbn =
                currentTranslation?.isbn !== book.translation.isbn
                  ? book.translation.isbn
                  : null;
              await collection.updateOne(
                { _id: book._id },
                {
                  $set: {
                    authors: book.authors,
                    year: book.year,
                    categories: book.categories,
                  },
                  ...(freshIsbn
                    ? { $addToSet: { alternateIsbns: freshIsbn } }
                    : {}),
                },
              );
            } else {
              const displacedIsbn =
                currentTranslation?.isbn &&
                currentTranslation.isbn !== book.translation.isbn
                  ? currentTranslation.isbn
                  : null;
              await collection.updateOne(
                { _id: book._id },
                {
                  $set: {
                    authors: book.authors,
                    year: book.year,
                    categories: book.categories,
                    [`translations.${book.lang}`]: book.translation,
                  },
                  ...(displacedIsbn
                    ? { $addToSet: { alternateIsbns: displacedIsbn } }
                    : {}),
                },
              );
            }
            refreshed += 1;
            continue;
          }

          const knownByIsbn = await collection.findOne({
            $or: [
              { alternateIsbns: book.translation.isbn },
              { "translations.it.isbn": book.translation.isbn },
              { "translations.en.isbn": book.translation.isbn },
            ],
          });
          if (knownByIsbn) {
            const isCanonicalSomewhere = Object.values(
              knownByIsbn.translations ?? {},
            ).some((t) => t?.isbn === book.translation.isbn);
            if (!isCanonicalSomewhere) {
              await collection.updateOne(
                { _id: knownByIsbn._id },
                { $addToSet: { alternateIsbns: book.translation.isbn } },
              );
            }
            skippedKnownIsbn += 1;
            console.log(
              `  = ${book.translation.title}: isbn già noto su "${labelOf(knownByIsbn)}", salto`,
            );
            continue;
          }

          const existingForWork = await collection.findOne({
            [`translations.${book.lang}.workKey`]: book.translation.workKey,
          });

          if (!existingForWork) {
            await collection.insertOne({
              _id: book._id,
              authors: book.authors,
              year: book.year,
              categories: book.categories,
              alternateIsbns: [],
              translations: { [book.lang]: book.translation },
              pendingReview: true,
            });
            imported += 1;
            console.log(
              `  + ${book.translation.title} (${book.year ?? "anno ignoto"})`,
            );
          } else if (isEarlierEdition(book.year, existingForWork.year)) {
            const { _id: _oldId, ...rest } = existingForWork;
            const existingTranslation = rest.translations?.[book.lang];
            const carriedIsbns = new Set(
              [
                existingTranslation?.isbn,
                ...(rest.alternateIsbns ?? []),
              ].filter(
                (candidate): candidate is string =>
                  Boolean(candidate) && candidate !== book.translation.isbn,
              ),
            );
            await collection.deleteOne({ _id: existingForWork._id });
            await collection.insertOne({
              ...rest,
              _id: book._id,
              authors: book.authors,
              year: book.year,
              categories: book.categories,
              alternateIsbns: [...carriedIsbns],
              translations: {
                ...rest.translations,
                [book.lang]: book.translation,
              },
              pendingReview: true,
            });
            imported += 1;
            console.log(
              `  ~ ${book.translation.title}: ${existingForWork.year ?? "?"} → ${book.year ?? "?"} (edizione più vecchia trovata)`,
            );
          } else {
            if (
              book.translation.isbn !==
              existingForWork.translations?.[book.lang]?.isbn
            ) {
              await collection.updateOne(
                { _id: existingForWork._id },
                { $addToSet: { alternateIsbns: book.translation.isbn } },
              );
            }
            skippedEditions += 1;
          }
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
        : `, edizioni aggiornate: ${refreshed}, edizioni più recenti scartate: ${skippedEditions}, isbn già noti scartati: ${skippedKnownIsbn}`
    }.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
