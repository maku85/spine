"use client";

import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("Settings.import");
  const tStatus = useTranslations("ReadingStatus");

  async function handleFile(file: File) {
    setError(null);
    try {
      const content = await file.text();
      const rows = parseCsv(content);
      const books = groupBookieRows(rows);
      if (books.length === 0) {
        setError(t("noBooksFound"));
        return;
      }
      setStep({ kind: "preview", books });
    } catch {
      setError(t("cannotReadFile"));
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
            {step.kind === "preview" ? t("chooseAnotherFile") : t("chooseFile")}
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
              {t("booksFound", { count: step.books.length })}
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>
                {tStatus("reading")}: {counts.reading}
              </span>
              <span>·</span>
              <span>
                {tStatus("read")}: {counts.read}
              </span>
              <span>·</span>
              <span>
                {tStatus("to_read")}: {counts.to_read}
              </span>
              <span>·</span>
              <span>
                {tStatus("wishlist")}: {counts.wishlist}
              </span>
            </div>
            <Button
              type="button"
              className="w-fit"
              onClick={() => runImport(step.books)}
            >
              {t("importCount", { count: step.books.length })}
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
          {t("importing", { done: step.done, total: step.total })}
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
        {t("completed")}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("summary", {
          imported,
          alreadyPresent,
          failed: failed.length,
        })}
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
        {t("importAnother")}
      </Button>
    </div>
  );
}
