import type { ReadingStatus } from "./supabase/database.types.ts";
import { normalizeIsbn } from "./text.ts";

const LIST_NAME_TO_STATUS: Partial<Record<string, ReadingStatus>> = {
  currently_reading: "reading",
  finished: "read",
  want_to_read: "to_read",
  wishlist: "wishlist",
};

const STATUS_PRIORITY: ReadingStatus[] = [
  "reading",
  "read",
  "to_read",
  "wishlist",
];

export type BookieImportBook = {
  isbn: string;
  title: string;
  authors: string[];
  status: ReadingStatus;
  rating: number | null;
};

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

export function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r\n|\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const fields = parseCsvLine(line);
    return Object.fromEntries(
      header.map((key, i) => [key, (fields[i] ?? "").trim()]),
    );
  });
}

export function groupBookieRows(
  rows: Record<string, string>[],
): BookieImportBook[] {
  type Group = {
    isbn: string;
    title: string;
    authors: string[];
    listNames: Set<string>;
  };
  const groups = new Map<string, Group>();

  for (const row of rows) {
    const isbn = normalizeIsbn(row.isbn) ?? row.isbn;
    if (!isbn) continue;

    let group = groups.get(isbn);
    if (!group) {
      group = {
        isbn,
        title: row.title,
        authors: row.contributors
          ? row.contributors
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
          : [],
        listNames: new Set(),
      };
      groups.set(isbn, group);
    }
    group.listNames.add(row.list_name);
  }

  return [...groups.values()].map((group) => {
    const candidates = [...group.listNames]
      .map((name) => LIST_NAME_TO_STATUS[name])
      .filter((status): status is ReadingStatus => status !== undefined);

    const status =
      STATUS_PRIORITY.find((candidate) => candidates.includes(candidate)) ??
      "to_read";
    const rating = group.listNames.has("favorite") ? 5 : null;

    return {
      isbn: group.isbn,
      title: group.title,
      authors: group.authors,
      status,
      rating,
    };
  });
}
