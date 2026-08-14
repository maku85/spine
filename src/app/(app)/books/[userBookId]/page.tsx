import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AddToListDialog } from "@/components/add-to-list-dialog";
import { BookCover } from "@/components/book-cover";
import { LikeButton } from "@/components/like-button";
import { RemoveBookButton } from "@/components/remove-book-button";
import { SimilarBooksSection } from "@/components/similar-books-section";
import { StatusSelect } from "@/components/status-select";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ userBookId: string }>;
}) {
  const { userBookId } = await params;

  const t = await getTranslations("BookDetail");
  const tLibrary = await getTranslations("Library");
  const unknownAuthor = tLibrary("unknownAuthor");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userBook } = await supabase
    .from("user_books")
    .select(
      "id, status, liked, books(title, authors, description, subjects, first_publish_year)",
    )
    .eq("id", userBookId)
    .single();

  if (!userBook || !userBook.books) notFound();

  const book = userBook.books;

  const { data: lists } = user
    ? await supabase
        .from("lists")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const listIds = (lists ?? []).map((list) => list.id);
  const { data: memberships } =
    listIds.length > 0
      ? await supabase
          .from("list_books")
          .select("list_id")
          .eq("user_book_id", userBookId)
          .in("list_id", listIds)
      : { data: [] };
  const memberListIds = (memberships ?? []).map((m) => m.list_id);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-2 text-xs font-mono tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground sm:mb-8"
      >
        <ArrowLeft className="size-3.5" />
        {t("backLink")}
      </Link>

      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <div className="mx-auto sm:mx-0 shrink-0">
          <BookCover title={book.title} author={book.authors[0]} size="lg" />
        </div>

        <div className="flex flex-1 flex-col gap-6">
          <div className="border-b border-border/50 pb-4">
            <h1 className="font-serif text-2xl font-normal leading-tight text-foreground sm:text-3xl">
              {book.title}
            </h1>
            <p className="mt-2 text-base text-muted-foreground font-sans">
              {book.authors.join(", ") || unknownAuthor}
              {book.first_publish_year && (
                <span className="font-mono text-xs text-muted-foreground/70 ml-2">
                  · {book.first_publish_year}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/80 p-4 shadow-xs">
            <StatusSelect userBookId={userBook.id} status={userBook.status} />
            <div className="border-t border-border/40 pt-3">
              <LikeButton userBookId={userBook.id} liked={userBook.liked} />
            </div>
          </div>

          {book.subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {book.subjects.map((subject) => (
                <Badge
                  key={subject}
                  variant="outline"
                  className="bg-secondary/40 font-mono text-[9px] tracking-widest text-muted-foreground uppercase border-border/60"
                >
                  {subject}
                </Badge>
              ))}
            </div>
          )}

          {book.description && (
            <div className="rounded-xl border border-border/40 bg-card/40 p-5 leading-relaxed text-foreground/90">
              <p className="font-serif text-sm leading-relaxed">
                {book.description}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <AddToListDialog
              userBookId={userBook.id}
              lists={lists ?? []}
              memberListIds={memberListIds}
            />
            <RemoveBookButton userBookId={userBook.id} title={book.title} />
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-border/60 pt-8 sm:mt-12">
        <SimilarBooksSection title={book.title} />
      </div>
    </div>
  );
}
