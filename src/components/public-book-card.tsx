"use client";

import { ExternalLink, Star } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { STATUS_LABELS } from "@/lib/reading-status";
import type { ReadingStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

// Read-only: shown on a public profile page to visitors who aren't the
// owner, so no StatusSelect/RatingInput (those write via RLS policies that
// only the owner can satisfy anyway) — the badge/stars here are static, and
// the detail view is a dialog rather than a page since there's no editing
// to link out to.
export function PublicBookCard({
  title,
  authors,
  status,
  rating,
  description,
  subjects,
  firstPublishYear,
  nytReviewUrl,
  nytReviewSummary,
}: {
  title: string;
  authors: string[];
  status: ReadingStatus;
  rating: number | null;
  description: string | null;
  subjects: string[];
  firstPublishYear: number | null;
  nytReviewUrl: string | null;
  nytReviewSummary: string | null;
}) {
  const authorLabel = authors.join(", ") || "Autore sconosciuto";

  const statusBadge = (
    <Badge
      variant="outline"
      className="w-fit font-mono text-[9px] tracking-widest uppercase bg-secondary/40 border-border/60"
    >
      {STATUS_LABELS[status]}
    </Badge>
  );

  const starRow = rating && (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={cn(
            "size-3.5",
            value <= rating
              ? "fill-brass text-brass"
              : "text-muted-foreground/25",
          )}
        />
      ))}
    </div>
  );

  return (
    <Dialog>
      <Card className="tactile-card group relative overflow-hidden border border-border/70 bg-card/90 py-0 transition-all hover:border-border">
        {/* Wood accent stripe on bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-wood via-brass to-wood opacity-80" />

        <CardContent className="flex gap-4 p-4">
          <DialogTrigger render={<button type="button" className="shrink-0" />}>
            <BookCover title={title} author={authors[0]} size="md" />
          </DialogTrigger>
          <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
            <DialogTrigger
              render={
                <button
                  type="button"
                  className="min-w-0 text-left cursor-pointer"
                />
              }
            >
              <p className="truncate font-serif text-base font-medium leading-snug group-hover:text-primary transition-colors">
                {title}
              </p>
              <p className="truncate text-xs text-muted-foreground mt-0.5">
                {authorLabel}
              </p>
            </DialogTrigger>
            <div className="mt-2">{statusBadge}</div>
            {starRow && (
              <div className="mt-3 border-t border-border/40 pt-2">
                {starRow}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <DialogContent className="w-[calc(100vw-2rem)] rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg font-normal sm:text-xl">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-4">
          <BookCover
            title={title}
            author={authors[0]}
            size="md"
            className="shrink-0"
          />
          <div className="flex min-w-0 flex-col gap-2 py-1">
            <p className="text-sm font-sans font-medium text-foreground">
              {authorLabel}
            </p>
            {firstPublishYear && (
              <p className="font-mono text-xs text-muted-foreground">
                Anno: {firstPublishYear}
              </p>
            )}
            <div className="mt-1">{statusBadge}</div>
            {starRow && <div className="mt-1">{starRow}</div>}
          </div>
        </div>

        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((subject) => (
              <Badge
                key={subject}
                variant="outline"
                className="font-mono text-[9px] tracking-widest uppercase bg-secondary/40 border-border/60"
              >
                {subject}
              </Badge>
            ))}
          </div>
        )}

        {description && (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase font-semibold">
              Descrizione del volume
            </span>
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 font-serif text-sm leading-relaxed text-foreground/90 max-h-[220px] overflow-y-auto pr-3">
              {description}
            </div>
          </div>
        )}

        {nytReviewUrl && (
          <a
            href={nytReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col gap-1.5 rounded-xl border border-brass/30 bg-brass/5 p-4 transition-colors hover:bg-brass/10"
          >
            <span className="font-mono text-[10px] tracking-widest text-brass uppercase font-semibold">
              The New York Times Review
            </span>
            {nytReviewSummary && (
              <p className="font-serif text-xs text-foreground/90 italic">
                "{nytReviewSummary}"
              </p>
            )}
            <span className="flex items-center gap-1 text-xs font-medium text-primary mt-1">
              Leggi la recensione completa
              <ExternalLink className="size-3" />
            </span>
          </a>
        )}
      </DialogContent>
    </Dialog>
  );
}
