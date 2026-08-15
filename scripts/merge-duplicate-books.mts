import { MongoClient } from "mongodb";
import {
  findWork,
  findWorkByTitleAuthor,
  type Translation,
} from "./lib/catalog-upsert.mts";

const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION ?? "books";

type StoredBook = {
  _id: string;
  authors: string[];
  year: number | null;
  categories: string[];
  alternateIsbns?: string[];
  translations?: Partial<Record<string, Translation>>;
  olWorkKey?: string | null;
  rating?: number | null;
  ratingsCount?: number | null;
  moodTags?: string[];
  series?: Array<{ name: string; position: number | null }>;
  pendingReview?: boolean;
};

function parseArgs(argv: string[]) {
  let max = 50;
  let dryRun = false;
  let force = false;
  for (const arg of argv) {
    if (arg.startsWith("--max=")) max = Number(arg.slice("--max=".length));
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--force") force = true;
  }
  return { max, dryRun, force };
}

function labelOf(doc: Pick<StoredBook, "translations" | "_id">): string {
  return Object.values(doc.translations ?? {}).find(Boolean)?.title ?? doc._id;
}

function canonicalIsbn(doc: StoredBook): string | null {
  return Object.values(doc.translations ?? {}).find(Boolean)?.isbn ?? null;
}

async function main() {
  const { max, dryRun, force } = parseArgs(process.argv.slice(2));

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI non impostata.");
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);
  await client.connect();

  let confirmed = 0;
  let merged = 0;
  let notFoundOnOL = 0;
  let skippedNoIsbn = 0;

  try {
    const collection = client
      .db(DB_NAME)
      .collection<StoredBook>(COLLECTION_NAME);

    const candidates = await collection
      .find(force ? { olWorkKey: null } : { pendingReview: true })
      .limit(max)
      .toArray();

    console.log(`${candidates.length} libri da controllare in questo run.\n`);

    for (const doc of candidates) {
      let workKey = doc.olWorkKey ?? null;

      if (!workKey) {
        const isbn = canonicalIsbn(doc);
        if (!isbn) {
          console.log(`  ✗ ${labelOf(doc)}: nessun isbn disponibile, salto`);
          skippedNoIsbn += 1;
          continue;
        }
        const work =
          (await findWork(isbn)) ??
          (await findWorkByTitleAuthor(labelOf(doc), doc.authors[0]));
        if (!work) {
          console.log(`  · ${labelOf(doc)}: non trovato su Open Library`);
          notFoundOnOL += 1;
          if (!dryRun) {
            await collection.updateOne(
              { _id: doc._id },
              { $unset: { pendingReview: "" } },
            );
          }
          continue;
        }
        workKey = work.workKey;
      }

      const duplicate = await collection.findOne({
        _id: { $ne: doc._id },
        olWorkKey: workKey,
      });

      if (!duplicate) {
        console.log(`  · ${labelOf(doc)}: nessun duplicato, confermato`);
        confirmed += 1;
        if (!dryRun) {
          await collection.updateOne(
            { _id: doc._id },
            {
              $set: { olWorkKey: workKey },
              $unset: { pendingReview: "" },
            },
          );
        }
        continue;
      }

      const survivor =
        !duplicate.pendingReview && doc.pendingReview
          ? duplicate
          : !doc.pendingReview && duplicate.pendingReview
            ? doc
            : duplicate;
      const loser = survivor === doc ? duplicate : doc;

      const mergedTranslations: Partial<Record<string, Translation>> = {
        ...survivor.translations,
      };
      const demotedIsbns: string[] = [];
      let itAdopted = false;
      let enAdopted = false;
      for (const [lang, translation] of Object.entries(
        loser.translations ?? {},
      )) {
        if (!translation) continue;
        const existing = mergedTranslations[lang];
        if (!existing) {
          mergedTranslations[lang] = translation;
          if (lang === "it") itAdopted = true;
          if (lang === "en") enAdopted = true;
        } else if (existing.isbn !== translation.isbn) {
          demotedIsbns.push(translation.isbn);
        }
      }

      const mergedAlternateIsbns = new Set([
        ...(survivor.alternateIsbns ?? []),
        ...(loser.alternateIsbns ?? []),
        ...demotedIsbns,
      ]);
      for (const translation of Object.values(mergedTranslations)) {
        if (translation) mergedAlternateIsbns.delete(translation.isbn);
      }

      const mergedYear =
        survivor.year != null && loser.year != null
          ? Math.min(survivor.year, loser.year)
          : (survivor.year ?? loser.year);

      const update: Record<string, unknown> = {
        translations: mergedTranslations,
        alternateIsbns: [...mergedAlternateIsbns],
        year: mergedYear,
        categories: [...new Set([...survivor.categories, ...loser.categories])],
        olWorkKey: workKey,
      };
      if (!survivor.moodTags?.length && loser.moodTags?.length) {
        update.moodTags = loser.moodTags;
      }
      if (!survivor.series?.length && loser.series?.length) {
        update.series = loser.series;
      }
      if (survivor.rating == null && loser.rating != null) {
        update.rating = loser.rating;
        update.ratingsCount = loser.ratingsCount;
      }

      const unset: {
        pendingReview: "";
        enrichedAt?: "";
        hardcoverCheckedAt?: "";
      } = { pendingReview: "" };
      if (itAdopted) unset.enrichedAt = "";
      if (enAdopted) unset.hardcoverCheckedAt = "";

      console.log(
        `  ⇄ ${labelOf(loser)} unito in "${labelOf(survivor)}" (olWorkKey ${workKey})`,
      );
      if (!dryRun) {
        await collection.updateOne(
          { _id: survivor._id },
          { $set: update, $unset: unset },
        );
        await collection.deleteOne({ _id: loser._id });
      }
      merged += 1;
    }
  } finally {
    await client.close();
  }

  console.log(
    `\n${dryRun ? "Report (nessuna scrittura)" : "Fatto"}: ${confirmed} confermati senza duplicati, ${merged} uniti, ${notFoundOnOL} non trovati su Open Library, ${skippedNoIsbn} scartati per isbn mancante.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
