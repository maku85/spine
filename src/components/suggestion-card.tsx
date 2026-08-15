"use client";

import { Check, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { BookCover } from "@/components/book-cover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
}: {
  title: string;
  author: string | null;
  yearOrDetail?: string | number | null;
  description?: string | null;
  averageRating: number | null;
  ratingsCount: number | null;
  isAuthenticated: boolean;
  onAdd: () => Promise<void>;
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
      className="mt-auto w-fit gap-1.5"
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
    <Card className="tactile-card group/card relative overflow-hidden border border-border/80 bg-card/95 py-0 transition-all duration-300 hover:border-brass/50 hover:shadow-lg">
      <div className="absolute top-0 right-3 h-2.5 w-2 bg-brass/70 rounded-b-xs opacity-70 group-hover/card:h-3.5 group-hover/card:opacity-100 transition-all" />
      <CardContent className="flex gap-4 p-4">
        <Dialog>
          <DialogTrigger render={<button type="button" className="shrink-0" />}>
            <BookCover title={title} author={author ?? undefined} size="md" />
          </DialogTrigger>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <DialogTrigger
              render={<button type="button" className="min-w-0 text-left" />}
            >
              <p className="truncate font-serif text-base">{title}</p>
              <p className="truncate text-sm text-muted-foreground">
                {author || unknownAuthor}
                {yearOrDetail && ` · ${yearOrDetail}`}
              </p>
              {ratingLine}
            </DialogTrigger>
            {addButton}
          </div>
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
      </CardContent>
    </Card>
  );
}
