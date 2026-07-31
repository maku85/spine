import { BookSearch } from "@/components/book-search";

export default function AddBookPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-2xl">Aggiungi un libro</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Cerca per titolo, autore o ISBN, oppure inquadra il codice a barre:
        recuperiamo i dettagli da Open Library.
      </p>
      <BookSearch />
    </div>
  );
}
