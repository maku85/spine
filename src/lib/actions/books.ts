"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ChartEntry } from "@/lib/charts/read";
import { curateGenres, mergeGenres } from "@/lib/genres";
import { fetchGoogleBooksEnrichment } from "@/lib/google-books/search";
import { isItalian } from "@/lib/language";
import type { MongoBookResult } from "@/lib/mongo-books/search";
import { fetchWorkDetails } from "@/lib/open-library/search";
import type { OLSearchResult } from "@/lib/open-library/types";
import type { ReadingStatus } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// Adds a `user_books` row for an already-upserted `books` row, ignoring the
// case where the user already has this book (unique_violation).
async function insertUserBook(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
) {
  const { error } = await supabase
    .from("user_books")
    .insert({ user_id: userId, book_id: bookId });

  if (error && error.code !== "23505") throw error;
}

// Google Books descriptions are usually a single, coherent language (unlike
// Open Library's, which are often several languages concatenated), so prefer
// it when it's confidently Italian. Otherwise keep Open Library's version
// (already Italian-filtered where possible), falling back to whichever
// source actually has something.
function pickDescription(
  openLibraryDescription: string | null,
  googleDescription: string | null,
): string | null {
  if (googleDescription && isItalian(googleDescription)) {
    return googleDescription;
  }
  return openLibraryDescription ?? googleDescription ?? null;
}

export async function addBookToCatalog(result: OLSearchResult) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [openLibrary, googleBooks] = await Promise.all([
    fetchWorkDetails(result.workKey),
    fetchGoogleBooksEnrichment({
      isbn: result.isbn,
      title: result.title,
      authors: result.authors,
    }),
  ]);

  const description = pickDescription(
    openLibrary.description,
    googleBooks.description,
  );
  const subjects = mergeGenres(openLibrary.subjects, googleBooks.categories);

  const { data: book, error: bookErr } = await supabase.rpc(
    "upsert_book_from_ol",
    {
      p_ol_work_key: result.workKey,
      p_ol_edition_key: result.editionKey,
      p_isbn: result.isbn,
      p_title: result.title,
      p_authors: result.authors,
      p_description: description,
      p_subjects: subjects,
      p_first_publish_year: result.firstPublishYear,
    },
  );

  if (bookErr || !book) throw bookErr ?? new Error("Book upsert failed");

  await insertUserBook(supabase, user.id, book.id);
  revalidatePath("/dashboard");
}

// Adds a book straight from a chart entry (bestseller, popularity, or
// curated — see scripts/import-charts.mts), without resolving it through
// Open Library/Google Books first: the chart already gives us title,
// author, description, and ISBN, which is enough to catalog it. Used by
// the suggestions page so it keeps working even if Open Library is slow/
// down.
export async function addChartBookToCatalog(book: ChartEntry) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const authors = book.author ? [book.author] : [];

  const { data: dbBook, error: bookErr } = await supabase.rpc(
    "upsert_book_from_ol",
    {
      p_ol_work_key: null,
      p_ol_edition_key: null,
      p_isbn: book.isbn,
      p_title: book.title,
      p_authors: authors,
      p_description: book.description,
      p_subjects: [],
      p_first_publish_year: null,
    },
  );

  if (bookErr || !dbBook) throw bookErr ?? new Error("Book upsert failed");

  await insertUserBook(supabase, user.id, dbBook.id);
  revalidatePath("/dashboard");
}

// Adds a book straight from our own Mongo catalog (populated in bulk by
// scripts/import-google-books.mts), without resolving it through Open
// Library first: we already have title, authors, isbn, description, and
// categories from Google Books, which is enough to catalog it directly —
// same idea as addChartBookToCatalog.
export async function addMongoBookToCatalog(book: MongoBookResult) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: dbBook, error: bookErr } = await supabase.rpc(
    "upsert_book_from_ol",
    {
      p_ol_work_key: null,
      p_ol_edition_key: null,
      p_isbn: book.isbn,
      p_title: book.title,
      p_authors: book.authors,
      p_description: book.description,
      p_subjects: curateGenres(book.categories),
      p_first_publish_year: book.year,
    },
  );

  if (bookErr || !dbBook) throw bookErr ?? new Error("Book upsert failed");

  await insertUserBook(supabase, user.id, dbBook.id);
  revalidatePath("/dashboard");
}

export async function updateUserBook(
  userBookId: string,
  updates: { status?: ReadingStatus; rating?: number | null },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_books")
    .update(updates)
    .eq("id", userBookId);

  if (error) throw error;

  revalidatePath("/dashboard");
  revalidatePath(`/books/${userBookId}`);
}

export async function removeUserBook(userBookId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_books")
    .delete()
    .eq("id", userBookId);

  if (error) throw error;

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
