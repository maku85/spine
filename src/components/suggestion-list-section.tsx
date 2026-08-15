"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SuggestionCard } from "@/components/suggestion-card";
import { Button } from "@/components/ui/button";
import { addMongoBookToCatalog } from "@/lib/actions/books";
import type { SuggestedBook } from "@/lib/suggestions/read";

const DEFAULT_VISIBLE = 6;

type SectionItem = {
  book: SuggestedBook;
  detail: string | number | null;
};

export function SuggestionListSection({
  label,
  items,
  defaultVisible = DEFAULT_VISIBLE,
  isAuthenticated,
}: {
  label: string;
  items: SectionItem[];
  defaultVisible?: number;
  isAuthenticated: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("Suggestions");

  const visibleItems = expanded ? items : items.slice(0, defaultVisible);
  const hiddenCount = items.length - defaultVisible;

  return (
    <div>
      <h2 className="mb-4 font-mono text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map(({ book, detail }) => (
          <SuggestionCard
            key={book.mongoId}
            title={book.title}
            author={book.authors.join(", ") || null}
            yearOrDetail={detail}
            description={book.description}
            averageRating={book.rating}
            ratingsCount={book.ratingsCount}
            isAuthenticated={isAuthenticated}
            onAdd={addMongoBookToCatalog.bind(null, book)}
          />
        ))}
      </div>
      {hiddenCount > 0 && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? (
              <>
                <ChevronUp className="size-3.5" />
                {t("showLess")}
              </>
            ) : (
              <>
                <ChevronDown className="size-3.5" />
                {t("showMore", { count: hiddenCount })}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
