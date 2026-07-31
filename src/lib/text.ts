const LEADING_ARTICLES = new Set([
  "il",
  "lo",
  "la",
  "i",
  "gli",
  "le",
  "un",
  "uno",
  "una",
  "the",
  "a",
  "an",
]);

// Normalizes a book title for fuzzy matching/deduping: lowercase, strips
// accents and punctuation, collapses whitespace, and drops a leading
// article so e.g. "Il fu Mattia Pascal" and "Fu Mattia Pascal" (or a title
// from a different data source with/without "The") compare equal.
export function normalizeTitle(title: string): string {
  const normalized = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .replace(/\s+/g, " ");

  const [firstWord, ...rest] = normalized.split(" ");
  return firstWord && LEADING_ARTICLES.has(firstWord)
    ? rest.join(" ")
    : normalized;
}

// ISBN-10 (9 digits + check digit, which may be 'X') or ISBN-13 (13 digits),
// ignoring the hyphens/spaces that ISBNs are commonly printed/typed with.
export function normalizeIsbn(input: string): string | null {
  const cleaned = input.replace(/[-\s]/g, "");
  if (/^\d{9}[\dXx]$/.test(cleaned) || /^\d{13}$/.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  return null;
}

// TasteDive (and Goodreads, which its book data comes from) names books
// like "The Angel's Game (The Cemetery of Forgotten Books, #2)". Open
// Library's search matches almost nothing with that suffix still attached
// (verified live: 0 results with it, 293 without) since its title field
// doesn't include series/volume info. Strip a single trailing "(...)"
// group before searching.
export function stripSeriesSuffix(title: string): string {
  return title.replace(/\s*\([^()]*\)\s*$/, "").trim();
}
