# Spine

A personal book cataloging app built with Next.js (App Router) and Supabase.

Each user has their own account and personal catalog: reading status (wishlist, to read, reading, read), star rating, genres, and a generated (non-photographic) cover for every book. Adding a book searches title/author automatically against a local MongoDB cache first, falling back to [Open Library](https://openlibrary.org/developers/api), plus ISBN lookup and camera barcode scanning. A "Reading suggestions" page surfaces NYT bestseller lists, Google Books popularity charts, and hand-curated "literary importance" picks — all pre-imported into MongoDB rather than called live on every page load. Every catalog also has a public, read-only profile page (`/u/username`) that anyone can view without an account, while adding/editing books stays restricted to their owner.

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

# Needed for populating the bestseller charts (free key from
# developer.nytimes.com; see scripts/import-charts.mts below — the
# Suggestions page itself doesn't use it at runtime, it reads from Mongo).
NYT_BOOKS_API_KEY=...

# Needed for the "Discover similar books" button on a book's detail page
# (tastedive.com/read/api, free). Without this key the button simply
# won't find any results.
TASTEDIVE_API_KEY=...

# Needed for book search (Mongo cache in front of Open Library, see below)
# and for the "Reading suggestions" page (reads charts from Mongo instead
# of calling NYT live). Without this key, search falls back to Open
# Library only and the suggestions page stays empty with a message
# explaining why.
MONGODB_URI=...
```

The database schema lives in `supabase/migrations/`.

## Importing books into MongoDB (scripts/import-google-books.mts)

A standalone script (separate from the app) that populates a MongoDB Atlas
collection with Italian-language books fetched from the Google Books API
(ISBN, title, authors, year, publisher, description, categories). Skips
volumes without an ISBN. Requires in `.env.local`:

```
MONGODB_URI=...
```

Usage:

```bash
pnpm import-books                                       # default query
pnpm import-books "subject:Fantascienza" "inauthor:Italo Calvino"
pnpm import-books --max=400 "subject:Storia"
pnpm import-books --dry-run "subject:Giallo"            # print without writing to Mongo
pnpm import-books --order-by=newest "subject:Storia"    # relevance (default) or newest
```

Writes to the `books_catalog` db, `books` collection (names configurable
via `MONGODB_DB` / `MONGODB_COLLECTION`), upserting on the Google Books
volume id so repeated runs are idempotent. From a certain run onward it
also stores `averageRating`/`ratingsCount`, used by the popularity chart
below — books imported before that don't have them.

## Search autocomplete index (scripts/create-search-index.mts)

One-off script that creates the Atlas Search index the app's live search
(`src/lib/mongo-books/search.ts`) uses for title/author autocomplete over
the catalog imported by `import-google-books.mts`. Re-run it (after
deleting the existing index) if you change the index definition.

```bash
node --env-file=.env.local scripts/create-search-index.mts
```

## Importing charts into MongoDB (scripts/import-charts.mts)

Populates a separate collection, `books_catalog.charts`, with book charts
used to generate reading suggestions. Three sources:

- **`nyt`** — New York Times bestseller lists by category (sales),
  requires `NYT_BOOKS_API_KEY`. Titles/authors as returned by NYT (in
  English, US market).
- **`google-books`** — popularity by category, computed by aggregating
  `ratingsCount`/`averageRating` from books already present in
  `books_catalog.books`. No external calls: if it finds no books with
  those fields (because they were imported before those fields existed),
  it generates nothing for that run.
- **`curated`** — hand-curated "literary importance" lists in
  `scripts/data/curated-importance.mts` (not from a verified external
  source — a subjective starting point meant to be reviewed/extended),
  resolved against Google Books by ISBN and by the Italian edition's
  title/author.

Each run overwrites (upserts) the corresponding list's document: it's a
fresh snapshot, not a history. The app's "Reading suggestions" page reads
from here (`MONGODB_URI`) rather than calling NYT live — if the charts
have never been imported, the page says so explicitly and suggests
running this script.

```bash
pnpm import-charts                  # all three sources
pnpm import-charts --type=nyt
pnpm import-charts --type=popularity
pnpm import-charts --type=curated
pnpm import-charts --dry-run        # print without writing to Mongo
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
5-star rating instead of a separate entry. Each book is resolved against
Open Library by ISBN to fetch a description and genres (falling back to
just the CSV's title/author if Open Library has no match for that ISBN),
same as adding a book by hand in the app.

```bash
pnpm import-bookie --file=export.csv --dry-run              # inspect the mapping, no login, no writes
pnpm import-bookie --file=export.csv --email=you@example.com
pnpm import-bookie --file=export.csv --email=you@example.com --limit=5  # test on a handful first
```
