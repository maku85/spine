"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { BookCover } from "@/components/book-cover";
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
import { Input } from "@/components/ui/input";
import {
  createList,
  deleteList,
  removeBookFromList,
  renameList,
} from "@/lib/actions/lists";

export type ListBookSummary = {
  userBookId: string;
  title: string;
  authors: string[];
};

export type ListSummary = {
  id: string;
  name: string;
  books: ListBookSummary[];
};

function ListCard({ list }: { list: ListSummary }) {
  const [isPending, startTransition] = useTransition();
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(list.name);

  function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === list.name) {
      setName(list.name);
      setIsRenaming(false);
      return;
    }
    startTransition(async () => {
      await renameList(list.id, trimmed);
      setIsRenaming(false);
    });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        {isRenaming ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
              value={name}
              autoFocus
              disabled={isPending}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setName(list.name);
                  setIsRenaming(false);
                }
              }}
              className="h-8"
            />
            <Button size="sm" disabled={isPending} onClick={saveName}>
              Salva
            </Button>
          </div>
        ) : (
          <>
            <h2 className="font-serif text-lg">{list.name}</h2>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Rinomina lista"
                onClick={() => setIsRenaming(true)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Dialog>
                <DialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Elimina lista"
                      className="text-destructive hover:text-destructive"
                    />
                  }
                >
                  <Trash2 className="size-3.5" />
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Eliminare «{list.name}»?</DialogTitle>
                    <DialogDescription>
                      I libri restano nel tuo catalogo, viene eliminata solo la
                      lista. Non si può annullare.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                      Annulla
                    </DialogClose>
                    <Button
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => startTransition(() => deleteList(list.id))}
                    >
                      Elimina
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </>
        )}
      </div>

      {list.books.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessun libro in questa lista. Aggiungili dalla pagina di dettaglio di
          un libro.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {list.books.map((book) => (
            <div key={book.userBookId} className="group relative w-[92px]">
              <BookCover
                title={book.title}
                author={book.authors[0]}
                size="md"
              />
              <button
                type="button"
                aria-label={`Rimuovi «${book.title}» dalla lista`}
                disabled={isPending}
                onClick={() =>
                  startTransition(() =>
                    removeBookFromList(list.id, book.userBookId),
                  )
                }
                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-xs transition-opacity group-hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ListManager({ lists }: { lists: ListSummary[] }) {
  const [isPending, startTransition] = useTransition();
  const [newListName, setNewListName] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = newListName.trim();
          if (!trimmed) return;
          startTransition(async () => {
            await createList(trimmed);
            setNewListName("");
          });
        }}
      >
        <Input
          placeholder="Nome nuova lista…"
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
        />
        <Button
          type="submit"
          disabled={isPending || !newListName.trim()}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          Crea
        </Button>
      </form>

      {lists.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Non hai ancora creato nessuna lista.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      )}
    </div>
  );
}
