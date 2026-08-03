"use client";

import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type BookieImportResult,
  importBookieBatch,
} from "@/lib/actions/bookie-import";
import {
  type BookieImportBook,
  groupBookieRows,
  parseCsv,
} from "@/lib/bookie-import";
import { STATUS_LABELS } from "@/lib/reading-status";

const BATCH_SIZE = 15;

type Step =
  | { kind: "idle" }
  | { kind: "preview"; books: BookieImportBook[] }
  | {
      kind: "importing";
      total: number;
      done: number;
      results: BookieImportResult[];
    }
  | { kind: "done"; results: BookieImportResult[] };

export function BookieImportForm() {
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      const content = await file.text();
      const rows = parseCsv(content);
      const books = groupBookieRows(rows);
      if (books.length === 0) {
        setError(
          "Nessun libro trovato in questo file: controlla che sia un export CSV di Bookie.",
        );
        return;
      }
      setStep({ kind: "preview", books });
    } catch {
      setError("Impossibile leggere il file. Controlla che sia un CSV valido.");
    }
  }

  async function runImport(books: BookieImportBook[]) {
    setStep({ kind: "importing", total: books.length, done: 0, results: [] });

    const allResults: BookieImportResult[] = [];
    for (let i = 0; i < books.length; i += BATCH_SIZE) {
      const batch = books.slice(i, i + BATCH_SIZE);
      const batchResults = await importBookieBatch(batch);
      allResults.push(...batchResults);
      setStep({
        kind: "importing",
        total: books.length,
        done: allResults.length,
        results: allResults,
      });
    }

    setStep({ kind: "done", results: allResults });
  }

  if (step.kind === "idle" || step.kind === "preview") {
    const counts =
      step.kind === "preview"
        ? {
            reading: step.books.filter((b) => b.status === "reading").length,
            read: step.books.filter((b) => b.status === "read").length,
            to_read: step.books.filter((b) => b.status === "to_read").length,
            wishlist: step.books.filter((b) => b.status === "wishlist").length,
          }
        : null;

    return (
      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border/80 bg-card/40 px-6 py-10 text-center transition-colors hover:bg-card/70">
          <Upload className="size-6 text-muted-foreground" />
          <span className="text-sm font-medium">
            {step.kind === "preview"
              ? "Scegli un altro file"
              : "Scegli il file CSV esportato da Bookie"}
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertTriangle className="size-4" />
            {error}
          </p>
        )}

        {step.kind === "preview" && counts && (
          <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/60 p-4">
            <p className="text-sm">
              <span className="font-medium">{step.books.length}</span> libri
              unici trovati nel file.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>
                {STATUS_LABELS.reading}: {counts.reading}
              </span>
              <span>·</span>
              <span>
                {STATUS_LABELS.read}: {counts.read}
              </span>
              <span>·</span>
              <span>
                {STATUS_LABELS.to_read}: {counts.to_read}
              </span>
              <span>·</span>
              <span>
                {STATUS_LABELS.wishlist}: {counts.wishlist}
              </span>
            </div>
            <Button
              type="button"
              className="w-fit"
              onClick={() => runImport(step.books)}
            >
              Importa {step.books.length} libri
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (step.kind === "importing") {
    const percent = Math.round((step.done / step.total) * 100);
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/60 p-4">
        <p className="text-sm">
          Importazione in corso… {step.done}/{step.total}
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  }

  const imported = step.results.filter((r) => r.outcome === "imported").length;
  const alreadyPresent = step.results.filter(
    (r) => r.outcome === "already_present",
  ).length;
  const failed = step.results.filter((r) => r.outcome === "failed");

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/60 p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <CheckCircle2 className="size-4 text-primary" />
        Importazione completata
      </p>
      <p className="text-sm text-muted-foreground">
        {imported} importati, {alreadyPresent} già presenti in libreria
        {failed.length > 0 && `, ${failed.length} falliti`}.
      </p>
      {failed.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-destructive">
          {failed.map((r) => (
            <li key={r.isbn}>
              {r.title}: {r.message}
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => setStep({ kind: "idle" })}
      >
        Importa un altro file
      </Button>
    </div>
  );
}
