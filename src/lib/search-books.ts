"use server";

import {
  type MongoBookResult,
  searchMongoBooks,
} from "@/lib/mongo-books/search";
import { searchOpenLibrary } from "@/lib/open-library/search";
import type { OLSearchResult } from "@/lib/open-library/types";
import { SEARCH_PAGE_SIZE } from "@/lib/search-books-constants";

export type SearchItem =
  | {
      source: "mongo";
      key: string;
      title: string;
      authors: string[];
      year: number | null;
      book: MongoBookResult;
    }
  | {
      source: "openlibrary";
      key: string;
      title: string;
      authors: string[];
      year: number | null;
      book: OLSearchResult;
    };

export type SearchResultsPage = {
  items: SearchItem[];
  totalCount: number;
  page: number;
  pageSize: number;
};

// Cerca prima nel catalogo Mongo (importato in bulk da Google Books, nessuna
// chiamata esterna) e usa Open Library solo quando Mongo non trova nulla:
// veloce e senza limiti di quota per i libri che abbiamo già, completa per
// tutti gli altri. Una query resta sulla stessa fonte per tutte le sue
// pagine (il conteggio totale non dipende dalla pagina richiesta).
export async function searchBooks(
  query: string,
  page = 1,
): Promise<SearchResultsPage> {
  const mongoPage = await searchMongoBooks(query, page);
  if (mongoPage.totalCount > 0) {
    return {
      items: mongoPage.items.map((book) => ({
        source: "mongo" as const,
        key: `mongo:${book.mongoId}`,
        title: book.title,
        authors: book.authors,
        year: book.year,
        book,
      })),
      totalCount: mongoPage.totalCount,
      page,
      pageSize: SEARCH_PAGE_SIZE,
    };
  }

  const olPage = await searchOpenLibrary(query, page);
  return {
    items: olPage.items.map((book) => ({
      source: "openlibrary" as const,
      key: book.workKey,
      title: book.title,
      authors: book.authors,
      year: book.firstPublishYear,
      book,
    })),
    totalCount: olPage.totalCount,
    page,
    pageSize: SEARCH_PAGE_SIZE,
  };
}
