import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { BookCardShell } from "@/components/book-card-shell";
import { BookCover } from "@/components/book-cover";
import { LikeButton } from "@/components/like-button";
import { StatusSelect } from "@/components/status-select";
import type { ReadingStatus } from "@/lib/supabase/database.types";

export function BookCard({
  userBookId,
  title,
  authors,
  status,
  liked,
  addedAt,
  compact = false,
}: {
  userBookId: string;
  title: string;
  authors: string[];
  status: ReadingStatus;
  liked: boolean | null;
  addedAt: string;
  compact?: boolean;
}) {
  const t = useTranslations("Library");
  const locale = useLocale();
  const addedLabel = new Intl.DateTimeFormat(
    locale === "en" ? "en-US" : "it-IT",
    { day: "2-digit", month: "short" },
  )
    .format(new Date(addedAt))
    .toUpperCase();

  if (compact) {
    return (
      <BookCardShell compact>
        <Link href={`/books/${userBookId}`}>
          <BookCover title={title} author={authors[0]} size="compact" />
        </Link>
        <StatusSelect userBookId={userBookId} status={status} />
        <div className="flex w-full items-center justify-between gap-2 border-t border-border/40 pt-2">
          <LikeButton userBookId={userBookId} liked={liked} />
          <span className="font-mono text-[9px] font-medium tracking-widest text-muted-foreground/70 uppercase">
            {addedLabel}
          </span>
        </div>
      </BookCardShell>
    );
  }

  return (
    <BookCardShell>
      <Link href={`/books/${userBookId}`} className="shrink-0">
        <BookCover title={title} author={authors[0]} size="md" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="flex min-w-0 flex-col gap-1">
          <Link href={`/books/${userBookId}`} className="group/link min-w-0">
            <p className="truncate font-serif text-base font-medium leading-snug text-foreground transition-colors group-hover/link:text-primary">
              {title}
            </p>
            <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
              {authors.join(", ") || t("unknownAuthor")}
            </p>
          </Link>
          <div className="mt-2.5">
            <StatusSelect userBookId={userBookId} status={status} />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-2.5">
          <LikeButton userBookId={userBookId} liked={liked} />
          <span className="font-mono text-[9px] font-medium tracking-widest text-muted-foreground/70 uppercase">
            {addedLabel}
          </span>
        </div>
      </div>
    </BookCardShell>
  );
}
