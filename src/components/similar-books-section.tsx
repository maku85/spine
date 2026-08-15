"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { SuggestionCard } from "@/components/suggestion-card";
import { Button } from "@/components/ui/button";
import { addBookToCatalog } from "@/lib/actions/books";
import {
  getSimilarBooks,
  type SimilarBookSuggestion,
} from "@/lib/actions/similar-books";

export function SimilarBooksSection({ title }: { title: string }) {
  const [results, setResults] = useState<SimilarBookSuggestion[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("BookDetail.similarBooks");

  if (results === null) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-fit gap-1.5"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setResults(await getSimilarBooks(title));
          })
        }
      >
        <Sparkles className="size-4" />
        {isPending ? t("loading") : t("cta")}
      </Button>
    );
  }

  if (results.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        {t("heading")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {results.map(({ result, averageRating, ratingsCount }) => (
          <SuggestionCard
            key={result.workKey}
            title={result.title}
            author={result.authors[0] ?? null}
            yearOrDetail={result.firstPublishYear}
            averageRating={averageRating}
            ratingsCount={ratingsCount}
            isAuthenticated
            onAdd={() => addBookToCatalog(result)}
          />
        ))}
      </div>
    </div>
  );
}
