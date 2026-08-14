import { MongoClient } from "mongodb";
import { DEFAULT_NYT_LISTS } from "./data/nyt-lists.mts";

const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const LISTS_COLLECTION = process.env.MONGODB_LISTS_COLLECTION ?? "lists";

const NYT_REQUEST_DELAY_MS = 13_000;

type NytBook = {
  rank: number;
  isbn: string | null;
  title: string;
  author: string | null;
};

type ListEntry = {
  isbn: string;
  title: string;
  author: string | null;
  position: number | null;
};

type ListDoc = {
  _id: string;
  source: "nyt";
  externalId: string;
  name: string;
  description: string | null;
  followersCount: number | null;
  entries: ListEntry[];
  updatedAt: Date;
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
    primary_isbn13?: string;
    title?: string;
    author?: string;
  }> = json.results?.books ?? [];

  return books
    .filter((b) => b.title)
    .map((b) => ({
      rank: b.rank ?? 0,
      isbn: b.primary_isbn13 ?? null,
      title: b.title as string,
      author: b.author ?? null,
    }));
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));

  const nytApiKey = process.env.NYT_BOOKS_API_KEY;
  if (!nytApiKey) {
    console.error("NYT_BOOKS_API_KEY non impostata.");
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI non impostata.");
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);
  await client.connect();

  let imported = 0;
  let totalEntries = 0;

  try {
    const listsCollection = client
      .db(DB_NAME)
      .collection<ListDoc>(LISTS_COLLECTION);

    for (const [index, { listName, label }] of DEFAULT_NYT_LISTS.entries()) {
      console.log(`NYT: "${listName}" (${label})`);
      const books = await fetchNytList(listName, nytApiKey);
      if (index < DEFAULT_NYT_LISTS.length - 1)
        await sleep(NYT_REQUEST_DELAY_MS);

      const entries = books
        .filter((b) => b.isbn)
        .map((b) => ({
          isbn: b.isbn as string,
          title: b.title,
          author: b.author,
          position: b.rank,
        }));

      const listDoc: ListDoc = {
        _id: `nyt:${listName}`,
        source: "nyt",
        externalId: listName,
        name: label,
        description: null,
        followersCount: null,
        entries,
        updatedAt: new Date(),
      };

      totalEntries += entries.length;
      console.log(`  ✓ ${entries.length} libri con isbn`);

      if (!dryRun) {
        await listsCollection.updateOne(
          { _id: listDoc._id },
          { $set: listDoc },
          { upsert: true },
        );
      }
      imported += 1;
    }
  } finally {
    await client.close();
  }

  console.log(
    `\n${dryRun ? "Report (nessuna scrittura)" : "Fatto"}: ${imported} liste importate, ${totalEntries} riferimenti a libri totali.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
