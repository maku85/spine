import { MongoClient } from "mongodb";
import {
  fetchGoogleBooksByIsbn,
  findItalianTranslation,
  findWork,
  type Translation,
} from "./lib/catalog-upsert.mts";

const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION ?? "books";
const LISTS_COLLECTION = process.env.MONGODB_LISTS_COLLECTION ?? "lists";
const ATTEMPTS_COLLECTION =
  process.env.MONGODB_LIST_ATTEMPTS_COLLECTION ?? "list_resolution_attempts";

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

type StoredBook = {
  _id: string;
  isbn: string | null;
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  description: string | null;
  categories: string[];
  language: string | null;
  alternateIsbns?: string[];
  source?: string;
  translations?: { it?: Translation; en?: Translation };
  listResolutionCheckedAt?: Date | null;
  pendingReview?: boolean;
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
  let withTranslation = 0;
  let skippedCollision = 0;

  try {
    const db = client.db(DB_NAME);
    const booksCollection = db.collection<StoredBook>(COLLECTION_NAME);
    const listsCollection = db.collection<ListDoc>(LISTS_COLLECTION);
    const attemptsCollection = db.collection<{
      _id: string;
      checkedAt: Date;
    }>(ATTEMPTS_COLLECTION);

    async function italianIsbnCollides(
      isbn: string,
      excludeId?: string,
    ): Promise<boolean> {
      const query: Record<string, unknown> = {
        $or: [
          { isbn },
          { alternateIsbns: isbn },
          { "translations.it.isbn": isbn },
        ],
      };
      if (excludeId) query._id = { $ne: excludeId };
      return Boolean(await booksCollection.findOne(query));
    }

    const retryQuery: Record<string, unknown> = {
      language: { $exists: true, $nin: [null, "it"] },
      "translations.it": { $exists: false },
    };
    if (!force) {
      retryQuery.$or = [
        { listResolutionCheckedAt: { $exists: false } },
        {
          listResolutionCheckedAt: {
            $lt: new Date(Date.now() - STALE_AFTER_MS),
          },
        },
      ];
    }
    const retryCandidates = await booksCollection
      .find(retryQuery)
      .limit(max)
      .toArray();

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
          { "translations.it.isbn": { $in: allIsbns } },
          { "translations.en.isbn": { $in: allIsbns } },
        ],
      })
      .toArray();

    const bookByIsbn = new Map<string, StoredBook>();
    for (const book of matchedBooks) {
      if (book.isbn) bookByIsbn.set(book.isbn, book);
      for (const alt of book.alternateIsbns ?? []) bookByIsbn.set(alt, book);
      if (book.translations?.it?.isbn)
        bookByIsbn.set(book.translations.it.isbn, book);
      if (book.translations?.en?.isbn)
        bookByIsbn.set(book.translations.en.isbn, book);
    }

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
      `${retryCandidates.length} libri senza traduzione italiana da riprovare, ${newCandidates.length} isbn mai visti da recuperare.\n`,
    );

    const claimedItalianIsbnsThisRun = new Set<string>();

    for (const book of retryCandidates) {
      const foreignIsbn = book.isbn as string;
      const work = await findWork(foreignIsbn);
      const translation = work
        ? await findItalianTranslation(work.workKey, googleApiKey)
        : null;

      if (!translation) {
        console.log(`  · ${book.title}: ancora nessuna edizione italiana`);
        if (!dryRun) {
          await booksCollection.updateOne(
            { _id: book._id },
            { $set: { listResolutionCheckedAt: new Date() } },
          );
        }
        continue;
      }

      if (
        claimedItalianIsbnsThisRun.has(translation.isbn) ||
        (await italianIsbnCollides(translation.isbn, book._id))
      ) {
        skippedCollision += 1;
        console.log(
          `  · ${book.title}: ${translation.isbn} già presente su un altro libro, salto`,
        );
        if (!dryRun) {
          await booksCollection.updateOne(
            { _id: book._id },
            { $set: { listResolutionCheckedAt: new Date() } },
          );
        }
        continue;
      }

      claimedItalianIsbnsThisRun.add(translation.isbn);
      upgraded += 1;
      withTranslation += 1;
      console.log(
        `  ✓ ${book.title} → "${translation.title}" (${translation.isbn})`,
      );

      if (!dryRun) {
        await booksCollection.updateOne(
          { _id: book._id },
          {
            $set: {
              "translations.it": translation,
              listResolutionCheckedAt: new Date(),
            },
          },
        );
      }
    }

    for (const isbn of newCandidates) {
      const entry = entryByIsbn.get(isbn) as ListEntry;

      const original = (await fetchGoogleBooksByIsbn(isbn, googleApiKey)) ?? {
        title: entry.title,
        authors: entry.author ? [entry.author] : [],
        year: null,
        publisher: null,
        description: null,
        categories: [],
        language: null,
      };

      const work = await findWork(isbn);
      const translation = work
        ? await findItalianTranslation(work.workKey, googleApiKey)
        : null;

      if (
        translation &&
        (claimedItalianIsbnsThisRun.has(translation.isbn) ||
          (await italianIsbnCollides(translation.isbn)))
      ) {
        skippedCollision += 1;
        console.log(
          `  · ${entry.title}: ${translation.isbn} già presente in catalogo, salto`,
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

      if (translation) claimedItalianIsbnsThisRun.add(translation.isbn);
      inserted += 1;
      if (translation) withTranslation += 1;
      console.log(
        translation
          ? `  + ${original.title} → traduzione "${translation.title}" (${translation.isbn})`
          : `  + ${original.title} (${original.language ?? "lingua ignota"}, nessuna edizione italiana)`,
      );

      if (!dryRun) {
        const doc: StoredBook = {
          _id: `list:${isbn}`,
          isbn,
          title: original.title,
          authors: original.authors.length
            ? original.authors
            : entry.author
              ? [entry.author]
              : [],
          year: work?.firstPublishYear ?? original.year,
          publisher: original.publisher,
          description: original.description,
          categories: original.categories,
          language: original.language,
          alternateIsbns: [],
          source: "list",
          listResolutionCheckedAt: new Date(),
          pendingReview: true,
          ...(translation ? { translations: { it: translation } } : {}),
        };
        await booksCollection.insertOne(doc);
      }
    }
  } finally {
    await client.close();
  }

  console.log(
    `\n${dryRun ? "Report (nessuna scrittura)" : "Fatto"}: ${inserted} nuovi libri inseriti, ${upgraded} arricchiti con traduzione italiana ora, ${withTranslation} con traduzione italiana in totale, ${skippedCollision} scartati per collisione isbn.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
