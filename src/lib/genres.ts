const MAX_GENRES = 6;

// Both Open Library subjects and Google Books categories mix genuine
// genres with noise (cataloging notes, format tags, subject headings in
// other languages, self-referential cross-references). Rather than
// deny-listing all of that per source, match against a curated allowlist of
// genuine genres/categories and normalize everything to one Italian label —
// ordered most-specific first so e.g. "Science fiction" doesn't also get
// bucketed into the generic "Narrativa" fallback.
const GENRE_RULES: Array<{ label: string; patterns: string[] }> = [
  {
    label: "Fantascienza",
    patterns: ["science fiction", "sci-fi", "fantascienza"],
  },
  { label: "Fantasy", patterns: ["fantasy"] },
  { label: "Distopia", patterns: ["dystopia", "distopia"] },
  {
    label: "Giallo",
    patterns: ["mystery", "detective", "giallo", "polizi", "misterio"],
  },
  { label: "Thriller", patterns: ["thriller", "suspense"] },
  { label: "Horror", patterns: ["horror", "orrore"] },
  { label: "Romance", patterns: ["romance", "love stories"] },
  {
    label: "Narrativa storica",
    patterns: ["historical fiction", "romanzo storico"],
  },
  { label: "Guerra", patterns: ["war stories", "world war"] },
  { label: "Avventura", patterns: ["adventure", "avventura"] },
  { label: "Fumetti", patterns: ["comics", "graphic novel", "fumetti"] },
  {
    label: "Ragazzi",
    patterns: ["juvenile fiction", "children's stories", "ragazzi", "bambini"],
  },
  { label: "Poesia", patterns: ["poetry", "poesia", "poésie", "poesía"] },
  { label: "Teatro", patterns: ["plays", "teatro", "théâtre"] },
  { label: "Classici", patterns: ["classic literature", "classici"] },
  { label: "Narrativa", patterns: ["fiction", "novela", "romanzo", " roman"] },
  {
    label: "Biografia",
    patterns: ["biography", "biografia", "autobiography", "autobiografia"],
  },
  {
    label: "Storia",
    patterns: ["history", "storia", "histoire", "geschichte"],
  },
  { label: "Filosofia", patterns: ["philosophy", "filosofia"] },
  { label: "Psicologia", patterns: ["psychology", "psicologia"] },
  { label: "Saggistica", patterns: ["essays", "saggi", "self-help"] },
  { label: "Politica", patterns: ["politics", "political", "politica"] },
];

export function curateGenres(rawSubjects: unknown): string[] {
  if (!Array.isArray(rawSubjects)) return [];
  const genres = new Set<string>();

  for (const subject of rawSubjects) {
    if (typeof subject !== "string") continue;
    const lower = subject.toLowerCase();

    const rule = GENRE_RULES.find((r) =>
      r.patterns.some((pattern) => lower.includes(pattern)),
    );
    if (rule) genres.add(rule.label);

    if (genres.size >= MAX_GENRES) break;
  }

  return [...genres];
}

export function mergeGenres(...lists: string[][]): string[] {
  const merged = new Set<string>();

  for (const list of lists) {
    for (const label of list) {
      merged.add(label);
      if (merged.size >= MAX_GENRES) return [...merged];
    }
  }

  return [...merged];
}
