import { normalizeTitle } from "../../src/lib/text.ts";

const USER_AGENT = "Spine (personal book catalog)";
const OL_REQUEST_DELAY_MS = 350;
const GOOGLE_REQUEST_DELAY_MS = 250;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 15_000;

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type Translation = {
  isbn: string;
  title: string;
  description: string | null;
  workKey: string;
};

export function computeWorkKey(
  title: string,
  author: string | undefined,
): string {
  return `${normalizeTitle(title)}::${normalizeTitle(author ?? "")}`;
}

export type OriginalMatch = {
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  description: string | null;
  categories: string[];
  language: string | null;
};

export type Work = { workKey: string; firstPublishYear: number | null };

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
): Promise<Response | null | undefined> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      if (attempt >= MAX_RETRIES) {
        console.warn(`  ${label}: nessuna risposta (timeout), salto.`);
        return undefined;
      }
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
      continue;
    }

    if (res.ok) return res;
    if (res.status === 404) return null;

    const retryable = RETRYABLE_STATUSES.has(res.status);
    if (!retryable || attempt >= MAX_RETRIES) {
      console.warn(`  ${label}: risposta ${res.status}, salto.`);
      return undefined;
    }
    await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
  }
}

export function toIsbn13(isbn: string): string {
  if (isbn.length !== 10) return isbn;
  const core = `978${isbn.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return `${core}${check}`;
}

export function hasItalianIsbnPrefix(isbn: string): boolean {
  return toIsbn13(isbn).startsWith("97888");
}

export function isNarrativa(categories: string[]): boolean {
  return categories.some((category) => /fiction|narrativa/i.test(category));
}

function extractYearLoose(text: string | undefined): number | null {
  if (!text) return null;
  const match = text.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return match ? Number(match[1]) : null;
}

export async function findWork(isbn: string): Promise<Work | null> {
  const json = (await fetchOpenLibrary(
    `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&limit=1&fields=key,first_publish_year`,
  )) as {
    docs?: Array<{ key?: string; first_publish_year?: number }>;
  } | null;
  await sleep(OL_REQUEST_DELAY_MS);

  const doc = json?.docs?.[0];
  if (!doc?.key) return null;
  return {
    workKey: doc.key.replace("/works/", ""),
    firstPublishYear: doc.first_publish_year ?? null,
  };
}

export async function findWorkByTitleAuthor(
  title: string,
  author: string | undefined,
): Promise<Work | null> {
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
  await sleep(OL_REQUEST_DELAY_MS);

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

export async function findItalianEditionIsbns(
  workKey: string,
): Promise<Array<{ isbn: string; year: number | null }>> {
  const json = (await fetchOpenLibrary(
    `https://openlibrary.org/works/${workKey}/editions.json?limit=200`,
  )) as {
    entries?: Array<{
      isbn_13?: string[];
      isbn_10?: string[];
      publish_date?: string;
      languages?: Array<{ key: string }>;
    }>;
  } | null;
  await sleep(OL_REQUEST_DELAY_MS);

  return (json?.entries ?? [])
    .filter((entry) =>
      (entry.languages ?? []).some((lang) => lang.key === "/languages/ita"),
    )
    .map((entry) => ({
      isbn: entry.isbn_13?.[0] ?? entry.isbn_10?.[0] ?? null,
      year: extractYearLoose(entry.publish_date),
    }))
    .filter((entry): entry is { isbn: string; year: number | null } =>
      Boolean(entry.isbn && hasItalianIsbnPrefix(entry.isbn)),
    )
    .sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity));
}

export async function fetchGoogleBooksByIsbn(
  isbn: string,
  apiKey: string | undefined,
): Promise<OriginalMatch | null | undefined> {
  const params = new URLSearchParams({ q: `isbn:${isbn}` });
  if (apiKey) params.set("key", apiKey);

  const res = await fetchWithRetry(
    `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
    `Google Books isbn:${isbn}`,
  );
  await sleep(GOOGLE_REQUEST_DELAY_MS);
  if (res === undefined) return undefined;
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

async function fetchGoogleBooksItalian(
  isbn: string,
  apiKey: string | undefined,
): Promise<Translation | null> {
  const match = await fetchGoogleBooksByIsbn(isbn, apiKey);
  if (!match || match.language !== "it") return null;
  return {
    isbn,
    title: match.title,
    description: match.description,
    workKey: computeWorkKey(match.title, match.authors[0]),
  };
}

export async function findItalianTranslation(
  workKey: string,
  googleApiKey: string | undefined,
): Promise<Translation | null> {
  const candidates = await findItalianEditionIsbns(workKey);
  for (const { isbn } of candidates) {
    const translation = await fetchGoogleBooksItalian(isbn, googleApiKey);
    if (translation) return translation;
  }
  return null;
}
