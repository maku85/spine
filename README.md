# Spine

A personal book cataloging app built with Next.js (App Router) and Supabase.

Each user has their own account and personal catalog: reading status (wishlist, to read, reading, read), star rating, genres, and a generated (non-photographic) cover for every book. Adding a book searches title/author automatically against a local MongoDB cache first, falling back to [Open Library](https://openlibrary.org/developers/api), plus ISBN lookup and camera barcode scanning. A "Reading suggestions" page surfaces NYT bestseller lists and the highest-rated books (by Open Library rating), both read directly from the same MongoDB catalog rather than called live on every page load. Every catalog also has a public, read-only profile page (`/u/username`) that anyone can view without an account, while adding/editing books stays restricted to their owner.

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
volume id so repeated runs are idempotent. It also stores Google's own
`averageRating`/`ratingsCount`, but those turned out unreliable for most
books (too few votes, even for famous titles) and aren't surfaced
anywhere — see `scripts/import-open-library-ratings.mts` below for the
rating source the app actually uses.

## Search autocomplete index (scripts/create-search-index.mts)

One-off script that creates the Atlas Search index the app's live search
(`src/lib/mongo-books/search.ts`) uses for title/author autocomplete over
the catalog imported by `import-google-books.mts`. Re-run it (after
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
5-star rating instead of a separate entry. Each book is resolved against
Open Library by ISBN to fetch a description and genres (falling back to
just the CSV's title/author if Open Library has no match for that ISBN),
same as adding a book by hand in the app.

```bash
pnpm import-bookie --file=export.csv --dry-run              # inspect the mapping, no login, no writes
pnpm import-bookie --file=export.csv --email=you@example.com
pnpm import-bookie --file=export.csv --email=you@example.com --limit=5  # test on a handful first
```

## Importing Open Library ratings (scripts/import-open-library-ratings.mts)

Enriches the Mongo catalog with Open Library's rating average and count,
for books that don't have them yet. Runs on a small batch per invocation
(150 books by default) rather than the whole catalog at once — Open
Library explicitly asks that its APIs not be used as a bulk-data backend,
so backfilling the existing catalog is spread across several days'
scheduled runs instead of one big pass. Every checked book (whether a
rating was found or not) gets an `olCheckedAt` timestamp so future runs
don't re-check it.

Match rate is real but modest: many Italian-market ISBNs simply aren't
indexed on Open Library, so this only finds a rating for a fraction of
books — but when it does, the data is meaningfully more reliable than
Google Books' own ratings (usually hundreds of votes vs. often zero or a
single one).

```bash
pnpm import-ratings                # check up to 150 not-yet-checked books
pnpm import-ratings --max=50
pnpm import-ratings --dry-run      # print without writing to Mongo
```

Scheduled daily via `.github/workflows/import-ratings.yml`.

## Importing NYT bestseller data into the catalog (scripts/import-nyt-bestsellers.mts)

Enriches the Mongo `books` collection with New York Times bestseller
signal — rank, rank last week, and weeks on the list — directly on each
book document (`nytRank`/`nytRankLastWeek`/`nytWeeksOnList`/`nytListName`),
for the lists in `scripts/data/nyt-lists.mts`. For each book: if it's
already in the catalog (matched by ISBN, a known alternate ISBN, or
normalized title+author) its NYT fields are updated in place; otherwise
it's resolved against Google Books by ISBN and inserted as a new document.
This is what the "Reading suggestions" page's NYT section, and the NYT
badge on search results, read from.

NYT bestsellers are almost entirely American, English-language books,
while the rest of the catalog is Italian-only (see the import script
above) — a book without an Italian edition (yet) still gets imported in
English rather than skipped, tagged `source: "nyt"` and `language` so it
can be told apart later if needed.

Respects NYT's free-tier rate limit (5 requests/minute) with a 13s pause
between lists.

```bash
pnpm import-nyt-bestsellers
pnpm import-nyt-bestsellers --dry-run   # print without writing to Mongo
```

Scheduled weekly (Mondays) via `.github/workflows/import-nyt-bestsellers.yml`
— NYT lists themselves only refresh once a week.
