import { MongoClient } from "mongodb";

const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION ?? "books";
const REQUEST_DELAY_MS = 500;
const USER_AGENT =
  "Spine (personal book catalog)";

type StoredBook = {
  _id: string;
  isbn: string | null;
  title: string;
  olWorkKey?: string | null;
  olRating?: number | null;
  olRatingsCount?: number | null;
  olCheckedAt?: Date;
};

type OpenLibraryRatingSummary = {
  average: number | null;
  count: number | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]) {
  let max = 150;
  let dryRun = false;
  for (const arg of argv) {
    if (arg.startsWith("--max=")) max = Number(arg.slice("--max=".length));
    else if (arg === "--dry-run") dryRun = true;
  }
  return { max, dryRun };
}

async function fetchOpenLibrary(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function resolveWorkKey(isbn: string): Promise<string | null> {
  const json = (await fetchOpenLibrary(
    `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&limit=1&fields=key`,
  )) as { docs?: Array<{ key?: string }> } | null;
  const key = json?.docs?.[0]?.key;
  return typeof key === "string" ? key.replace("/works/", "") : null;
}

async function fetchRatings(
  workKey: string,
): Promise<OpenLibraryRatingSummary> {
  const json = (await fetchOpenLibrary(
    `https://openlibrary.org/works/${workKey}/ratings.json`,
  )) as { summary?: { average?: number; count?: number } } | null;
  return {
    average: json?.summary?.average ?? null,
    count: json?.summary?.count ?? null,
  };
}

async function main() {
  const { max, dryRun } = parseArgs(process.argv.slice(2));

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI non impostata.");
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);
  await client.connect();

  let checked = 0;
  let found = 0;

  try {
    const collection = client
      .db(DB_NAME)
      .collection<StoredBook>(COLLECTION_NAME);

    const candidates = await collection
      .find({ olCheckedAt: { $exists: false }, isbn: { $ne: null } })
      .limit(max)
      .toArray();

    console.log(`${candidates.length} libri da controllare in questo run.`);

    for (const book of candidates) {
      if (!book.isbn) continue;

      const workKey = await resolveWorkKey(book.isbn);
      await sleep(REQUEST_DELAY_MS);

      const rating: OpenLibraryRatingSummary = workKey
        ? await fetchRatings(workKey)
        : { average: null, count: null };
      if (workKey) await sleep(REQUEST_DELAY_MS);

      checked += 1;
      if (rating.count) {
        found += 1;
        console.log(
          `  ✓ ${book.title}: ${rating.average?.toFixed(2)}★ (${rating.count} voti)`,
        );
      }

      if (!dryRun) {
        await collection.updateOne(
          { _id: book._id },
          {
            $set: {
              olWorkKey: workKey,
              olRating: rating.average,
              olRatingsCount: rating.count,
              olCheckedAt: new Date(),
            },
          },
        );
      }
    }
  } finally {
    await client.close();
  }

  console.log(
    `\n${dryRun ? "Report (nessuna scrittura)" : "Fatto"}: ${checked} controllati, ${found} con valutazioni trovate.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
