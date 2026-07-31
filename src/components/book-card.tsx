import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { RatingInput } from "@/components/rating-input";
import { StatusSelect } from "@/components/status-select";
import { Card, CardContent } from "@/components/ui/card";
import type { ReadingStatus } from "@/lib/supabase/database.types";

export function BookCard({
  userBookId,
  title,
  authors,
  status,
  rating,
  addedAt,
}: {
  userBookId: string;
  title: string;
  authors: string[];
  status: ReadingStatus;
  rating: number | null;
  addedAt: string;
}) {
  const addedLabel = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
  })
    .format(new Date(addedAt))
    .toUpperCase();

  return (
    <Card className="tactile-card group/card relative overflow-hidden border border-border/80 bg-card/95 py-0 transition-all duration-300 hover:border-brass/50 hover:shadow-xl">
      {/* Subtle Bookmark Ribbon Accent top corner */}
      <div className="absolute top-0 right-4 h-3 w-2.5 bg-brass/80 rounded-b-xs shadow-xs z-10 opacity-70 group-hover/card:h-4 group-hover/card:opacity-100 transition-all" />

      {/* Wood & Brass Accent Stripe */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-wood via-brass to-wood opacity-80" />

      <CardContent className="flex gap-4 p-4">
        <Link href={`/books/${userBookId}`} className="shrink-0">
          <BookCover title={title} author={authors[0]} size="md" />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div className="flex min-w-0 flex-col gap-1">
            <Link href={`/books/${userBookId}`} className="group/link min-w-0">
              <p className="truncate font-serif text-base font-medium leading-snug text-foreground group-hover/link:text-primary transition-colors">
                {title}
              </p>
              <p className="truncate text-xs font-normal text-muted-foreground mt-0.5">
                {authors.join(", ") || "Autore sconosciuto"}
              </p>
            </Link>
            <div className="mt-2.5">
              <StatusSelect userBookId={userBookId} status={status} />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-2.5">
            <RatingInput userBookId={userBookId} rating={rating} />
            <span className="font-mono text-[9px] tracking-widest text-muted-foreground/70 uppercase font-medium">
              {addedLabel}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
