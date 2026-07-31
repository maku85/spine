"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { IsbnScannerDialog } from "@/components/isbn-scanner-dialog";
import { SearchResultCard } from "@/components/search-result-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addBookToCatalog, addMongoBookToCatalog } from "@/lib/actions/books";
import { type SearchResultsPage, searchBooks } from "@/lib/search-books";
import { SEARCH_PAGE_SIZE } from "@/lib/search-books-constants";

const EMPTY_PAGE: SearchResultsPage = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: SEARCH_PAGE_SIZE,
};

export function BookSearch() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [resultsPage, setResultsPage] = useState<SearchResultsPage>(EMPTY_PAGE);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [isSearching, startSearch] = useTransition();
  const [isAdding, startAdd] = useTransition();

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResultsPage(EMPTY_PAGE);
      return;
    }

    const timeout = setTimeout(() => {
      startSearch(async () => {
        setResultsPage(await searchBooks(trimmed, page));
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [query, page]);

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
      {isSearching && (
        <p className="text-sm text-muted-foreground">Ricerca in corso…</p>
      )}
      {!isSearching && query.trim() && (
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
