import { MongoClient } from "mongodb";

const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const COLLECTION_NAME = process.env.MONGODB_COLLECTION ?? "books";
const HARDCOVER_ENDPOINT = "https://api.hardcover.app/v1/graphql";
const REQUEST_DELAY_MS = 800;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 800;
const REQUEST_TIMEOUT_MS = 15_000;
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_MOOD_TAGS = 5;

type StoredBook = {
  _id: string;
  title: string;
  isbn?: string | null;
  language?: string | null;
  englishIsbn?: string | null;
  series?: Array<{ name: string; position: number | null }>;
  moodTags?: string[];
  hardcoverCheckedAt?: Date | null;
};

function lookupIsbn(book: StoredBook): string | null {
  if (book.language != null && book.language !== "it") return book.isbn ?? null;
  return book.englishIsbn ?? null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]) {
  let max = 100;
  let dryRun = false;
  let force = false;
  for (const arg of argv) {
    if (arg.startsWith("--max=")) max = Number(arg.slice("--max=".length));
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--force") force = true;
  }
  return { max, dryRun, force };
}

async function queryHardcover(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(HARDCOVER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token.startsWith("Bearer ")
            ? token
            : `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      if (attempt >= MAX_RETRIES) {
        console.warn("  Hardcover: nessuna risposta (timeout), salto.");
        return null;
      }
      const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
      console.warn(
        `  Hardcover: nessuna risposta (tentativo ${attempt + 1}/${MAX_RETRIES}), riprovo tra ${delay}ms...`,
      );
      await sleep(delay);
      continue;
    }

    if (res.ok) return res.json();

    const retryable = RETRYABLE_STATUSES.has(res.status);
    if (!retryable || attempt >= MAX_RETRIES) {
      console.warn(`  Hardcover: risposta ${res.status}, salto.`);
      return null;
    }

    const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
    console.warn(
      `  Hardcover: risposta ${res.status} (tentativo ${attempt + 1}/${MAX_RETRIES}), riprovo tra ${delay}ms...`,
    );
    await sleep(delay);
  }
}

type BookData = {
  series: Array<{ name: string; position: number | null }>;
  moodTags: string[];
};

async function fetchSeriesAndMoodTags(
  token: string,
  isbn: string,
): Promise<BookData | null> {
  const result = (await queryHardcover(
    token,
    `query ($isbn: String!) {
      editions(
        where: { _or: [{ isbn_13: { _eq: $isbn } }, { isbn_10: { _eq: $isbn } }] }
        limit: 1
      ) {
        book {
          book_series {
            position
            series { name }
          }
          cached_tags
        }
      }
    }`,
    { isbn },
  )) as {
    data?: {
      editions?: Array<{
        book: {
          book_series: Array<{
            position: number | null;
            series: { name: string } | null;
          }> | null;
          cached_tags: {
            Mood?: Array<{ tag: string; count: number }>;
          } | null;
        };
      }>;
    };
  } | null;

  const book = result?.data?.editions?.[0]?.book;
  if (!book) return null;

  const series = (book.book_series ?? [])
    .filter(
      (entry): entry is { position: number | null; series: { name: string } } =>
        Boolean(entry.series?.name),
    )
    .map((entry) => ({ name: entry.series.name, position: entry.position }));

  const moodTags = [...(book.cached_tags?.Mood ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_MOOD_TAGS)
    .map((t) => t.tag);

  return { series, moodTags };
}

async function main() {
  const { max, dryRun, force } = parseArgs(process.argv.slice(2));

  const hardcoverToken = process.env.HARDCOVER_API_TOKEN;
  if (!hardcoverToken) {
    console.error("HARDCOVER_API_TOKEN non impostata.");
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI non impostata.");
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);
  await client.connect();

  let processed = 0;
  let withSeries = 0;
  let withMoodTags = 0;
  let notFound = 0;

  try {
    const collection = client
      .db(DB_NAME)
      .collection<StoredBook>(COLLECTION_NAME);

    const sourceFilter = {
      $or: [
        { englishIsbn: { $exists: true, $ne: null } },
        {
          language: { $exists: true, $nin: [null, "it"] },
          isbn: { $exists: true, $ne: null },
        },
      ],
    };
    const staleFilter = force
      ? {}
      : {
          $or: [
            { hardcoverCheckedAt: { $exists: false } },
            {
              hardcoverCheckedAt: {
                $lt: new Date(Date.now() - STALE_AFTER_MS),
              },
            },
          ],
        };
    const query: Record<string, unknown> = {
      $and: [sourceFilter, staleFilter],
    };

    const candidates = await collection.find(query).limit(max).toArray();
    console.log(`${candidates.length} libri da controllare in questo run.`);

    for (const book of candidates) {
      const isbn = lookupIsbn(book);
      if (!isbn) continue;

      const data = await fetchSeriesAndMoodTags(hardcoverToken, isbn);
      await sleep(REQUEST_DELAY_MS);

      if (!data) {
        notFound += 1;
        console.log(`  ✗ ${book.title}: non trovato su Hardcover`);
        if (!dryRun) {
          await collection.updateOne(
            { _id: book._id },
            { $set: { hardcoverCheckedAt: new Date() } },
          );
        }
        processed += 1;
        continue;
      }

      if (data.series.length > 0) withSeries += 1;
      if (data.moodTags.length > 0) withMoodTags += 1;

      const seriesLabel = data.series
        .map((s) => `${s.name}${s.position ? ` #${s.position}` : ""}`)
        .join(", ");
      console.log(
        `  ${data.series.length || data.moodTags.length ? "✓" : "·"} ${book.title}${
          seriesLabel ? ` — ${seriesLabel}` : ""
        }${data.moodTags.length ? ` [${data.moodTags.join(", ")}]` : ""}`,
      );

      if (!dryRun) {
        await collection.updateOne(
          { _id: book._id },
          {
            $set: {
              series: data.series,
              moodTags: data.moodTags,
              hardcoverCheckedAt: new Date(),
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
    `\n${dryRun ? "Report (nessuna scrittura)" : "Fatto"}: ${processed} controllati, ${withSeries} con serie, ${withMoodTags} con mood tag, ${notFound} non trovati su Hardcover.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
