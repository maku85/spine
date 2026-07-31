"use client";

import { Star } from "lucide-react";
import { useTransition } from "react";
import { updateUserBook } from "@/lib/actions/books";
import { cn } from "@/lib/utils";

export function RatingInput({
  userBookId,
  rating,
}: {
  userBookId: string;
  rating: number | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          disabled={pending}
          aria-label={`Valuta ${value} su 5`}
          onClick={() =>
            startTransition(() =>
              updateUserBook(userBookId, {
                rating: rating === value ? null : value,
              }),
            )
          }
        >
          <Star
            className={cn(
              "size-5",
              rating && value <= rating
                ? "fill-brass text-brass"
                : "text-muted-foreground",
            )}
          />
        </button>
      ))}
    </div>
  );
}
