import { MongoClient } from "mongodb";

const DB_NAME = process.env.MONGODB_DB ?? "books_catalog";
const LISTS_COLLECTION = process.env.MONGODB_LISTS_COLLECTION ?? "lists";
const HARDCOVER_ENDPOINT = "https://api.hardcover.app/v1/graphql";
const REQUEST_DELAY_MS = 800;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 800;
const MIN_LIST_FOLLOWERS = 1;
const MAX_BOOKS_PER_LIST = 300;

type ListEntry = {
  isbn: string;
  title: string;
  author: string | null;
  position: number | null;
};

type ListDoc = {
  _id: string;
  source: "hardcover";
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
  let maxLists = 40;
  let dryRun = false;
  for (const arg of argv) {
    if (arg.startsWith("--max-lists=")) maxLists = Number(arg.slice("--max-lists=".length));
    else if (arg === "--dry-run") dryRun = true;
  }
  return { maxLists, dryRun };
}

async function queryHardcover(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(HARDCOVER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    });

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

type NotableList = {
  id: number;
  name: string;
  description: string | null;
  followersCount: number;
};

async function findNotableLists(
  token: string,
  maxLists: number,
): Promise<NotableList[]> {
  const result = await queryHardcover(
    token,
    `query ($minFollowers: Int!, $limit: Int!) {
      byFollowers: lists(
        where: { public: { _eq: true }, followers_count: { _gte: $minFollowers } }
        order_by: { followers_count: desc }
        limit: $limit
      ) {
        id
        name
        description
        followers_count
      }
      featured: lists(where: { public: { _eq: true }, featured: { _eq: true } }, limit: $limit) {
        id
        name
        description
        followers_count
      }
    }`,
    { minFollowers: MIN_LIST_FOLLOWERS, limit: maxLists },
  );

  const raw = [
    ...(result?.data?.byFollowers ?? []),
    ...(result?.data?.featured ?? []),
  ];

  const byId = new Map<number, NotableList>();
  for (const l of raw) {
    if (!byId.has(l.id)) {
      byId.set(l.id, {
        id: l.id,
        name: l.name,
        description: l.description ?? null,
        followersCount: l.followers_count ?? 0,
      });
    }
  }
  return [...byId.values()].slice(0, maxLists);
}

async function fetchListEntries(
  token: string,
  listId: number,
): Promise<ListEntry[]> {
  const result = await queryHardcover(
    token,
    `query ($listId: Int!, $limit: Int!) {
      lists_by_pk(id: $listId) {
        list_books(limit: $limit, order_by: { position: asc }) {
          position
          book {
            title
            cached_contributors
            default_physical_edition { isbn_13 isbn_10 }
          }
        }
      }
    }`,
    { listId, limit: MAX_BOOKS_PER_LIST },
  );

  const rows: Array<{
    position: number | null;
    book: {
      title: string;
      cached_contributors: Array<{ author?: { name?: string } }> | null;
      default_physical_edition: { isbn_13: string | null; isbn_10: string | null } | null;
    };
  }> = result?.data?.lists_by_pk?.list_books ?? [];

  return rows
    .map((row) => ({
      isbn:
        row.book.default_physical_edition?.isbn_13 ??
        row.book.default_physical_edition?.isbn_10 ??
        null,
      title: row.book.title,
      author: row.book.cached_contributors?.[0]?.author?.name ?? null,
      position: row.position,
    }))
    .filter((entry): entry is ListEntry => Boolean(entry.isbn));
}

async function main() {
  const { maxLists, dryRun } = parseArgs(process.argv.slice(2));

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

  let imported = 0;
  let totalEntries = 0;

  try {
    const collection = client.db(DB_NAME).collection<ListDoc>(LISTS_COLLECTION);

    const notableLists = await findNotableLists(hardcoverToken, maxLists);
    console.log(`${notableLists.length} liste Hardcover notevoli trovate.\n`);

    for (const list of notableLists) {
      await sleep(REQUEST_DELAY_MS);
      const entries = await fetchListEntries(hardcoverToken, list.id);
      totalEntries += entries.length;

      console.log(
        `  ✓ "${list.name}" (${list.followersCount} follower): ${entries.length} libri con isbn`,
      );

      const doc: ListDoc = {
        _id: `hardcover:${list.id}`,
        source: "hardcover",
        externalId: String(list.id),
        name: list.name,
        description: list.description,
        followersCount: list.followersCount,
        entries,
        updatedAt: new Date(),
      };

      if (!dryRun) {
        await collection.updateOne(
          { _id: doc._id },
          { $set: doc },
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
