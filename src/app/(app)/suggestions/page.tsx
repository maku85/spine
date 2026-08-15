import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SuggestionsTabs } from "@/components/suggestions-tabs";
import { fetchNotableLists, type SuggestedList } from "@/lib/lists/read";
import { fetchTopRatedBooks, type SuggestedBook } from "@/lib/suggestions/read";
import { createClient } from "@/lib/supabase/server";
import { normalizeTitle } from "@/lib/text";

const TOP_RATED_LIMIT = 50;

const NYT_LIST_ORDER = [
  "Narrativa",
  "Saggistica",
  "Young Adult",
  "Economia",
  "Fumetti",
  "Narrativa (tascabile)",
];

function sortLists(lists: SuggestedList[]): SuggestedList[] {
  return [...lists].sort((a, b) => {
    if (a.source !== b.source) return a.source === "nyt" ? -1 : 1;
    if (a.source === "nyt") {
      const ai = NYT_LIST_ORDER.indexOf(a.name);
      const bi = NYT_LIST_ORDER.indexOf(b.name);
      return (
        (ai === -1 ? NYT_LIST_ORDER.length : ai) -
        (bi === -1 ? NYT_LIST_ORDER.length : bi)
      );
    }
    return (b.followersCount ?? 0) - (a.followersCount ?? 0);
  });
}

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

type SectionItem = {
  book: SuggestedBook;
  detail: string | number | null;
};

type Section = {
  key: string;
  label: string;
  items: SectionItem[];
};

export default async function SuggestionsPage() {
  const t = await getTranslations("Suggestions");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("language")
    .eq("id", user?.id ?? "")
    .single();
  const preferredLanguage = profile?.language ?? "it";

  if (!process.env.MONGODB_URI) {
    return (
      <EmptyState
        title={t("notConfigured.title")}
        message={t("notConfigured.message")}
      />
    );
  }

  const [lists, topRatedBooks] = await Promise.all([
    fetchNotableLists(preferredLanguage),
    fetchTopRatedBooks(preferredLanguage),
  ]);

  if (lists.length === 0 && topRatedBooks.length === 0) {
    return (
      <EmptyState
        title={t("noneAvailable.title")}
        message={t("noneAvailable.message")}
      />
    );
  }

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

  function isOwned(book: SuggestedBook): boolean {
    return (
      ownedTitleKeys.has(normalizeTitle(book.title)) ||
      Boolean(book.isbn && ownedIsbns.has(book.isbn))
    );
  }

  function excludeOwned(books: SuggestedBook[]): SuggestedBook[] {
    return books.filter((book) => !isOwned(book));
  }

  function toSections(source: SuggestedList["source"]): Section[] {
    return sortLists(lists.filter((list) => list.source === source))
      .map((list) => ({
        key: list.key,
        label: source === "nyt" ? `NYT — ${list.name}` : list.name,
        items: list.entries
          .filter((entry) => !isOwned(entry.book))
          .map((entry) => ({
            book: entry.book,
            detail: entry.position ? `#${entry.position}` : entry.book.year,
          })),
      }))
      .filter((section) => section.items.length > 0);
  }

  const nytSections = toSections("nyt");
  const hardcoverSections = toSections("hardcover");

  const topRatedSection: Section = {
    key: "top-rated",
    label: t("topRated"),
    items: excludeOwned(topRatedBooks)
      .slice(0, TOP_RATED_LIMIT)
      .map((book) => ({ book, detail: book.year })),
  };

  const hasAnySuggestions =
    nytSections.length > 0 ||
    hardcoverSections.length > 0 ||
    topRatedSection.items.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-2xl">{t("page.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("page.subtitle")}
        </p>
      </div>

      {hasAnySuggestions ? (
        <SuggestionsTabs
          nytSections={nytSections}
          hardcoverSections={hardcoverSections}
          topRatedSection={topRatedSection}
          isAuthenticated={Boolean(user)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("allOwned")}</p>
      )}
    </div>
  );
}
