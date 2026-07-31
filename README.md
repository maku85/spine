# spine

App per catalogare i propri libri, costruita con Next.js (App Router) e Supabase.

Ogni utente ha un proprio account e il proprio catalogo personale (stato di lettura, valutazione). L'aggiunta di un libro cerca titolo/autore/copertina automaticamente su [Open Library](https://openlibrary.org/developers/api).

## Sviluppo locale

```bash
pnpm install
pnpm dev
```

Richiede un file `.env.local` con:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Opzionale: arricchisce trama/generi con Google Books. Senza questa chiave
# l'app funziona comunque usando solo Open Library.
GOOGLE_BOOKS_API_KEY=...

# Richiesta per il link alla recensione del NYT nella pagina di dettaglio di
# un libro (chiave gratuita su developer.nytimes.com), e per popolare le
# classifiche bestseller (vedi scripts/import-charts.mts più sotto — la
# pagina Suggerimenti in sé non la usa a runtime, legge da Mongo).
NYT_BOOKS_API_KEY=...

# Richiesta per il bottone "Scopri libri simili" nella pagina di dettaglio
# di un libro (tastedive.com/read/api, gratuita). Senza questa chiave il
# bottone semplicemente non troverà risultati.
TASTEDIVE_API_KEY=...

# Richiesta per la ricerca libri (cache Mongo prima di Open Library, vedi
# sotto) e per la pagina "Suggerimenti di lettura" (legge le classifiche da
# Mongo invece di chiamare NYT dal vivo). Senza questa chiave la ricerca usa
# solo Open Library e la pagina suggerimenti resta vuota con un messaggio
# che lo spiega.
MONGODB_URI=...
```

Lo schema del database vive in `supabase/migrations/`.

## Import libri in MongoDB (scripts/import-google-books.mts)

Script separato dall'app che popola una collection MongoDB Atlas con libri
in italiano recuperati dalle API di Google Books (ISBN, titolo, autori,
anno, editore, descrizione, categorie). Scarta i volumi senza ISBN.
Richiede in `.env.local`:

```
MONGODB_URI=...
```

Uso:

```bash
pnpm import-books                                       # query di default
pnpm import-books "subject:Fantascienza" "inauthor:Italo Calvino"
pnpm import-books --max=400 "subject:Storia"
pnpm import-books --dry-run "subject:Giallo"            # stampa senza scrivere su Mongo
pnpm import-books --order-by=newest "subject:Storia"    # relevance (default) o newest
```

Salva su db `books_catalog`, collection `books` (nomi configurabili con
`MONGODB_DB` / `MONGODB_COLLECTION`), con upsert sull'id volume di Google
Books così run ripetuti sono idempotenti. Da qualche run in poi salva anche
`averageRating`/`ratingsCount`, usati dalla classifica di popolarità qui
sotto — libri importati prima non li hanno.

## Import classifiche in MongoDB (scripts/import-charts.mts)

Popola una collection separata, `books_catalog.charts`, con classifiche di
libri da usare per generare suggerimenti di lettura. Tre fonti:

- **`nyt`** — liste bestseller del New York Times per categoria (vendite),
  richiede `NYT_BOOKS_API_KEY`. Titoli/autori come restituiti da NYT (in
  inglese, mercato USA).
- **`google-books`** — popolarità per categoria, calcolata aggregando
  `ratingsCount`/`averageRating` dei libri già presenti in
  `books_catalog.books`. Nessuna chiamata esterna: se non trova libri con
  quei campi (perché importati prima che venissero aggiunti) non genera
  nulla per quel run.
- **`curated`** — liste di "importanza letteraria" curate a mano in
  `scripts/data/curated-importance.mts` (non da una fonte esterna
  verificata — una selezione soggettiva, punto di partenza da rivedere/
  estendere), risolte contro Google Books per ISBN e titolo/autore
  dell'edizione italiana.

Ogni run sovrascrive (upsert) il documento della lista corrispondente: è
uno snapshot più recente, non uno storico. La pagina "Suggerimenti di
lettura" dell'app legge da qui (`MONGODB_URI`), non chiama più NYT dal
vivo — se le classifiche non sono mai state importate, la pagina lo dice
esplicitamente e suggerisce di lanciare questo script.

```bash
pnpm import-charts                  # tutte e tre le fonti
pnpm import-charts --type=nyt
pnpm import-charts --type=popularity
pnpm import-charts --type=curated
pnpm import-charts --dry-run        # stampa senza scrivere su Mongo
```
