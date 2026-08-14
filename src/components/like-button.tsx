"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState, useTransition } from "react";
import { updateUserBook } from "@/lib/actions/books";
import { cn } from "@/lib/utils";

export function LikeButton({
  userBookId,
  liked,
}: {
  userBookId: string;
  liked: boolean | null;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 transition-opacity hover:opacity-70"
        aria-label={
          liked === true
            ? "Ti piace, tocca per modificare"
            : liked === false
              ? "Non ti piace, tocca per modificare"
              : "Aggiungi un giudizio"
        }
      >
        {liked === true && (
          <ThumbsUp className="size-3.5 fill-brass text-brass" />
        )}
        {liked === false && (
          <ThumbsDown className="size-3.5 fill-muted-foreground/40 text-muted-foreground/70" />
        )}
        {liked === null && (
          <span className="font-mono text-[9px] tracking-widest text-muted-foreground/70 uppercase">
            Giudizio
          </span>
        )}
      </button>
    );
  }

  function commit(value: boolean) {
    startTransition(async () => {
      await updateUserBook(userBookId, {
        liked: liked === value ? null : value,
      });
      setEditing(false);
    });
  }

  return (
    <fieldset
      aria-label="Modifica giudizio"
      className="m-0 flex items-center gap-1 border-0 p-0"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setEditing(false);
        }
      }}
    >
      <button
        type="button"
        disabled={pending}
        aria-label="Mi piace"
        onClick={() => commit(true)}
      >
        <ThumbsUp
          className={cn(
            "size-5",
            liked === true
              ? "fill-brass text-brass"
              : "text-muted-foreground hover:text-foreground",
          )}
        />
      </button>
      <button
        type="button"
        disabled={pending}
        aria-label="Non mi piace"
        onClick={() => commit(false)}
      >
        <ThumbsDown
          className={cn(
            "size-5",
            liked === false
              ? "fill-muted-foreground text-muted-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        />
      </button>
    </fieldset>
  );
}
