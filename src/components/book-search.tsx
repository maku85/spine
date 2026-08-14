"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { IsbnScannerDialog } from "@/components/isbn-scanner-dialog";
import { SearchResultCard } from "@/components/search-result-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addBookToCatalog, addMongoBookToCatalog } from "@/lib/actions/books";
import type { BrowseSortKey } from "@/lib/mongo-books/search";
import {
  browseBooks,
  type SearchResultsPage,
  searchBooks,
} from "@/lib/search-books";
import { SEARCH_PAGE_SIZE } from "@/lib/search-books-constants";

const EMPTY_PAGE: SearchResultsPage = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: SEARCH_PAGE_SIZE,
};

const SORT_LABELS: Record<BrowseSortKey, string> = {
  rating_desc: "Più votati",
  title_asc: "Titolo A-Z",
  title_desc: "Titolo Z-A",
  year_desc: "Più recenti",
  year_asc: "Più datati",
};

export function BookSearch() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<BrowseSortKey>("rating_desc");
  const [page, setPage] = useState(1);
  const [resultsPage, setResultsPage] = useState<SearchResultsPage>(EMPTY_PAGE);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [isSearching, startSearch] = useTransition();
  const [isAdding, startAdd] = useTransition();

  const isBrowsing = !query.trim();

  useEffect(() => {
    if (isBrowsing) {
      startSearch(async () => {
        setResultsPage(await browseBooks(sort, page));
      });
      return;
    }

    const trimmed = query.trim();
    const timeout = setTimeout(() => {
      startSearch(async () => {
        setResultsPage(await searchBooks(trimmed, page));
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [query, sort, page, isBrowsing]);

  const totalPages = Math.max(
    1,
    Math.ceil(resultsPage.totalCount / resultsPage.pageSize),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per titolo, autore o ISBN…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <IsbnScannerDialog
          onDetected={(isbn) => {
            setQuery(isbn);
            setPage(1);
          }}
        />
      </div>
      {isBrowsing && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {resultsPage.totalCount > 0
              ? `${resultsPage.totalCount.toLocaleString("it-IT")} libri nel catalogo`
              : "Catalogo"}
          </p>
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as BrowseSortKey);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px] bg-background/80 border-border/70 text-xs">
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
      )}
      {isSearching && (
        <p className="text-sm text-muted-foreground">
          {isBrowsing ? "Caricamento…" : "Ricerca in corso…"}
        </p>
      )}
      {!isSearching && !isBrowsing && (
        <p className="text-sm text-muted-foreground">
          {resultsPage.totalCount === 0
            ? "Nessun risultato"
            : `${resultsPage.totalCount} risultat${resultsPage.totalCount === 1 ? "o" : "i"} trovat${resultsPage.totalCount === 1 ? "o" : "i"}`}
        </p>
      )}
      <div className="grid gap-3">
        {resultsPage.items.map((result) => (
          <SearchResultCard
            key={result.key}
            item={result}
            added={addedKeys.has(result.key)}
            isAdding={isAdding}
            onAdd={() =>
              startAdd(async () => {
                if (result.source === "mongo") {
                  await addMongoBookToCatalog(result.book);
                } else {
                  await addBookToCatalog(result.book);
                }
                setAddedKeys((prev) => new Set(prev).add(result.key));
              })
            }
          />
        ))}
      </div>
      {!isSearching && resultsPage.totalCount > resultsPage.pageSize && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            className="gap-1"
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="size-4" />
            Precedente
          </Button>
          <p className="text-xs text-muted-foreground">
            Pagina {page} di {totalPages}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            className="gap-1"
            onClick={() => setPage((p) => p + 1)}
          >
            Successiva
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
