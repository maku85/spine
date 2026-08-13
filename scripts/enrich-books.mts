import { MongoClient } from "mongodb";
import { curateGenres } from "../src/lib/genres.ts";
import { isItalian } from "../src/lib/language.ts";
import { normalizeTitle } from "../src/lib/text.ts";

const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION ?? "books";
const REQUEST_DELAY_MS = 350;
const USER_AGENT = "Spine (personal book catalog)";
const MIN_DESCRIPTION_LENGTH = 60;

type StoredBook = {
  _id: string;
  isbn: string | null;
  title: string;
  authors: string[];
  year: number | null;
  description: string | null;
  categories: string[];
  alternateIsbns?: string[];
  olWorkKey?: string | null;
  olRating?: number | null;
  olRatingsCount?: number | null;
  olCheckedAt?: Date;
  enrichedAt?: Date;
  englishIsbn?: string | null;
};

type OLWorkMatch = {
  workKey: string;
  firstPublishYear: number | null;
};

type OLEdition = {
  isbn: string | null;
  year: number | null;
};

type OLEditionEntry = {
  isbn_13?: string[];
  isbn_10?: string[];
  publish_date?: string;
  languages?: Array<{ key: string }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]) {
  let max = 100;
  let dryRun = false;
  let force = false;
  let isbn: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith("--max=")) max = Number(arg.slice("--max=".length));
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--force") force = true;
    else if (arg.startsWith("--isbn=")) isbn = arg.slice("--isbn=".length);
  }
  return { max, dryRun, force, isbn };
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

function keepItalianParagraphs(description: string): string {
  const paragraphs = description
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1) return description;

  const italian = paragraphs.filter((paragraph) => isItalian(paragraph));
  return italian.length > 0 ? italian.join("\n\n") : description;
}

async function findWorkByIsbn(isbn: string): Promise<OLWorkMatch | null> {
  const json = (await fetchOpenLibrary(
    `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&limit=1&fields=key,first_publish_year`,
  )) as {
    docs?: Array<{
      key?: string;
      first_publish_year?: number;
    }>;
  } | null;

  const doc = json?.docs?.[0];
  if (!doc?.key) return null;

  return {
    workKey: doc.key.replace("/works/", ""),
    firstPublishYear: doc.first_publish_year ?? null,
  };
}

async function findWorkByTitleAuthor(
  title: string,
  author: string | undefined,
): Promise<OLWorkMatch | null> {
  const q = [title, author].filter(Boolean).join(" ");
  const json = (await fetchOpenLibrary(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5&fields=key,title,author_name,first_publish_year`,
  )) as {
    docs?: Array<{
      key?: string;
      title?: string;
      author_name?: string[];
      first_publish_year?: number;
    }>;
  } | null;

  const wantedTitle = normalizeTitle(title);
  const wantedAuthor = author ? normalizeTitle(author) : null;

  const match = json?.docs?.find(
    (doc) =>
      doc.key &&
      normalizeTitle(doc.title ?? "") === wantedTitle &&
      (!wantedAuthor ||
        (doc.author_name ?? []).some(
          (name) => normalizeTitle(name) === wantedAuthor,
        )),
  );
  if (!match?.key) return null;

  return {
    workKey: match.key.replace("/works/", ""),
    firstPublishYear: match.first_publish_year ?? null,
  };
}

async function resolveWork(book: StoredBook): Promise<OLWorkMatch | null> {
  const candidateIsbns = [book.isbn, ...(book.alternateIsbns ?? [])].filter(
    (value): value is string => Boolean(value),
  );

  for (const isbn of candidateIsbns.slice(0, 3)) {
    const match = await findWorkByIsbn(isbn);
    await sleep(REQUEST_DELAY_MS);
    if (match) return match;
  }

  const byTitle = await findWorkByTitleAuthor(book.title, book.authors[0]);
  await sleep(REQUEST_DELAY_MS);
  return byTitle;
}

async function fetchWorkDescription(
  workKey: string,
): Promise<{ description: string | null; subjects: string[] }> {
  const json = (await fetchOpenLibrary(
    `https://openlibrary.org/works/${workKey}.json`,
  )) as { description?: string | { value?: string }; subjects?: unknown };
  await sleep(REQUEST_DELAY_MS);

  const raw =
    typeof json?.description === "string"
      ? json.description
      : typeof json?.description === "object" &&
          typeof json.description?.value === "string"
        ? json.description.value
        : null;

  return {
    description: raw ? keepItalianParagraphs(raw) : null,
    subjects: curateGenres(json?.subjects),
  };
}

async function fetchRatings(
  workKey: string,
): Promise<{ average: number | null; count: number | null }> {
  const json = (await fetchOpenLibrary(
    `https://openlibrary.org/works/${workKey}/ratings.json`,
  )) as { summary?: { average?: number; count?: number } } | null;
  await sleep(REQUEST_DELAY_MS);

  return {
    average: json?.summary?.average ?? null,
    count: json?.summary?.count ?? null,
  };
}

function extractYearLoose(text: string | undefined): number | null {
  if (!text) return null;
  const match = text.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return match ? Number(match[1]) : null;
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

async function fetchEditionEntries(workKey: string): Promise<OLEditionEntry[]> {
  const json = (await fetchOpenLibrary(
    `https://openlibrary.org/works/${workKey}/editions.json?limit=50`,
  )) as { entries?: OLEditionEntry[] } | null;
  await sleep(REQUEST_DELAY_MS);

  return json?.entries ?? [];
}

function editionsForLanguage(
  entries: OLEditionEntry[],
  languageKey: string,
): OLEdition[] {
  return entries
    .filter((entry) =>
      (entry.languages ?? []).some((lang) => lang.key === languageKey),
    )
    .map((entry) => ({
      isbn: entry.isbn_13?.[0] ?? entry.isbn_10?.[0] ?? null,
      year: extractYearLoose(entry.publish_date),
    }))
    .filter((entry) => entry.isbn);
}

function earliestIsbn(editions: OLEdition[]): string | null {
  const dated = editions
    .filter((edition) => edition.year !== null)
    .sort((a, b) => (a.year as number) - (b.year as number));
  return dated[0]?.isbn ?? editions[0]?.isbn ?? null;
}

function hasItalianIsbnPrefix(isbn: string): boolean {
  const isbn13 = toIsbn13(isbn);
  return isbn13.startsWith("97888");
}

async function main() {
  const { max, dryRun, force, isbn } = parseArgs(process.argv.slice(2));

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI non impostata.");
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);
  await client.connect();

  let processed = 0;
  let notFound = 0;
  let descriptionUpdated = 0;
  let yearUpdated = 0;
  let isbnSwapped = 0;
  let ratingFound = 0;
  let englishIsbnFound = 0;

  try {
    const collection = client
      .db(DB_NAME)
      .collection<StoredBook>(COLLECTION_NAME);

    const query = isbn
      ? { isbn }
      : force
        ? {}
        : { enrichedAt: { $exists: false } };

    const candidates = await collection
      .find(query)
      .limit(isbn ? 1 : max)
      .toArray();

    console.log(`${candidates.length} libri da allineare in questo run.`);

    for (const book of candidates) {
      const work = await resolveWork(book);

      if (!work) {
        notFound += 1;
        console.log(`  ✗ ${book.title}: non trovato su Open Library`);
        if (!dryRun) {
          await collection.updateOne(
            { _id: book._id },
            { $set: { enrichedAt: new Date() } },
          );
        }
        processed += 1;
        continue;
      }

      const { description } = await fetchWorkDescription(work.workKey);
      const rating = await fetchRatings(work.workKey);
      const editionEntries = await fetchEditionEntries(work.workKey);
      const editions = editionsForLanguage(
        editionEntries,
        "/languages/ita",
      ).filter((edition) => hasItalianIsbnPrefix(edition.isbn as string));
      const changes: string[] = [];

      const currentDescription = book.description?.trim() ?? "";
      const currentIsGood =
        currentDescription.length >= MIN_DESCRIPTION_LENGTH &&
        isItalian(currentDescription);
      const candidateDescription = description?.trim() ?? "";
      const candidateIsUsable =
        candidateDescription.length >= MIN_DESCRIPTION_LENGTH;
      const candidateIsItalian =
        candidateIsUsable && isItalian(candidateDescription);
      const useDescription = !currentIsGood && candidateIsItalian;
      const currentIsNonItalian =
        currentDescription.length > 0 && !isItalian(currentDescription);
      const clearDescription = !useDescription && currentIsNonItalian;
      if (useDescription) {
        descriptionUpdated += 1;
        changes.push("trama");
      } else if (clearDescription) {
        changes.push("trama rimossa (non italiana, nessun sostituto)");
      }

      const useYear =
        work.firstPublishYear !== null &&
        (!book.year || work.firstPublishYear < book.year);
      if (useYear) {
        yearUpdated += 1;
        changes.push(`anno ${book.year ?? "?"} → ${work.firstPublishYear}`);
      }

      const dated = editions
        .filter((edition) => edition.year !== null)
        .sort((a, b) => (a.year as number) - (b.year as number));
      const earliest = dated[0] ?? null;

      const knownIsbns = new Set(
        [
          book.isbn,
          ...(book.alternateIsbns ?? []),
          ...editions.map((edition) => edition.isbn),
        ].filter((value): value is string => Boolean(value)),
      );

      const isSameEdition =
        earliest?.isbn &&
        book.isbn &&
        toIsbn13(earliest.isbn) === toIsbn13(book.isbn);

      let newIsbn = book.isbn;
      if (
        earliest?.isbn &&
        !isSameEdition &&
        (!book.year || (earliest.year as number) < book.year)
      ) {
        const collision = await collection.findOne({
          _id: { $ne: book._id },
          $or: [{ isbn: earliest.isbn }, { alternateIsbns: earliest.isbn }],
        });
        if (!collision) {
          newIsbn = earliest.isbn;
          isbnSwapped += 1;
          changes.push(`isbn ${book.isbn ?? "?"} → ${newIsbn}`);
        }
      }

      const newAlternateIsbns = [...knownIsbns].filter(
        (candidate) => candidate !== newIsbn,
      );

      const englishIsbn = earliestIsbn(
        editionsForLanguage(editionEntries, "/languages/eng"),
      );
      if (englishIsbn && englishIsbn !== book.englishIsbn) {
        englishIsbnFound += 1;
        changes.push(`isbn inglese → ${englishIsbn}`);
      }

      if (rating.count) ratingFound += 1;

      console.log(
        changes.length > 0
          ? `  ✓ ${book.title}: ${changes.join(", ")}`
          : `  · ${book.title}: nessuna modifica necessaria`,
      );

      if (!dryRun) {
        await collection.updateOne(
          { _id: book._id },
          {
            $set: {
              ...(useDescription
                ? { description }
                : clearDescription
                  ? { description: null }
                  : {}),
              ...(useYear ? { year: work.firstPublishYear } : {}),
              isbn: newIsbn,
              alternateIsbns: newAlternateIsbns,
              englishIsbn,
              olWorkKey: work.workKey,
              olRating: rating.average,
              olRatingsCount: rating.count,
              olCheckedAt: new Date(),
              enrichedAt: new Date(),
            },
          },
        );
      }

      processed += 1;
    }
  } finally {
    await client.close();
  }

  console.log(
    `\n${dryRun ? "Report (nessuna scrittura)" : "Fatto"}: ${processed} controllati, ${notFound} non trovati su Open Library, ${descriptionUpdated} trame aggiornate, ${yearUpdated} anni corretti, ${isbnSwapped} isbn allineati all'edizione originale, ${ratingFound} con valutazioni trovate, ${englishIsbnFound} isbn inglesi trovati.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
