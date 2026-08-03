"use client";

import {
  BookCheck,
  BookOpen,
  Clock,
  Heart,
  Search,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PublicBookCard } from "@/components/public-book-card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  groupIntoSections,
  primaryAuthor,
  SORT_LABELS,
  type SortKey,
} from "@/lib/book-sections";
import { STATUS_LABELS } from "@/lib/reading-status";
import type { ReadingStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export type PublicLibraryBook = {
  userBookId: string;
  title: string;
  authors: string[];
  status: ReadingStatus;
  rating: number | null;
  description: string | null;
  subjects: string[];
  firstPublishYear: number | null;
  nytReviewUrl: string | null;
  nytReviewSummary: string | null;
};

const STATUS_FILTER_OPTIONS: {
  key: string;
  label: string;
  icon?: React.ElementType;
}[] = [
  { key: "all", label: "Tutti i volumi", icon: BookOpen },
  { key: "read", label: STATUS_LABELS.read, icon: BookCheck },
  { key: "reading", label: STATUS_LABELS.reading, icon: Sparkles },
  { key: "to_read", label: STATUS_LABELS.to_read, icon: Clock },
  { key: "wishlist", label: STATUS_LABELS.wishlist, icon: Heart },
];

export function PublicLibraryView({ books }: { books: PublicLibraryBook[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("added_desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");

  const counts = useMemo(() => {
    return {
      all: books.length,
      read: books.filter((b) => b.status === "read").length,
      reading: books.filter((b) => b.status === "reading").length,
      to_read: books.filter((b) => b.status === "to_read").length,
      wishlist: books.filter((b) => b.status === "wishlist").length,
    };
  }, [books]);

  const selectStatus = (key: string) => {
    setStatusFilter(key);
    setGenreFilter("all");
  };

  const genresInStatus = useMemo(() => {
    const inStatus =
      statusFilter === "all"
        ? books
        : books.filter((b) => b.status === statusFilter);

    const genreCounts = new Map<string, number>();
    for (const book of inStatus) {
      for (const subject of book.subjects) {
        genreCounts.set(subject, (genreCounts.get(subject) ?? 0) + 1);
      }
    }

    return [...genreCounts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it"),
    );
  }, [books, statusFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = books.filter((book) => {
      const matchesQuery =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.authors.some((author) => author.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "all" ? true : book.status === statusFilter;

      const matchesGenre =
        genreFilter === "all" ? true : book.subjects.includes(genreFilter);

      return matchesQuery && matchesStatus && matchesGenre;
    });

    if (sort === "added_desc") return matching;
    return [...matching].sort((a, b) => {
      switch (sort) {
        case "title_asc":
          return a.title.localeCompare(b.title, "it");
        case "title_desc":
          return b.title.localeCompare(a.title, "it");
        case "author_asc":
          return primaryAuthor(a.authors).localeCompare(
            primaryAuthor(b.authors),
            "it",
          );
        default:
          return primaryAuthor(b.authors).localeCompare(
            primaryAuthor(a.authors),
            "it",
          );
      }
    });
  }, [books, query, sort, statusFilter, genreFilter]);

  const sections = useMemo(
    () => groupIntoSections(filtered, sort),
    [filtered, sort],
  );
  const isTitleSort = sort === "title_asc" || sort === "title_desc";

  return (
    <div>
      {/* Interactive Status Pill Tabs Bar - scrollable on mobile */}
      <div className="mb-6 -mx-1 overflow-x-auto pb-4 sm:mx-0">
        <div className="flex min-w-max items-center gap-2 border-b border-border/50 px-1 pb-3 sm:flex-wrap sm:min-w-0">
          {STATUS_FILTER_OPTIONS.map((option) => {
            const count = counts[option.key as keyof typeof counts] || 0;
            const isActive = statusFilter === option.key;
            const Icon = option.icon;

            if (option.key !== "all" && count === 0) return null;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => selectStatus(option.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer select-none",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-brass/40"
                    : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50",
                )}
              >
                {Icon && <Icon className="size-3.5 opacity-80" />}
                <span>{option.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background/80 text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Genre breakdown for the active status tab — click a genre to
          narrow the grid further, "Tutti i generi" clears it. */}
      {genresInStatus.length > 0 && (
        <div className="mb-6 -mx-1 flex flex-wrap items-center gap-1.5 px-1">
          <span className="mr-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Generi
          </span>
          <button
            type="button"
            onClick={() => setGenreFilter("all")}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer select-none",
              genreFilter === "all"
                ? "border-brass/50 bg-brass/10 text-foreground"
                : "border-border/50 bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            Tutti
          </button>
          {genresInStatus.map(([genre, count]) => (
            <button
              key={genre}
              type="button"
              onClick={() =>
                setGenreFilter((current) => (current === genre ? "all" : genre))
              }
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer select-none",
                genreFilter === genre
                  ? "border-brass/50 bg-brass/10 text-foreground"
                  : "border-border/50 bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {genre} <span className="text-muted-foreground/70">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search and Controls Bar */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card/60 p-3 rounded-xl border border-border/60 shadow-xs sm:p-3.5">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/80" />
          <Input
            placeholder="Cerca per titolo o autore…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-background/80 border-border/70 focus-visible:ring-brass/50 text-xs"
          />
        </div>
        <div className="flex gap-2">
          {/* Status Filter Dropdown (Mobile Friendly) */}
          <Select
            value={statusFilter}
            onValueChange={(value) => selectStatus(value ?? "all")}
          >
            <SelectTrigger className="flex-1 min-w-0 bg-background/80 border-border/70 text-xs sm:hidden">
              <SelectValue placeholder="Stato lettura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Tutti i volumi ({counts.all})
              </SelectItem>
              <SelectItem value="read" className="text-xs">
                {STATUS_LABELS.read} ({counts.read})
              </SelectItem>
              <SelectItem value="reading" className="text-xs">
                {STATUS_LABELS.reading} ({counts.reading})
              </SelectItem>
              <SelectItem value="to_read" className="text-xs">
                {STATUS_LABELS.to_read} ({counts.to_read})
              </SelectItem>
              <SelectItem value="wishlist" className="text-xs">
                {STATUS_LABELS.wishlist} ({counts.wishlist})
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Dropdown */}
          <Select
            value={sort}
            onValueChange={(value) => setSort(value as SortKey)}
          >
            <SelectTrigger className="flex-1 min-w-0 bg-background/80 border-border/70 text-xs sm:w-[170px] sm:flex-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 py-16 text-center">
          <p className="font-serif text-lg text-foreground">
            Nessun libro corrisponde ai filtri
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Prova a selezionare un altro stato di lettura, un altro genere, o a
            cancellare la ricerca.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {sections.map((section) => (
            <div key={section.header ?? "all"}>
              {section.header &&
                (isTitleSort ? (
                  <h2 className="mb-4 flex items-center gap-3">
                    <span className="font-serif text-2xl font-medium text-primary">
                      {section.header}
                    </span>
                    <span className="h-[1px] flex-1 bg-gradient-to-r from-border via-border/50 to-transparent" />
                  </h2>
                ) : (
                  <h2 className="mb-4 flex items-center gap-3">
                    <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase bg-secondary/60 px-2.5 py-0.5 rounded border border-border/40">
                      {section.header}
                    </span>
                    <span className="h-[1px] flex-1 bg-gradient-to-r from-border via-border/50 to-transparent" />
                  </h2>
                ))}
              <div className="grid gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
                {section.books.map((book) => (
                  <PublicBookCard key={book.userBookId} {...book} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
