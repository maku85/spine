"use client";

import { Check, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { BookCardShell } from "@/components/book-card-shell";
import { BookCover } from "@/components/book-cover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SuggestionCard({
  title,
  author,
  yearOrDetail,
  description,
  averageRating,
  ratingsCount,
  isAuthenticated,
  onAdd,
  compact = false,
}: {
  title: string;
  author: string | null;
  yearOrDetail?: string | number | null;
  description?: string | null;
  averageRating: number | null;
  ratingsCount: number | null;
  isAuthenticated: boolean;
  onAdd: () => Promise<void>;
  compact?: boolean;
}) {
  const [added, setAdded] = useState(false);
  const [isAdding, startAdd] = useTransition();
  const common = useTranslations("Common.actions");
  const t = useTranslations("Cards");
  const tLibrary = useTranslations("Library");
  const unknownAuthor = tLibrary("unknownAuthor");
  const locale = useLocale();
  const numberLocale = locale === "en" ? "en-US" : "it-IT";

  const addButton = isAuthenticated ? (
    <Button
      size="sm"
      variant={added ? "secondary" : "default"}
      disabled={added || isAdding}
      className="w-fit gap-1.5"
      onClick={() =>
        startAdd(async () => {
          await onAdd();
          setAdded(true);
        })
      }
    >
      {added && <Check className="size-4" />}
      {added ? common("added") : common("add")}
    </Button>
  ) : null;

  const ratingLine = averageRating && (
    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
      <Star className="size-3 fill-brass text-brass" />
      {averageRating.toFixed(1)}
      {ratingsCount && ` (${ratingsCount.toLocaleString(numberLocale)})`}
    </p>
  );

  return (
    <BookCardShell compact={compact}>
      <Dialog>
        <DialogTrigger
          render={
            <button
              type="button"
              className={compact ? undefined : "shrink-0"}
            />
          }
        >
          <BookCover
            title={title}
            author={author ?? undefined}
            size={compact ? "compact" : "md"}
          />
        </DialogTrigger>
        {compact ? (
          addButton && (
            <div className="flex w-full justify-center border-t border-border/40 pt-2">
              {addButton}
            </div>
          )
        ) : (
          <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
            <DialogTrigger
              render={
                <button
                  type="button"
                  className="group/link min-w-0 text-left"
                />
              }
            >
              <p className="truncate font-serif text-base font-medium leading-snug text-foreground transition-colors group-hover/link:text-primary">
                {title}
              </p>
              <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
                {author || unknownAuthor}
                {yearOrDetail && ` · ${yearOrDetail}`}
              </p>
              {ratingLine}
            </DialogTrigger>
            {addButton && (
              <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/40 pt-2.5">
                {addButton}
              </div>
            )}
          </div>
        )}
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-normal">
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-5">
            <BookCover
              title={title}
              author={author ?? undefined}
              size="lg"
              className="shrink-0"
            />
            <div className="flex min-w-0 flex-col gap-2 py-1">
              <p className="text-sm font-sans font-medium text-foreground">
                {author || unknownAuthor}
              </p>
              {yearOrDetail && (
                <p className="font-mono text-xs text-muted-foreground">
                  {t("year")}: {yearOrDetail}
                </p>
              )}
              {ratingLine}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase font-semibold">
              {t("descriptionExcerpt")}
            </span>
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 font-serif text-sm leading-relaxed text-foreground/90 max-h-[220px] overflow-y-auto pr-3">
              {description || t("noSuggestedDescription")}
            </div>
          </div>

          <div className="mt-2 border-t border-border/40 pt-3 flex justify-end">
            {addButton}
          </div>
        </DialogContent>
      </Dialog>
    </BookCardShell>
  );
}
