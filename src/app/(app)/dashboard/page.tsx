import { BookPlus, LibraryBig } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { type LibraryBook, LibraryView } from "@/components/library-view";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userBooks, error } = await supabase
    .from("user_books")
    .select("id, status, liked, added_at, books(title, authors)")
    .order("added_at", { ascending: false });

  if (error) throw error;

  if (!userBooks || userBooks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed py-24 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LibraryBig className="size-7" strokeWidth={1.75} />
        </div>
        <div>
          <p className="font-serif text-lg">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("emptyMessage")}
          </p>
        </div>
        <Button
          render={<Link href="/explore" />}
          nativeButton={false}
          className="mt-2 gap-1.5"
        >
          <BookPlus className="size-4" />
          {t("emptyCta")}
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
      liked: userBook.liked,
      addedAt: userBook.added_at,
    });
  }

  return <LibraryView books={books} />;
}
