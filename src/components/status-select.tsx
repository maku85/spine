"use client";

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
import { STATUS_LABELS } from "@/lib/reading-status";
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

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="transition-opacity hover:opacity-70"
        aria-label="Modifica stato di lettura"
      >
        <Badge
          variant="outline"
          className="w-fit font-mono text-[9px] tracking-widest uppercase bg-secondary/40 border-border/60"
        >
          {STATUS_LABELS[status]}
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
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
