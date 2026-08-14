"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { removeUserBook } from "@/lib/actions/books";

export function RemoveBookButton({
  userBookId,
  title,
}: {
  userBookId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  const t = useTranslations("Library.removeButton");
  const common = useTranslations("Common.actions");

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="gap-1.5 text-destructive hover:text-destructive"
          />
        }
      >
        <Trash2 className="size-4" />
        {t("trigger")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { title })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {common("cancel")}
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => startTransition(() => removeUserBook(userBookId))}
          >
            {pending ? common("removing") : common("remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
