"use client";

import { Check, ListPlus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  addBookToList,
  createList,
  removeBookFromList,
} from "@/lib/actions/lists";
import { cn } from "@/lib/utils";

export function AddToListDialog({
  userBookId,
  lists,
  memberListIds,
}: {
  userBookId: string;
  lists: { id: string; name: string }[];
  memberListIds: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [members, setMembers] = useState(new Set(memberListIds));
  const [newListName, setNewListName] = useState("");
  const t = useTranslations("BookDetail.addToList");

  function toggle(listId: string) {
    const wasMember = members.has(listId);
    setMembers((prev) => {
      const next = new Set(prev);
      if (wasMember) next.delete(listId);
      else next.add(listId);
      return next;
    });
    startTransition(async () => {
      if (wasMember) await removeBookFromList(listId, userBookId);
      else await addBookToList(listId, userBookId);
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" className="gap-1.5" />}>
        <ListPlus className="size-4" />
        {t("trigger")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {lists.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          )}
          {lists.map((list) => {
            const isMember = members.has(list.id);
            return (
              <button
                key={list.id}
                type="button"
                disabled={isPending}
                onClick={() => toggle(list.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border p-2.5 text-left text-sm transition-colors",
                  isMember
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/60 hover:bg-secondary/40",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                    isMember
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {isMember && <Check className="size-3" />}
                </span>
                {list.name}
              </button>
            );
          })}
        </div>

        <form
          className="flex gap-2 border-t border-border/50 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = newListName.trim();
            if (!trimmed) return;
            startTransition(async () => {
              await createList(trimmed);
              setNewListName("");
              router.refresh();
            });
          }}
        >
          <Input
            placeholder={t("newListPlaceholder")}
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={isPending || !newListName.trim()}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            {t("create")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
