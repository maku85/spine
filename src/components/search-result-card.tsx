"use client";

import { Check, Star, TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { BookCover } from "@/components/book-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fetchWorkDetails, type WorkDetails } from "@/lib/open-library/search";
import type { SearchItem } from "@/lib/search-books";

export function SearchResultCard({
  item,
  added,
  isAdding,
  onAdd,
}: {
  item: SearchItem;
  added: boolean;
  isAdding: boolean;
  onAdd: () => void;
}) {
  // Mongo results already carry description/categories (they came from our
  // own bulk import); Open Library results only give us those on demand, so
  // fetch them the first time the detail dialog opens for one.
  const [details, setDetails] = useState<WorkDetails | null>(
    item.source === "mongo"
      ? { description: item.book.description, subjects: item.book.categories }
      : null,
  );
  const [isLoadingDetails, startLoadDetails] = useTransition();

  const common = useTranslations("Common.actions");
  const t = useTranslations("Cards");
  const tLibrary = useTranslations("Library");
  const unknownAuthor = tLibrary("unknownAuthor");
  const locale = useLocale();
  const numberLocale = locale === "en" ? "en-US" : "it-IT";

  const nytInfo =
    item.source === "mongo" && item.book.nytRank ? item.book : null;
  const rating = item.source === "mongo" && item.book.rating ? item.book : null;
  const moodTags = item.source === "mongo" ? item.book.moodTags : [];
  const series = item.source === "mongo" ? item.book.series : [];
  const primarySeries = series[0] ?? null;

  function handleOpenChange(open: boolean) {
    if (open && item.source === "openlibrary" && !details) {
      const workKey = item.book.workKey;
      startLoadDetails(async () => {
        setDetails(await fetchWorkDetails(workKey));
      });
    }
  }

  const addButton = (
    <Button
      size="sm"
      variant={added ? "secondary" : "default"}
      disabled={added || isAdding}
      className="gap-1.5"
      onClick={onAdd}
    >
      {added && <Check className="size-4" />}
      {added ? common("added") : common("add")}
    </Button>
  );

  return (
    <Card className="tactile-card group/card relative overflow-hidden border border-border/80 bg-card/95 py-0 transition-all duration-300 hover:border-brass/50 hover:shadow-lg">
      <CardContent className="flex items-center gap-4 p-3">
        <Dialog onOpenChange={handleOpenChange}>
          <DialogTrigger
            render={
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-4 text-left"
              />
            }
          >
            <BookCover title={item.title} author={item.authors[0]} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.title}</p>
              <p className="truncate text-sm text-muted-foreground">
                {item.authors.join(", ") || unknownAuthor}
                {item.year && ` · ${item.year}`}
                {primarySeries &&
                  ` · ${primarySeries.name}${primarySeries.position ? ` #${primarySeries.position}` : ""}`}
              </p>
              {(nytInfo || rating) && (
                <p className="mt-1 flex items-center gap-2 text-xs font-medium text-brass">
                  {nytInfo && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="size-3" />
                      NYT #{nytInfo.nytRank}
                    </span>
                  )}
                  {rating && (
                    <span className="flex items-center gap-1">
                      <Star className="size-3 fill-brass text-brass" />
                      {rating.rating?.toFixed(1)}
                      {rating.ratingsCount &&
                        ` (${rating.ratingsCount.toLocaleString(numberLocale)})`}
                    </span>
                  )}
                </p>
              )}
              {moodTags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {moodTags.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="bg-secondary/40 font-mono text-[9px] tracking-widest text-muted-foreground uppercase border-border/60"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl font-normal">
                {item.title}
              </DialogTitle>
            </DialogHeader>

            <div className="flex gap-5">
              <BookCover
                title={item.title}
                author={item.authors[0]}
                size="lg"
                className="shrink-0"
              />
              <div className="flex min-w-0 flex-col gap-2 py-1">
                <p className="text-sm font-sans font-medium text-foreground">
                  {item.authors.join(", ") || unknownAuthor}
                </p>
                {item.year && (
                  <p className="font-mono text-xs text-muted-foreground">
                    {t("year")}: {item.year}
                  </p>
                )}
                {series.length > 0 && (
                  <p className="font-mono text-xs text-muted-foreground truncate">
                    {t("series")}:{" "}
                    {series
                      .map(
                        (s) =>
                          `${s.name}${s.position ? ` #${s.position}` : ""}`,
                      )
                      .join(", ")}
                  </p>
                )}
                {nytInfo && (
                  <Badge
                    variant="outline"
                    className="w-fit gap-1 border-brass/40 bg-brass/10 font-mono text-[10px] tracking-wide text-brass uppercase"
                  >
                    <TrendingUp className="size-3" />
                    NYT {nytInfo.nytListName} #{nytInfo.nytRank}
                    {nytInfo.nytWeeksOnList
                      ? ` · ${nytInfo.nytWeeksOnList} ${t("weeksOnList")}`
                      : ""}
                  </Badge>
                )}
                {rating && (
                  <p className="flex items-center gap-1 text-xs font-medium text-brass">
                    <Star className="size-3.5 fill-brass text-brass" />
                    {rating.rating?.toFixed(1)}
                    {rating.ratingsCount &&
                      ` (${rating.ratingsCount.toLocaleString(numberLocale)} ${t("votes")})`}
                  </p>
                )}
                {details && details.subjects.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {details.subjects.slice(0, 5).map((subject) => (
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
                {moodTags.length > 0 && (
                  <div className="mt-1 flex flex-col gap-1.5">
                    <span className="font-mono text-[9px] tracking-widest text-muted-foreground/70 uppercase">
                      {t("mood")}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {moodTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="bg-primary/5 font-mono text-[9px] tracking-widest text-primary/80 uppercase border-primary/20"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase font-semibold">
                {t("volumeDescription")}
              </span>
              {isLoadingDetails ? (
                <div className="rounded-xl border border-border/50 bg-secondary/30 p-4 text-xs font-mono text-muted-foreground">
                  {t("loadingDetails")}
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 font-serif text-sm leading-relaxed text-foreground/90 max-h-[200px] overflow-y-auto pr-3">
                  {details?.description || t("noDescription")}
                </div>
              )}
            </div>

            <div className="mt-2 border-t border-border/40 pt-3 flex justify-end">
              {addButton}
            </div>
          </DialogContent>
        </Dialog>
        {addButton}
      </CardContent>
    </Card>
  );
}
