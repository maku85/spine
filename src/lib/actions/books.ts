"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { curateGenres, mergeGenres } from "@/lib/genres";
import { fetchGoogleBooksEnrichment } from "@/lib/google-books/search";
import { isItalian } from "@/lib/language";
import type { MongoBookResult } from "@/lib/mongo-books/search";
import { fetchWorkDetails } from "@/lib/open-library/search";
import type { OLSearchResult } from "@/lib/open-library/types";
import type { ReadingStatus } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

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
  updates: { status?: ReadingStatus; liked?: boolean | null },
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
