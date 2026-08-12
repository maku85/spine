import { MongoClient } from "mongodb";
import { normalizeTitle } from "../src/lib/text.ts";
import { DEFAULT_NYT_LISTS } from "./data/nyt-lists.mts";

const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION ?? "books";

const NYT_REQUEST_DELAY_MS = 13_000;
const GOOGLE_REQUEST_DELAY_MS = 250;

type NytBook = {
  rank: number;
  rankLastWeek: number;
  weeksOnList: number;
  isbn: string | null;
  title: string;
  author: string | null;
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
  averageRating: number | null;
  ratingsCount: number | null;
  workKey?: string;
  alternateIsbns?: string[];
  source?: string;
  language?: string | null;
  nytRank?: number;
  nytRankLastWeek?: number;
  nytWeeksOnList?: number;
  nytListName?: string;
  nytCheckedAt?: Date;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]) {
  return { dryRun: argv.includes("--dry-run") };
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 500;

async function fetchWithRetry(
  url: string,
  label: string,
): Promise<Response | null> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res;
    if (res.status === 404) return null;

    const retryable = RETRYABLE_STATUSES.has(res.status);
    if (!retryable || attempt >= MAX_RETRIES) {
      console.warn(`  ${label}: risposta ${res.status}, salto.`);
      return null;
    }

    const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
    console.warn(
      `  ${label}: risposta ${res.status} (tentativo ${attempt + 1}/${MAX_RETRIES}), riprovo tra ${delay}ms...`,
    );
    await sleep(delay);
  }
}

async function fetchNytList(
  listName: string,
  apiKey: string,
): Promise<NytBook[]> {
  const url = `https://api.nytimes.com/svc/books/v3/lists/current/${listName}.json?api-key=${apiKey}`;
  const res = await fetchWithRetry(url, `NYT ${listName}`);
  if (!res) return [];

  const json = await res.json();
  const books: Array<{
    rank?: number;
    rank_last_week?: number;
    weeks_on_list?: number;
    primary_isbn13?: string;
    title?: string;
    author?: string;
  }> = json.results?.books ?? [];

  return books
    .filter((b) => b.title)
    .map((b) => ({
      rank: b.rank ?? 0,
      rankLastWeek: b.rank_last_week ?? 0,
      weeksOnList: b.weeks_on_list ?? 0,
      isbn: b.primary_isbn13 ?? null,
      title: b.title as string,
      author: b.author ?? null,
    }));
}

type GoogleBookMatch = {
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  description: string | null;
  categories: string[];
  language: string | null;
};

async function fetchFromGoogleBooksByIsbn(
  isbn: string,
  apiKey: string | undefined,
): Promise<GoogleBookMatch | null> {
  const params = new URLSearchParams({ q: `isbn:${isbn}` });
  if (apiKey) params.set("key", apiKey);

  const res = await fetchWithRetry(
    `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
    `Google Books isbn:${isbn}`,
  );
  await sleep(GOOGLE_REQUEST_DELAY_MS);
  if (!res) return null;

  const info = (await res.json()).items?.[0]?.volumeInfo;
  if (!info?.title) return null;

  return {
    title: info.title,
    authors: info.authors ?? [],
    year: info.publishedDate
      ? Number(info.publishedDate.slice(0, 4)) || null
      : null,
    publisher: info.publisher ?? null,
    description: info.description ?? null,
    categories: info.categories ?? [],
    language: info.language ?? null,
  };
}

function workKeyFor(title: string, authors: string[]): string {
  return `${normalizeTitle(title)}::${normalizeTitle(authors[0] ?? "")}`;
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));

  const nytApiKey = process.env.NYT_BOOKS_API_KEY;
  if (!nytApiKey) {
    console.error("NYT_BOOKS_API_KEY non impostata.");
    process.exit(1);
  }
  const googleApiKey = process.env.GOOGLE_BOOKS_API_KEY;

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI non impostata.");
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);
  await client.connect();

  let matched = 0;
  let inserted = 0;
  let skipped = 0;

  try {
    const collection = client
      .db(DB_NAME)
      .collection<StoredBook>(COLLECTION_NAME);

    for (const [index, { listName, label }] of DEFAULT_NYT_LISTS.entries()) {
      console.log(`NYT: "${listName}" (${label})`);
      const books = await fetchNytList(listName, nytApiKey);
      if (index < DEFAULT_NYT_LISTS.length - 1)
        await sleep(NYT_REQUEST_DELAY_MS);

      for (const nytBook of books) {
        const existing = nytBook.isbn
          ? await collection.findOne({
              $or: [{ isbn: nytBook.isbn }, { alternateIsbns: nytBook.isbn }],
            })
          : await collection.findOne({
              workKey: workKeyFor(
                nytBook.title,
                nytBook.author ? [nytBook.author] : [],
              ),
            });

        const nytFields = {
          nytRank: nytBook.rank,
          nytRankLastWeek: nytBook.rankLastWeek,
          nytWeeksOnList: nytBook.weeksOnList,
          nytListName: label,
          nytCheckedAt: new Date(),
        };

        if (existing) {
          matched += 1;
          console.log(`  = ${nytBook.title}: già in catalogo, aggiorno rank`);
          if (!dryRun) {
            await collection.updateOne(
              { _id: existing._id },
              { $set: nytFields },
            );
          }
          continue;
        }

        if (!nytBook.isbn) {
          skipped += 1;
          continue;
        }

        const googleMatch = await fetchFromGoogleBooksByIsbn(
          nytBook.isbn,
          googleApiKey,
        );
        if (!googleMatch) {
          skipped += 1;
          console.log(
            `  ✗ ${nytBook.title}: non trovato su Google Books, salto`,
          );
          continue;
        }

        const authors =
          googleMatch.authors.length > 0
            ? googleMatch.authors
            : nytBook.author
              ? [nytBook.author]
              : [];

        const doc: StoredBook = {
          _id: `nyt:${nytBook.isbn}`,
          isbn: nytBook.isbn,
          title: googleMatch.title,
          authors,
          year: googleMatch.year,
          publisher: googleMatch.publisher,
          description: googleMatch.description,
          categories: googleMatch.categories,
          averageRating: null,
          ratingsCount: null,
          workKey: workKeyFor(googleMatch.title, authors),
          alternateIsbns: [],
          source: "nyt",
          language: googleMatch.language,
          ...nytFields,
        };

        inserted += 1;
        console.log(
          `  + ${doc.title} (${doc.language ?? "lingua ignota"}, nuovo in catalogo)`,
        );
        // Il ramo "existing" più sopra intercetta già i re-run su questo
        // stesso ISBN (isbn/alternateIsbns), quindi questo _id non può
        // esistere ancora: insertOne semplice, niente upsert.
        if (!dryRun) {
          await collection.insertOne(doc);
        }
      }
    }
  } finally {
    await client.close();
  }

  console.log(
    `\n${dryRun ? "Report (nessuna scrittura)" : "Fatto"}: ${matched} già in catalogo aggiornati, ${inserted} nuovi importati da Google Books, ${skipped} non risolti.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
