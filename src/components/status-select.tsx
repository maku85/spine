"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserBook } from "@/lib/actions/books";
import { STATUS_ORDER } from "@/lib/reading-status";
import type { ReadingStatus } from "@/lib/supabase/database.types";

export function StatusSelect({
  userBookId,
  status,
}: {
  userBookId: string;
  status: ReadingStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const t = useTranslations("ReadingStatus");
  const tLibrary = useTranslations("Library");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="transition-opacity hover:opacity-70"
        aria-label={tLibrary("status.editAriaLabel")}
      >
        <Badge
          variant="outline"
          className="w-fit font-mono text-[9px] tracking-widest uppercase bg-secondary/40 border-border/60"
        >
          {t(status)}
        </Badge>
      </button>
    );
  }

  return (
    <Select
      disabled={pending}
      value={status}
      open={editing}
      onOpenChange={(open) => setEditing(open)}
      onValueChange={(value) =>
        startTransition(() =>
          updateUserBook(userBookId, { status: value as ReadingStatus }),
        )
      }
    >
      <SelectTrigger className="w-40" size="sm">
        <SelectValue>{(value) => t(value as ReadingStatus)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUS_ORDER.map((value) => (
          <SelectItem key={value} value={value}>
            {t(value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
