"use server";

import { revalidatePath } from "next/cache";
import type { BookieImportBook } from "@/lib/bookie-import";
import { fetchWorkDetails, searchOpenLibrary } from "@/lib/open-library/search";
import { createClient } from "@/lib/supabase/server";

export type BookieImportResult = {
  isbn: string;
  title: string;
  outcome: "imported" | "already_present" | "failed";
  message?: string;
};

export async function importBookieBatch(
  books: BookieImportBook[],
): Promise<BookieImportResult[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const results = await Promise.all(
    books.map(async (book): Promise<BookieImportResult> => {
      const searchResult = await searchOpenLibrary(book.isbn);
      const match = searchResult.items[0] ?? null;
      const details = match
        ? await fetchWorkDetails(match.workKey)
        : { description: null, subjects: [] };

      const { data: dbBook, error: bookErr } = await supabase.rpc(
        "upsert_book_from_ol",
        {
          p_ol_work_key: match?.workKey ?? null,
          p_ol_edition_key: match?.editionKey ?? null,
          p_isbn: book.isbn,
          p_title: book.title,
          p_authors: book.authors,
          p_description: details.description,
          p_subjects: details.subjects,
          p_first_publish_year: match?.firstPublishYear ?? null,
        },
      );

      if (bookErr || !dbBook) {
        return {
          isbn: book.isbn,
          title: book.title,
          outcome: "failed",
          message: bookErr?.message ?? "Upsert fallito",
        };
      }

      const { error: insertErr } = await supabase.from("user_books").insert({
        user_id: user.id,
        book_id: dbBook.id,
        status: book.status,
        rating: book.rating,
      });

      if (insertErr) {
        if (insertErr.code === "23505") {
          return {
            isbn: book.isbn,
            title: book.title,
            outcome: "already_present",
          };
        }
        return {
          isbn: book.isbn,
          title: book.title,
          outcome: "failed",
          message: insertErr.message,
        };
      }

      return { isbn: book.isbn, title: book.title, outcome: "imported" };
    }),
  );

  revalidatePath("/dashboard");
  return results;
}
