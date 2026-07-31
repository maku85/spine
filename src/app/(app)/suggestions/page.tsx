import { Sparkles } from "lucide-react";
import { SuggestionCard } from "@/components/suggestion-card";
import { addChartBookToCatalog } from "@/lib/actions/books";
import { type Chart, fetchCharts } from "@/lib/charts/read";
import { createClient } from "@/lib/supabase/server";
import { normalizeTitle } from "@/lib/text";

const BOOKS_PER_CATEGORY = 4;

// Ordine di visualizzazione delle liste bestseller NYT — vedi
// DEFAULT_NYT_LISTS in scripts/import-charts.mts. Liste non previste qui
// (es. aggiunte in futuro) finiscono in coda, nell'ordine restituito da
// Mongo.
const BESTSELLER_ORDER = [
  "Narrativa",
  "Saggistica",
  "Young Adult",
  "Economia",
  "Fumetti",
  "Narrativa (tascabile)",
];

// Le categorie di popolarità con pochissimi libri valutati (es. "Scienza"
// con un solo titolo) non fanno una sezione interessante.
const MIN_POPULARITY_ENTRIES = 3;
const MAX_POPULARITY_SECTIONS = 3;

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="size-7" strokeWidth={1.75} />
      </div>
      <div>
        <p className="font-serif text-lg">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

type Section = {
  key: string;
  label: string;
  books: Chart["entries"];
};

function sortBestsellerCharts(charts: Chart[]): Chart[] {
  return [...charts].sort((a, b) => {
    const ai = BESTSELLER_ORDER.indexOf(a.category);
    const bi = BESTSELLER_ORDER.indexOf(b.category);
    return (
      (ai === -1 ? BESTSELLER_ORDER.length : ai) -
      (bi === -1 ? BESTSELLER_ORDER.length : bi)
    );
  });
}

export default async function SuggestionsPage() {
  if (!process.env.MONGODB_URI) {
    return (
      <EmptyState
        title="Suggerimenti non configurati"
        message="Le liste vengono lette da classifiche importate in MongoDB. Aggiungi una MONGODB_URI per attivarle."
      />
    );
  }

  const [bestsellerCharts, popularityCharts, importanceCharts] =
    await Promise.all([
      fetchCharts("bestseller"),
      fetchCharts("popularity"),
      fetchCharts("importance"),
    ]);

  if (
    bestsellerCharts.length === 0 &&
    popularityCharts.length === 0 &&
    importanceCharts.length === 0
  ) {
    return (
      <EmptyState
        title="Nessuna classifica disponibile"
        message="Lancia `pnpm import-charts` per popolare le classifiche da cui vengono generati i suggerimenti."
      />
    );
  }

  const supabase = await createClient();
  const { data: userBooks } = await supabase
    .from("user_books")
    .select("books(title, isbn)");

  const ownedTitleKeys = new Set<string>();
  const ownedIsbns = new Set<string>();
  for (const userBook of userBooks ?? []) {
    const book = userBook.books;
    if (!book) continue;
    ownedTitleKeys.add(normalizeTitle(book.title));
    if (book.isbn) ownedIsbns.add(book.isbn);
  }

  function toSection(chart: Chart): Section {
    const books = chart.entries
      .filter(
        (entry) =>
          !ownedTitleKeys.has(normalizeTitle(entry.title)) &&
          !(entry.isbn && ownedIsbns.has(entry.isbn)),
      )
      .slice(0, BOOKS_PER_CATEGORY);
    return { key: chart.id, label: chart.category, books };
  }

  const bestsellerSections =
    sortBestsellerCharts(bestsellerCharts).map(toSection);

  const popularitySections = popularityCharts
    .filter((chart) => chart.entries.length >= MIN_POPULARITY_ENTRIES)
    .sort((a, b) => b.entries.length - a.entries.length)
    .slice(0, MAX_POPULARITY_SECTIONS)
    .map(toSection);

  const importanceSections = importanceCharts.map(toSection);

  const sections = [
    ...bestsellerSections,
    ...popularitySections,
    ...importanceSections,
  ].filter((section) => section.books.length > 0);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-serif text-2xl">Suggerimenti di lettura</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bestseller, libri più votati e classici, per categoria.
        </p>
      </div>

      {sections.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Non ho trovato titoli da suggerirti al momento: probabilmente li hai
          già tutti in catalogo.
        </p>
      )}

      {sections.map((section) => (
        <div key={section.key}>
          <h2 className="mb-4 font-mono text-xs tracking-wide text-muted-foreground uppercase">
            {section.label}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.books.map((book) => (
              <SuggestionCard
                key={book.isbn ?? book.title}
                title={book.title}
                author={book.author}
                description={book.description}
                averageRating={book.averageRating}
                ratingsCount={book.ratingsCount}
                onAdd={addChartBookToCatalog.bind(null, book)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
