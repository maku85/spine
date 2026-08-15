# Spine

A personal book cataloging app built with Next.js (App Router) and Supabase.

Each user has their own account and personal catalog: reading status (wishlist, to read, reading, read), a like/dislike judgment, genres, and a generated (non-photographic) cover for every book. Adding a book searches title/author automatically against a local MongoDB cache first, falling back to [Open Library](https://openlibrary.org/developers/api), plus ISBN lookup and camera barcode scanning. A "Reading suggestions" page surfaces NYT bestseller lists and the highest-rated books (by Open Library rating), both read directly from the same MongoDB catalog rather than called live on every page load. Every catalog also has a public, read-only profile page (`/u/username`) that anyone can view without an account, while adding/editing books stays restricted to their owner.

## Local development

```bash
pnpm install
pnpm dev
```

Requires a `.env.local` file with:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Optional: enriches plot/genres via Google Books. Without this key the
# app still works, falling back to Open Library only.
GOOGLE_BOOKS_API_KEY=...

# Needed for pulling NYT bestseller data into the catalog (free key from
# developer.nytimes.com; see scripts/import-nyt-bestsellers.mts below — the
# Suggestions page itself doesn't use it at runtime, it reads from Mongo).
NYT_BOOKS_API_KEY=...

# Needed for the "Discover similar books" button on a book's detail page
# (tastedive.com/read/api, free). Without this key the button simply
# won't find any results.
TASTEDIVE_API_KEY=...

# Needed for book search (Mongo cache in front of Open Library, see below)
# and for the "Reading suggestions" page (reads NYT rank and Open Library
# ratings straight from the books collection instead of calling those
# APIs live). Without this key, search falls back to Open Library only
# and the suggestions page stays empty with a message explaining why.
MONGODB_URI=...

# Only needed by the catalog-maintenance scripts below (not read by the
# app itself): import-hardcover-lists.mts and import-hardcover-book-data.mts
# use it to query Hardcover's GraphQL API.
HARDCOVER_API_TOKEN=...
```

The database schema lives in `supabase/migrations/`.

## The catalog data model

Every book in the Mongo catalog is one document with no privileged
"original" language: language-specific data (`isbn`/`title`/`description`,
plus a `workKey` used only for same-language edition-dedup) lives entirely
under `translations.<lang>` — `translations.it`, `translations.en`, and so
on, one entry per language actually found for that work. The document root
only holds fields that don't depend on language: `authors`, `year`,
`categories`, `alternateIsbns` (every other known ISBN, any language, that
isn't already a `translations.*.isbn`), `olWorkKey` (the Open Library work
id, shared across all editions/languages of the same work — lets a future
cross-language dedup pass group documents without re-querying Open
Library), `rating`/`ratingsCount` (Open Library's, the source the app
surfaces), `moodTags`, `series`, `pendingReview`, and the `*CheckedAt`
staleness timestamps the maintenance scripts use to avoid re-hitting
external APIs. A book is only guaranteed to have *one* translation entry;
which one to show when the preferred language isn't available is decided
in application code, not stored on the document — see
`src/lib/mongo-books/search.ts`, `src/lib/lists/read.ts`,
`src/lib/suggestions/read.ts`.

The scripts below fall into four groups: **importing** new books directly
(search-driven), **importing/updating lists** (NYT, Hardcover — write only
to the `lists` collection), **resolving/enriching** what's already
catalogued, and **cleaning up** cross-language duplicates that slip past
the cheaper checks. Turning a list entry into a catalog book is the job of
`resolve-list-books.mts` alone, regardless of which list it came from.

## Importing books into MongoDB (scripts/import-books.mts)

A standalone script (separate from the app) that populates a MongoDB Atlas
collection with books fetched from the Google Books API (ISBN, title,
authors, year, description, categories), searched across one or more
languages (Italian and English by default — each language is queried
separately with its own `langRestrict`). Skips volumes without an ISBN. A
non-Italian book is inserted as-is, under `translations.<lang>`; its
Italian translation (if any) isn't looked up here — that's
`resolve-list-books.mts`'s catalog-wide retry pass, run separately, since
looking it up per candidate would be too costly for a wide-net search
import. Requires in `.env.local`:

```
MONGODB_URI=...
```

Usage:

```bash
pnpm import-books                                        # default queries, Italian + English
pnpm import-books --lang=it "subject:Fantascienza" "inauthor:Italo Calvino"
pnpm import-books --lang=en --max=400 "inauthor:Ursula K. Le Guin"
pnpm import-books --dry-run                              # print without writing to Mongo
pnpm import-books --order-by=newest                       # relevance (default) or newest
```

Writes to the `books_catalog` db, `books` collection (names configurable
via `MONGODB_DB` / `MONGODB_COLLECTION`), upserting on the Google Books
volume id so repeated runs are idempotent, and keeping only one (the
oldest-dated) edition per work in each language — other ISBNs for the same
work go into `alternateIsbns` instead of being discarded. Before falling
back to the same-language `workKey` match, it also checks whether the
found ISBN is already known on any catalog entry (`alternateIsbns` or
either `translations.*.isbn`) regardless of language, and skips inserting
a duplicate if so — a cheap, exact-ISBN-only safety net; it can't catch a
genuinely new ISBN for a work already catalogued in another language (that
needs an Open Library work-key match, out of scope for a fast search
import).

Scheduled daily via `.github/workflows/import-books.yml`.

## Search autocomplete index (scripts/create-search-index.mts)

One-off script that creates the Atlas Search index the app's live search
(`src/lib/mongo-books/search.ts`) uses for title/author autocomplete over
the catalog, including the `translations.it` fields. Re-run it (after
deleting the existing index) if you change the index definition.

```bash
node --env-file=.env.local scripts/create-search-index.mts
```

## Importing a Bookie export (scripts/import-bookie.mts)

Unlike the scripts above (which populate shared MongoDB collections), this
one writes directly into a real user's personal catalog in Supabase — a
one-time migration from the "Bookie" app's CSV export. Requires that
user's Spine login (email + password, prompted interactively; the password
is never accepted as a CLI argument, so it doesn't end up in shell
history).

Each row maps `list_name` to a Spine reading status
(`currently_reading`→reading, `finished`→read, `want_to_read`→to read,
`wishlist`→wishlist); `favorite` isn't a status of its own — in Bookie's
export it always tags a book that also has a real status — so it becomes a
"like" instead of a separate entry. Each book is resolved against
Open Library by ISBN to fetch a description and genres (falling back to
just the CSV's title/author if Open Library has no match for that ISBN),
same as adding a book by hand in the app.

```bash
pnpm import-bookie --file=export.csv --dry-run              # inspect the mapping, no login, no writes
pnpm import-bookie --file=export.csv --email=you@example.com
pnpm import-bookie --file=export.csv --email=you@example.com --limit=5  # test on a handful first
```

## Aligning existing catalog data (scripts/enrich-books.mts)

A manual, run-when-needed script (not scheduled) that improves books
already sitting in the catalog rather than importing new ones — scoped to
books that have a `translations.it` entry, since its Open Library lookup
and description handling assume Italian content. Non-Italian-only books
get their Italian translation resolved by `resolve-list-books.mts` instead
(which is what gives them a `translations.it` entry in the first place).
For each candidate it resolves the book against Open Library (by the
Italian ISBN, falling back to alternate ISBNs, then to a normalized
title+author search) and updates:

- **Description** (`translations.it.description`) — replaced with Open
  Library's (Italian paragraphs preferred) if the current one is missing,
  shorter than 60 characters, or not detected as Italian.
- **Year** (root `year`, shared across languages) — filled in, or
  corrected, with Open Library's first-publish year for the work if it's
  earlier than what's stored (i.e. the stored edition isn't the original
  one).
- **ISBN** (`translations.it.isbn`) — promoted to the earliest-dated
  *Italian* edition found via Open Library's editions list (editions in
  other languages are ignored entirely, so a book never ends up with a
  foreign edition's ISBN as its canonical Italian one), when different
  from what's stored and not already used by another catalog entry. Every
  other known Italian ISBN for the work ends up in `alternateIsbns`
  either way, so ISBN search keeps working regardless of which edition a
  user scans/searches.
- **Rating** (root `rating`/`ratingsCount`/`olWorkKey`) — Open Library's
  rating average/count, the source the app actually surfaces: Google
  Books' own ratings turned out unreliable for most books (too few votes,
  even for famous titles).

Runs on a bounded batch per invocation (100 books by default) rather than
the whole catalog at once — Open Library explicitly asks that its APIs
not be used as a bulk-data backend. Each processed book gets an
`enrichedAt` timestamp so re-runs only pick up books that haven't been
aligned yet, unless `--force` is passed.

```bash
pnpm enrich-books --dry-run              # report without writing to Mongo
pnpm enrich-books --max=50               # default is 100 per run
pnpm enrich-books --force                # re-check books already aligned
pnpm enrich-books --isbn=8804668237      # a single book, to sanity-check first
```

Scheduled daily via `.github/workflows/enrich-books.yml`.

## Importing list data (scripts/import-nyt-bestsellers.mts, scripts/import-hardcover-lists.mts)

Both scripts fetch curated/bestseller lists from their respective source
and upsert them into the Mongo `lists` collection (`{source, name, entries:
[{isbn, title, author, position}]}`) — neither one writes to the `books`
collection directly. Turning a list entry into an actual catalog book is
`resolve-list-books.mts`'s job alone (below), so both sources feed the
same pipeline.

`import-nyt-bestsellers.mts` covers the lists in `scripts/data/nyt-lists.mts`
and respects NYT's free-tier rate limit (5 requests/minute) with a 13s
pause between lists:

```bash
pnpm import-nyt-bestsellers
pnpm import-nyt-bestsellers --dry-run   # print without writing to Mongo
```

Scheduled weekly (Mondays) via `.github/workflows/import-nyt-bestsellers.yml`
— NYT lists themselves only refresh once a week.

`import-hardcover-lists.mts` pulls Hardcover's most-followed and featured
public lists, keeping only ones that read as fiction — classified from
each list's books' genre tags, with lists too small to classify kept
rather than risk dropping a good one:

```bash
node --env-file=.env.local scripts/import-hardcover-lists.mts
node --env-file=.env.local scripts/import-hardcover-lists.mts --max-lists=60 --dry-run
```

Not scheduled — run manually as needed.

## Resolving list entries into catalog books (scripts/resolve-list-books.mts)

Reads every list in the `lists` collection and, for each ISBN not yet in
the catalog, inserts it as a new book in its original language (via Google
Books) plus its Italian translation when Open Library has one (the oldest
Italian edition Google Books actually has real data for). It also does a
second, catalog-wide pass: retrying the Italian-translation lookup for
*any* catalogued book still missing one — not just list-derived ones,
since `import-books.mts` also produces non-Italian books outside of any
list. Both passes cache negative/collision results (`listResolutionCheckedAt`
on books, a `list_resolution_attempts` collection for still-uncatalogued
ISBNs) so re-runs don't redo the same Open Library work.

This is the heaviest script here (several sequential Open Library +
Google Books calls per candidate), so it's meant to be run manually in
bounded batches rather than scheduled:

```bash
pnpm resolve-list-books --dry-run --max=10
pnpm resolve-list-books --max=30
pnpm resolve-list-books --force           # ignore the 30-day staleness cache
```

## Importing series and mood tags (scripts/import-hardcover-book-data.mts)

Enriches catalog books with series membership and mood tags from
Hardcover, looked up by the book's `translations.en.isbn`. Re-checks stale
entries (30 days) unless `--force` is passed.

```bash
node --env-file=.env.local scripts/import-hardcover-book-data.mts --dry-run
node --env-file=.env.local scripts/import-hardcover-book-data.mts --max=50
```

Not scheduled — run manually as needed.

## Merging cross-language duplicates (scripts/merge-duplicate-books.mts)

`import-books.mts`'s ISBN check can't catch a work catalogued twice under
two different ISBNs in two different languages — that needs an Open
Library work-key lookup, too costly to do per-candidate at import time.
This script does that lookup here instead, by default scoped only to
`pendingReview` candidates (new imports are hidden from every read path
until this script has checked them): for each, it resolves the Open
Library work key (reusing `olWorkKey` if another script already found it,
otherwise one lookup) and checks whether another catalog entry already
has that same `olWorkKey`. No match → the candidate is confirmed unique
and goes live. A match → the two are merged into one document (existing
`translations` entries win on conflict, the loser's ISBN becomes an
alternate; missing language slots, mood tags, series, and rating are
adopted from whichever side has them; the earlier `year` wins) and the
loser is deleted. This is also the only place `pendingReview` ever gets
cleared — once a candidate has been checked, merged or not, there's
nothing left to wait for.

Coverage depends on how much of the catalog already has `olWorkKey` set
(from `enrich-books.mts` or `resolve-list-books.mts` having resolved a
work before) — a candidate can only be matched against an existing entry
that's already been through one of those. Run with `--force` to sweep the
whole catalog instead of just pending candidates (also backfills
`olWorkKey` on older entries that predate it), in bounded batches:

```bash
pnpm merge-duplicate-books --dry-run
pnpm merge-duplicate-books --max=30
pnpm merge-duplicate-books --force --max=100   # broader sweep, not just pending
```

Not scheduled — run manually, ideally after `enrich-books.mts` and
`resolve-list-books.mts` so more of the catalog has `olWorkKey` to match
against.
