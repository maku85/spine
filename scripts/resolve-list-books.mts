import { MongoClient } from "mongodb";

const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION ?? "books";
const LISTS_COLLECTION = process.env.MONGODB_LISTS_COLLECTION ?? "lists";
const ATTEMPTS_COLLECTION =
  process.env.MONGODB_LIST_ATTEMPTS_COLLECTION ?? "list_resolution_attempts";

const USER_AGENT = "Spine (personal book catalog)";
const OL_REQUEST_DELAY_MS = 350;
const GOOGLE_REQUEST_DELAY_MS = 250;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 500;
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

type StoredBook = {
  _id: string;
  isbn: string | null;
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  description: string | null;
  categories: string[];
  alternateIsbns?: string[];
  englishIsbn?: string | null;
  source?: string;
  language?: string | null;
  listResolutionCheckedAt?: Date | null;
};

type ListEntry = {
  isbn: string;
  title: string;
  author: string | null;
  position: number | null;
};

type ListDoc = {
  _id: string;
  entries: ListEntry[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isStale(checkedAt: Date | null | undefined): boolean {
  return !checkedAt || Date.now() - checkedAt.getTime() > STALE_AFTER_MS;
}

function parseArgs(argv: string[]) {
  let max = 30;
  let dryRun = false;
  let force = false;
  for (const arg of argv) {
    if (arg.startsWith("--max=")) max = Number(arg.slice("--max=".length));
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--force") force = true;
  }
  return { max, dryRun, force };
}

async function fetchOpenLibrary(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchWithRetry(
  url: string,
  label: string,
): Promise<Response | null> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      if (attempt >= MAX_RETRIES) {
        console.warn(`  ${label}: nessuna risposta (timeout), salto.`);
        return null;
      }
      const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
      await sleep(delay);
      continue;
    }

    if (res.ok) return res;
    if (res.status === 404) return null;

    const retryable = RETRYABLE_STATUSES.has(res.status);
    if (!retryable || attempt >= MAX_RETRIES) {
      console.warn(`  ${label}: risposta ${res.status}, salto.`);
      return null;
    }

    const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
    await sleep(delay);
  }
}

function toIsbn13(isbn: string): string {
  if (isbn.length !== 10) return isbn;
  const core = `978${isbn.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return `${core}${check}`;
}

function hasItalianIsbnPrefix(isbn: string): boolean {
  return toIsbn13(isbn).startsWith("97888");
}

async function findWorkKey(isbn: string): Promise<string | null> {
  const json = (await fetchOpenLibrary(
    `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&limit=1&fields=key`,
  )) as { docs?: Array<{ key?: string }> } | null;
  await sleep(OL_REQUEST_DELAY_MS);

  const key = json?.docs?.[0]?.key;
  return key ? key.replace("/works/", "") : null;
}

async function findItalianEditionIsbns(workKey: string): Promise<string[]> {
  const json = (await fetchOpenLibrary(
    `https://openlibrary.org/works/${workKey}/editions.json?limit=200`,
  )) as {
    entries?: Array<{
      isbn_13?: string[];
      isbn_10?: string[];
      languages?: Array<{ key: string }>;
    }>;
  } | null;
  await sleep(OL_REQUEST_DELAY_MS);

  return (json?.entries ?? [])
    .filter((entry) =>
      (entry.languages ?? []).some((lang) => lang.key === "/languages/ita"),
    )
    .map((entry) => entry.isbn_13?.[0] ?? entry.isbn_10?.[0] ?? null)
    .filter((isbn): isbn is string =>
      Boolean(isbn && hasItalianIsbnPrefix(isbn)),
    );
}

type GoogleBooksMatch = {
  isbn: string;
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  description: string | null;
  categories: string[];
  language: string | null;
};

async function fetchGoogleBooksItalian(
  isbn: string,
  apiKey: string | undefined,
): Promise<GoogleBooksMatch | null> {
  const params = new URLSearchParams({ q: `isbn:${isbn}` });
  if (apiKey) params.set("key", apiKey);

  const res = await fetchWithRetry(
    `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
    `Google Books isbn:${isbn}`,
  );
  await sleep(GOOGLE_REQUEST_DELAY_MS);
  if (!res) return null;

  const info = (await res.json()).items?.[0]?.volumeInfo;
  if (!info?.title || info.language !== "it") return null;

  return {
    isbn,
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

async function resolveItalianEdition(
  foreignIsbn: string,
  googleApiKey: string | undefined,
): Promise<GoogleBooksMatch | null> {
  const workKey = await findWorkKey(foreignIsbn);
  if (!workKey) return null;

  const candidateIsbns = await findItalianEditionIsbns(workKey);
  for (const isbn of candidateIsbns) {
    const match = await fetchGoogleBooksItalian(isbn, googleApiKey);
    if (match) return match;
  }
  return null;
}

async function main() {
  const { max, dryRun, force } = parseArgs(process.argv.slice(2));

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI non impostata.");
    process.exit(1);
  }
  const googleApiKey = process.env.GOOGLE_BOOKS_API_KEY;

  const client = new MongoClient(mongoUri);
  await client.connect();

  let inserted = 0;
  let upgraded = 0;
  let notFound = 0;
  let skippedCollision = 0;

  try {
    const db = client.db(DB_NAME);
    const booksCollection = db.collection<StoredBook>(COLLECTION_NAME);
    const listsCollection = db.collection<ListDoc>(LISTS_COLLECTION);
    const attemptsCollection = db.collection<{
      _id: string;
      checkedAt: Date;
    }>(ATTEMPTS_COLLECTION);

    const lists = await listsCollection.find({}).toArray();
    const entryByIsbn = new Map<string, ListEntry>();
    for (const list of lists) {
      for (const entry of list.entries) {
        if (!entryByIsbn.has(entry.isbn)) entryByIsbn.set(entry.isbn, entry);
      }
    }
    const allIsbns = [...entryByIsbn.keys()];

    const matchedBooks = await booksCollection
      .find({
        $or: [
          { isbn: { $in: allIsbns } },
          { alternateIsbns: { $in: allIsbns } },
          { englishIsbn: { $in: allIsbns } },
        ],
      })
      .toArray();

    const bookByIsbn = new Map<string, StoredBook>();
    for (const book of matchedBooks) {
      if (book.isbn) bookByIsbn.set(book.isbn, book);
      for (const alt of book.alternateIsbns ?? []) bookByIsbn.set(alt, book);
      if (book.englishIsbn) bookByIsbn.set(book.englishIsbn, book);
    }

    const stubsToUpgrade = [
      ...new Map(
        allIsbns
          .map((isbn) => bookByIsbn.get(isbn))
          .filter(
            (book): book is StoredBook =>
              Boolean(book) &&
              book?.source === "nyt" &&
              book?.language === "en" &&
              (force || isStale(book.listResolutionCheckedAt)),
          )
          .map((book) => [book._id, book] as const),
      ).values(),
    ].slice(0, max);

    const unmatchedIsbns = allIsbns.filter((isbn) => !bookByIsbn.has(isbn));

    const attemptDocs = force
      ? []
      : await attemptsCollection
          .find({ _id: { $in: unmatchedIsbns } })
          .toArray();
    const recentlyAttempted = new Set(
      attemptDocs
        .filter((doc) => !isStale(doc.checkedAt))
        .map((doc) => doc._id),
    );
    const newCandidates = unmatchedIsbns
      .filter((isbn) => !recentlyAttempted.has(isbn))
      .slice(0, max);

    console.log(
      `${stubsToUpgrade.length} stub inglesi da provare ad aggiornare, ${newCandidates.length} isbn mai visti da provare a recuperare.\n`,
    );

    const resolvedIsbnsThisRun = new Set<string>();

    for (const stub of stubsToUpgrade) {
      const englishIsbn = stub.isbn as string;
      const resolved = await resolveItalianEdition(englishIsbn, googleApiKey);

      if (!resolved) {
        notFound += 1;
        console.log(`  ✗ ${stub.title}: nessuna edizione italiana trovata`);
        if (!dryRun) {
          await booksCollection.updateOne(
            { _id: stub._id },
            { $set: { listResolutionCheckedAt: new Date() } },
          );
        }
        continue;
      }

      if (resolvedIsbnsThisRun.has(resolved.isbn)) {
        skippedCollision += 1;
        console.log(
          `  · ${stub.title}: ${resolved.isbn} già usato in questo run, salto`,
        );
        continue;
      }
      const collision = await booksCollection.findOne({
        _id: { $ne: stub._id },
        $or: [{ isbn: resolved.isbn }, { alternateIsbns: resolved.isbn }],
      });
      if (collision) {
        skippedCollision += 1;
        console.log(
          `  · ${stub.title}: ${resolved.isbn} già presente su un altro libro, salto`,
        );
        if (!dryRun) {
          await booksCollection.updateOne(
            { _id: stub._id },
            { $set: { listResolutionCheckedAt: new Date() } },
          );
        }
        continue;
      }

      resolvedIsbnsThisRun.add(resolved.isbn);
      upgraded += 1;
      console.log(`  ✓ ${stub.title} → "${resolved.title}" (${resolved.isbn})`);

      if (!dryRun) {
        await booksCollection.updateOne(
          { _id: stub._id },
          {
            $set: {
              isbn: resolved.isbn,
              title: resolved.title,
              authors: resolved.authors.length
                ? resolved.authors
                : stub.authors,
              year: resolved.year ?? stub.year,
              publisher: resolved.publisher,
              description: resolved.description,
              categories: resolved.categories.length
                ? resolved.categories
                : stub.categories,
              englishIsbn,
              language: resolved.language,
              source: "list",
            },
          },
        );
      }
    }

    for (const isbn of newCandidates) {
      const entry = entryByIsbn.get(isbn) as ListEntry;
      const resolved = await resolveItalianEdition(isbn, googleApiKey);

      if (!resolved) {
        notFound += 1;
        console.log(`  ✗ ${entry.title}: nessuna edizione italiana trovata`);
        if (!dryRun) {
          await attemptsCollection.updateOne(
            { _id: isbn },
            { $set: { checkedAt: new Date() } },
            { upsert: true },
          );
        }
        continue;
      }

      if (resolvedIsbnsThisRun.has(resolved.isbn)) {
        skippedCollision += 1;
        console.log(
          `  · ${entry.title}: ${resolved.isbn} già usato in questo run, salto`,
        );
        continue;
      }
      const collision = await booksCollection.findOne({
        $or: [{ isbn: resolved.isbn }, { alternateIsbns: resolved.isbn }],
      });
      if (collision) {
        skippedCollision += 1;
        console.log(
          `  · ${entry.title}: ${resolved.isbn} già presente in catalogo, salto`,
        );
        if (!dryRun) {
          await attemptsCollection.updateOne(
            { _id: isbn },
            { $set: { checkedAt: new Date() } },
            { upsert: true },
          );
        }
        continue;
      }

      resolvedIsbnsThisRun.add(resolved.isbn);
      inserted += 1;
      console.log(
        `  + ${entry.title} → "${resolved.title}" (${resolved.isbn})`,
      );

      if (!dryRun) {
        const doc: StoredBook = {
          _id: `list:${resolved.isbn}`,
          isbn: resolved.isbn,
          title: resolved.title,
          authors: resolved.authors.length
            ? resolved.authors
            : entry.author
              ? [entry.author]
              : [],
          year: resolved.year,
          publisher: resolved.publisher,
          description: resolved.description,
          categories: resolved.categories,
          alternateIsbns: [],
          englishIsbn: isbn,
          source: "list",
          language: resolved.language,
        };
        await booksCollection.insertOne(doc);
      }
    }
  } finally {
    await client.close();
  }

  console.log(
    `\n${dryRun ? "Report (nessuna scrittura)" : "Fatto"}: ${inserted} nuovi libri inseriti, ${upgraded} stub aggiornati, ${notFound} senza edizione italiana, ${skippedCollision} scartati per collisione isbn.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
