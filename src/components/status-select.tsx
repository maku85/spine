"use client";

import { useTransition } from "react";
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

  return (
    <Select
      disabled={pending}
      value={status}
      onValueChange={(value) =>
        startTransition(() =>
          updateUserBook(userBookId, { status: value as ReadingStatus }),
        )
      }
    >
      <SelectTrigger className="w-40">
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
