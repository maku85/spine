import { BookPlus, LibraryBig } from "lucide-react";
import Link from "next/link";
import { type LibraryBook, LibraryView } from "@/components/library-view";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userBooks, error } = await supabase
    .from("user_books")
    .select("id, status, rating, added_at, books(title, authors)")
    .order("added_at", { ascending: false });

  if (error) throw error;

  if (!userBooks || userBooks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed py-24 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LibraryBig className="size-7" strokeWidth={1.75} />
        </div>
        <div>
          <p className="font-serif text-lg">Il tuo scaffale è vuoto</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cerca un titolo e aggiungi il tuo primo libro al catalogo.
          </p>
        </div>
        <Button
          render={<Link href="/books/add" />}
          nativeButton={false}
          className="mt-2 gap-1.5"
        >
          <BookPlus className="size-4" />
          Aggiungi il tuo primo libro
        </Button>
      </div>
    );
  }

  const books: LibraryBook[] = [];
  for (const userBook of userBooks) {
    if (!userBook.books) continue;
    books.push({
      userBookId: userBook.id,
      title: userBook.books.title,
      authors: userBook.books.authors,
      status: userBook.status,
      rating: userBook.rating,
      addedAt: userBook.added_at,
    });
  }

  return <LibraryView books={books} />;
}
