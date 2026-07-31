"use client";

import { Trash2 } from "lucide-react";
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
        Rimuovi dalla libreria
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rimuovere «{title}»?</DialogTitle>
          <DialogDescription>
            Il libro verrà tolto dal tuo catalogo insieme allo stato di lettura
            e alla valutazione. Non si può annullare.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Annulla
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => startTransition(() => removeUserBook(userBookId))}
          >
            {pending ? "Rimozione…" : "Rimuovi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
