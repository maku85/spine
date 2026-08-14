import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";
import { groupBookieRows, parseCsv } from "../src/lib/bookie-import.ts";
import { curateGenres } from "../src/lib/genres.ts";

const REQUEST_DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]) {
  const args = {
    file: "",
    email: "",
    dryRun: false,
    limit: Number.POSITIVE_INFINITY,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--file=")) args.file = arg.slice("--file=".length);
    else if (arg.startsWith("--email="))
      args.email = arg.slice("--email=".length);
    else if (arg.startsWith("--limit="))
      args.limit = Number(arg.slice("--limit=".length));
  }
  return args;
}

type OpenLibraryMatch = {
  olWorkKey: string | null;
  olEditionKey: string | null;
  description: string | null;
  subjects: string[];
  firstPublishYear: number | null;
};

const EMPTY_MATCH: OpenLibraryMatch = {
  olWorkKey: null,
  olEditionKey: null,
  description: null,
  subjects: [],
  firstPublishYear: null,
};

async function resolveViaOpenLibrary(isbn: string): Promise<OpenLibraryMatch> {
  try {
    const searchRes = await fetch(
      `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&limit=1&fields=key,edition_key,first_publish_year`,
    );
    if (!searchRes.ok) return EMPTY_MATCH;

    const searchJson = (await searchRes.json()) as {
      docs?: {
        key?: string;
        edition_key?: string[];
        first_publish_year?: number;
      }[];
    };
    const doc = searchJson.docs?.[0];
    if (!doc?.key) return EMPTY_MATCH;

    const olWorkKey = doc.key.replace("/works/", "");
    const olEditionKey = doc.edition_key?.[0] ?? null;
    const firstPublishYear = doc.first_publish_year ?? null;

    const workRes = await fetch(
      `https://openlibrary.org/works/${olWorkKey}.json`,
    );
    if (!workRes.ok) {
      return {
        olWorkKey,
        olEditionKey,
        description: null,
        subjects: [],
        firstPublishYear,
      };
    }

    const workJson = (await workRes.json()) as {
      description?: string | { value?: string };
      subjects?: unknown;
    };
    const description =
      typeof workJson.description === "string"
        ? workJson.description
        : (workJson.description?.value ?? null);
    const subjects = curateGenres(workJson.subjects);

    return { olWorkKey, olEditionKey, description, subjects, firstPublishYear };
  } catch {
    // Rete irraggiungibile o risposta inattesa: il libro verrà comunque
    // importato usando solo i dati del CSV.
    return EMPTY_MATCH;
  }
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function promptPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    // biome-ignore lint/suspicious/noExplicitAny: readline non espone i tipi interni di stdout usati per il masking
    const output = process.stdout as any;
    const originalWrite = output.write.bind(output);
    let masking = false;

    output.write = (chunk: string, ...rest: unknown[]) => {
      if (masking) return true;
      return originalWrite(chunk, ...rest);
    };

    rl.question(question, (answer) => {
      output.write = originalWrite;
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });

    masking = true;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.file) {
    console.error(
      "Uso: --file=<export.csv> [--email=<email>] [--dry-run] [--limit=N]",
    );
    process.exit(1);
  }

  const content = readFileSync(args.file, "utf-8");
  const rows = parseCsv(content);
  const books = groupBookieRows(rows).slice(0, args.limit);

  const counts = { reading: 0, read: 0, to_read: 0, wishlist: 0 };
  for (const book of books) counts[book.status]++;
  const favorites = books.filter((b) => b.liked === true).length;

  console.log(
    `${rows.length} righe nel CSV, ${books.length} libri unici da importare:`,
  );
  console.log(
    `  In lettura: ${counts.reading}  Letti: ${counts.read}  Da leggere: ${counts.to_read}  Lista desideri: ${counts.wishlist}`,
  );
  console.log(`  di cui preferiti (mi piace): ${favorites}`);

  if (args.dryRun) {
    console.log("\n--dry-run: nessuna scrittura, nessun accesso effettuato.");
    for (const book of books) {
      console.log(
        `  [${book.status}${book.liked ? ", ♥" : ""}] ${book.title} — ${book.authors.join(", ") || "autore sconosciuto"} (${book.isbn})`,
      );
    }
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Mancano NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
    process.exit(1);
  }

  const email = args.email || (await prompt("Email Spine: ")).trim();
  const password = await promptPassword("Password Spine (non visibile): ");

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: auth, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });
  if (authError || !auth.user) {
    console.error(
      `Accesso fallito: ${authError?.message ?? "credenziali non valide"}`,
    );
    process.exit(1);
  }
  console.log(`Autenticato come ${auth.user.email}.\n`);

  let imported = 0;
  let alreadyPresent = 0;
  let failed = 0;

  for (const [index, book] of books.entries()) {
    const match = await resolveViaOpenLibrary(book.isbn);

    const { data: dbBook, error: bookErr } = await supabase.rpc(
      "upsert_book_from_ol",
      {
        p_ol_work_key: match.olWorkKey,
        p_ol_edition_key: match.olEditionKey,
        p_isbn: book.isbn,
        p_title: book.title,
        p_authors: book.authors,
        p_description: match.description,
        p_subjects: match.subjects,
        p_first_publish_year: match.firstPublishYear,
      },
    );

    if (bookErr || !dbBook) {
      console.error(
        `  ✗ ${book.title}: ${bookErr?.message ?? "upsert fallito"}`,
      );
      failed++;
      continue;
    }

    const { error: insertErr } = await supabase.from("user_books").insert({
      user_id: auth.user.id,
      book_id: dbBook.id,
      status: book.status,
      liked: book.liked,
    });

    if (insertErr) {
      if (insertErr.code === "23505") {
        alreadyPresent++;
        console.log(`  = ${book.title}: già in libreria, salto.`);
      } else {
        failed++;
        console.error(`  ✗ ${book.title}: ${insertErr.message}`);
      }
      continue;
    }

    imported++;
    const resolved = match.olWorkKey ? "" : " (non trovato su Open Library)";
    console.log(`  ✓ [${index + 1}/${books.length}] ${book.title}${resolved}`);

    await sleep(REQUEST_DELAY_MS);
  }

  console.log(
    `\nFatto: ${imported} importati, ${alreadyPresent} già presenti, ${failed} falliti.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
