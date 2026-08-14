import { BookSearch } from "@/components/book-search";

export default function ExplorePage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-2xl">Esplora</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Sfoglia e ordina il catalogo, oppure cerca per titolo, autore o ISBN —
        anche inquadrando il codice a barre — per aggiungere un libro alla tua
        libreria.
      </p>
      <BookSearch />
    </div>
  );
}
