import { MongoClient } from "mongodb";
import {
  computeWorkKey,
  fetchGoogleBooksByIsbn,
  findItalianTranslation,
  findWork,
  isNarrativa,
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
  authors: string[];
  year: number | null;
  categories: string[];
  alternateIsbns?: string[];
  translations?: Partial<Record<string, Translation>>;
  olWorkKey?: string | null;
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
  let skippedNonFiction = 0;

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
        $or: [{ alternateIsbns: isbn }, { "translations.it.isbn": isbn }],
      };
      if (excludeId) query._id = { $ne: excludeId };
      return Boolean(await booksCollection.findOne(query));
    }

    const retryQuery: Record<string, unknown> = {
      "translations.it": { $exists: false },
      pendingReview: { $ne: true },
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
      .aggregate<StoredBook>([
        {
          $addFields: {
            _translationIsbns: {
              $map: {
                input: { $objectToArray: { $ifNull: ["$translations", {}] } },
                as: "t",
                in: "$$t.v.isbn",
              },
            },
          },
        },
        {
          $match: {
            $or: [
              { alternateIsbns: { $in: allIsbns } },
              { _translationIsbns: { $in: allIsbns } },
            ],
          },
        },
        { $unset: "_translationIsbns" },
      ])
      .toArray();

    const bookByIsbn = new Map<string, StoredBook>();
    for (const book of matchedBooks) {
      for (const alt of book.alternateIsbns ?? []) bookByIsbn.set(alt, book);
      for (const translation of Object.values(book.translations ?? {})) {
        if (translation?.isbn) bookByIsbn.set(translation.isbn, book);
      }
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
      const foreignTranslation = Object.values(book.translations ?? {}).find(
        Boolean,
      );
      if (!foreignTranslation) continue;

      const work = book.olWorkKey
        ? { workKey: book.olWorkKey, firstPublishYear: null }
        : await findWork(foreignTranslation.isbn);
      const translation = work
        ? await findItalianTranslation(work.workKey, googleApiKey)
        : null;

      if (!translation) {
        console.log(
          `  · ${foreignTranslation.title}: ancora nessuna edizione italiana`,
        );
        if (!dryRun) {
          await booksCollection.updateOne(
            { _id: book._id },
            {
              $set: {
                listResolutionCheckedAt: new Date(),
                ...(work ? { olWorkKey: work.workKey } : {}),
              },
            },
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
          `  · ${foreignTranslation.title}: ${translation.isbn} già presente su un altro libro, salto`,
        );
        if (!dryRun) {
          await booksCollection.updateOne(
            { _id: book._id },
            {
              $set: {
                listResolutionCheckedAt: new Date(),
                ...(work ? { olWorkKey: work.workKey } : {}),
              },
            },
          );
        }
        continue;
      }

      claimedItalianIsbnsThisRun.add(translation.isbn);
      upgraded += 1;
      withTranslation += 1;
      console.log(
        `  ✓ ${foreignTranslation.title} → "${translation.title}" (${translation.isbn})`,
      );

      if (!dryRun) {
        await booksCollection.updateOne(
          { _id: book._id },
          {
            $set: {
              "translations.it": translation,
              listResolutionCheckedAt: new Date(),
              olWorkKey: work?.workKey,
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
      if (!isNarrativa(original.categories)) {
        skippedNonFiction += 1;
        console.log(
          `  · ${original.title}: non narrativa (${original.categories.join(", ") || "nessuna categoria"}), salto`,
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

      const lang = original.language ?? "en";

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
          : `  + ${original.title} (${lang}, nessuna edizione italiana)`,
      );

      if (!dryRun) {
        const authors = original.authors.length
          ? original.authors
          : entry.author
            ? [entry.author]
            : [];
        const originalTranslation: Translation = {
          isbn,
          title: original.title,
          description: original.description,
          workKey: computeWorkKey(original.title, authors[0]),
        };
        const doc: StoredBook = {
          _id: `list:${isbn}`,
          authors,
          year: work?.firstPublishYear ?? original.year,
          categories: original.categories,
          alternateIsbns: [],
          translations: {
            [lang]: originalTranslation,
            ...(translation ? { it: translation } : {}),
          },
          listResolutionCheckedAt: new Date(),
          pendingReview: true,
          ...(work ? { olWorkKey: work.workKey } : {}),
        };
        await booksCollection.insertOne(doc);
      }
    }
  } finally {
    await client.close();
  }

  console.log(
    `\n${dryRun ? "Report (nessuna scrittura)" : "Fatto"}: ${inserted} nuovi libri inseriti, ${upgraded} arricchiti con traduzione italiana ora, ${withTranslation} con traduzione italiana in totale, ${skippedCollision} scartati per collisione isbn, ${skippedNonFiction} scartati perché non narrativa.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
