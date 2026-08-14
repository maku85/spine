"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { BookCard } from "@/components/book-card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import {
  groupIntoSections,
  primaryAuthor,
  SORT_LABELS,
  type SortKey,
} from "@/lib/book-sections";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/reading-status";
import type { ReadingStatus } from "@/lib/supabase/database.types";

type StatusFilter = ReadingStatus | "all";

export type LibraryBook = {
  userBookId: string;
  title: string;
  authors: string[];
  status: ReadingStatus;
  liked: boolean | null;
  addedAt: string;
};

const LIKED_LABELS: Record<string, string> = {
  all: "Qualsiasi giudizio",
  liked: "Mi piace",
  disliked: "Non mi piace",
  none: "Senza giudizio",
};

export function LibraryView({ books }: { books: LibraryBook[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("added_desc");
  const [likedFilter, setLikedFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const statusCounts = useMemo(() => {
    const counts: Record<ReadingStatus, number> = {
      wishlist: 0,
      to_read: 0,
      reading: 0,
      read: 0,
    };
    for (const book of books) counts[book.status] += 1;
    return counts;
  }, [books]);

  const tabBooks = useMemo(
    () =>
      statusFilter === "all"
        ? books
        : books.filter((book) => book.status === statusFilter),
    [books, statusFilter],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const matching = tabBooks.filter((book) => {
      const matchesQuery =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.authors.some((author) => author.toLowerCase().includes(q));

      const matchesLiked =
        likedFilter === "all"
          ? true
          : likedFilter === "none"
            ? book.liked === null
            : likedFilter === "liked"
              ? book.liked === true
              : book.liked === false;

      return matchesQuery && matchesLiked;
    });

    return matching.sort((a, b) => {
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
        case "author_desc":
          return primaryAuthor(b.authors).localeCompare(
            primaryAuthor(a.authors),
            "it",
          );
        default:
          return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      }
    });
  }, [tabBooks, query, sort, likedFilter]);

  const sections = useMemo(
    () => groupIntoSections(filtered, sort),
    [filtered, sort],
  );
  const isTitleSort = sort === "title_asc" || sort === "title_desc";

  return (
    <div>
      <div className="mb-6 flex flex-col gap-1 border-b border-border/50 pb-5 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-normal tracking-tight sm:text-3xl">
            La tua libreria
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catalogo privato delle tue letture, recensioni e desideri.
          </p>
        </div>
        <div className="mt-2 sm:mt-0 flex items-center gap-2">
          <div className="rounded-full bg-secondary/80 px-3.5 py-1 text-xs font-mono tracking-wider text-muted-foreground border border-border/60">
            VOLUMES:{" "}
            <span className="font-semibold text-foreground">
              {filtered.length}
            </span>
            {filtered.length !== tabBooks.length && (
              <span className="text-muted-foreground/70">
                {" "}
                / {tabBooks.length}
              </span>
            )}
          </div>
        </div>
      </div>

      <Tabs
        value={statusFilter}
        onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        className="mb-6 sm:mb-8"
      >
        <TabsList className="w-full flex-wrap sm:w-fit">
          <TabsTab value="all">Tutti ({books.length})</TabsTab>
          {STATUS_ORDER.map((status) => (
            <TabsTab key={status} value={status}>
              {STATUS_LABELS[status]} ({statusCounts[status]})
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between bg-card/60 p-3 rounded-xl border border-border/60 shadow-xs sm:p-3.5">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/80" />
          <Input
            placeholder="Cerca per titolo o autore…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-background/80 border-border/70 focus-visible:ring-brass/50"
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={likedFilter}
            onValueChange={(value) => setLikedFilter(value ?? "all")}
          >
            <SelectTrigger className="flex-1 min-w-0 bg-background/80 border-border/70 text-xs sm:w-[170px] sm:flex-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LIKED_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            Nessun risultato trovato
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Prova a modificare i filtri o il termine di ricerca.
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
                  <BookCard key={book.userBookId} {...book} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
