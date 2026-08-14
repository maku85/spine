"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("Library.likeButton");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 transition-opacity hover:opacity-70"
        aria-label={
          liked === true
            ? t("likedAriaLabel")
            : liked === false
              ? t("dislikedAriaLabel")
              : t("addJudgmentAriaLabel")
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
            {t("unratedLabel")}
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
      aria-label={t("editAriaLabel")}
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
        aria-label={t("likeAriaLabel")}
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
        aria-label={t("dislikeAriaLabel")}
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
