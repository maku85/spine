import { Sparkles } from "lucide-react";
import { SuggestionCard } from "@/components/suggestion-card";
import { addMongoBookToCatalog } from "@/lib/actions/books";
import {
  fetchNytBestsellerBooks,
  fetchTopRatedBooks,
  type SuggestedBook,
} from "@/lib/suggestions/read";
import { createClient } from "@/lib/supabase/server";
import { normalizeTitle } from "@/lib/text";

const BOOKS_PER_CATEGORY = 4;
const TOP_RATED_LIMIT = 8;

const BESTSELLER_ORDER = [
  "Narrativa",
  "Saggistica",
  "Young Adult",
  "Economia",
  "Fumetti",
  "Narrativa (tascabile)",
];

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
  books: SuggestedBook[];
};

function groupNytByList(books: SuggestedBook[]): Section[] {
  const byList = new Map<string, SuggestedBook[]>();
  for (const book of books) {
    if (!book.nytListName) continue;
    const list = byList.get(book.nytListName) ?? [];
    list.push(book);
    byList.set(book.nytListName, list);
  }

  return [...byList.entries()]
    .sort(([a], [b]) => {
      const ai = BESTSELLER_ORDER.indexOf(a);
      const bi = BESTSELLER_ORDER.indexOf(b);
      return (
        (ai === -1 ? BESTSELLER_ORDER.length : ai) -
        (bi === -1 ? BESTSELLER_ORDER.length : bi)
      );
    })
    .map(([label, listBooks]) => ({
      key: `nyt:${label}`,
      label: `NYT — ${label}`,
      books: listBooks,
    }));
}

export default async function SuggestionsPage() {
  if (!process.env.MONGODB_URI) {
    return (
      <EmptyState
        title="Suggerimenti non configurati"
        message="Le liste vengono lette dal catalogo importato in MongoDB. Aggiungi una MONGODB_URI per attivarle."
      />
    );
  }

  const [nytBooks, topRatedBooks] = await Promise.all([
    fetchNytBestsellerBooks(),
    fetchTopRatedBooks(),
  ]);

  if (nytBooks.length === 0 && topRatedBooks.length === 0) {
    return (
      <EmptyState
        title="Nessun suggerimento disponibile"
        message="Lancia `pnpm import-nyt-bestsellers` e `pnpm import-ratings` per popolare le classifiche da cui vengono generati i suggerimenti."
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

  function excludeOwned(books: SuggestedBook[]): SuggestedBook[] {
    return books.filter(
      (book) =>
        !ownedTitleKeys.has(normalizeTitle(book.title)) &&
        !(book.isbn && ownedIsbns.has(book.isbn)),
    );
  }

  const bestsellerSections = groupNytByList(excludeOwned(nytBooks)).map(
    (section) => ({
      ...section,
      books: section.books.slice(0, BOOKS_PER_CATEGORY),
    }),
  );

  const topRatedSection: Section = {
    key: "top-rated",
    label: "Più votati",
    books: excludeOwned(topRatedBooks).slice(0, TOP_RATED_LIMIT),
  };

  const sections = [...bestsellerSections, topRatedSection].filter(
    (section) => section.books.length > 0,
  );

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-serif text-2xl">Suggerimenti di lettura</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bestseller New York Times e libri più votati, dal tuo catalogo.
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
                key={book.mongoId}
                title={book.title}
                author={book.authors.join(", ") || null}
                yearOrDetail={
                  book.nytRank
                    ? `#${book.nytRank}${book.nytWeeksOnList ? ` · ${book.nytWeeksOnList} settimane` : ""}`
                    : book.year
                }
                description={book.description}
                averageRating={book.olRating}
                ratingsCount={book.olRatingsCount}
                onAdd={addMongoBookToCatalog.bind(null, book)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
