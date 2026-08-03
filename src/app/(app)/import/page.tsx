import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BookieImportForm } from "@/components/bookie-import-form";

export const maxDuration = 60;

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Torna alle impostazioni
      </Link>
      <h1 className="font-serif text-2xl">Importa da Bookie</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Carica il file CSV esportato da Bookie: ogni libro verrà aggiunto alla
        tua libreria con lo stato di lettura corrispondente (i libri
        contrassegnati come preferiti ricevono una valutazione a 5 stelle). I
        libri già presenti in libreria vengono saltati.
      </p>
      <BookieImportForm />
    </div>
  );
}
