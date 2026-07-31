export type SortKey =
  | "added_desc"
  | "title_asc"
  | "title_desc"
  | "author_asc"
  | "author_desc";

export const SORT_LABELS: Record<SortKey, string> = {
  added_desc: "Aggiunti di recente",
  title_asc: "Titolo (A→Z)",
  title_desc: "Titolo (Z→A)",
  author_asc: "Autore (A→Z)",
  author_desc: "Autore (Z→A)",
};

export function primaryAuthor(authors: string[]) {
  return authors[0] ?? "";
}

export type Section<T> = { header: string | null; books: T[] };

// Groups the already-sorted list into phone-book-style blocks: a single
// letter when sorted by title, the author's name when sorted by author.
// Single pass since the list is pre-sorted, so same-key books are adjacent.
export function groupIntoSections<
  T extends { title: string; authors: string[] },
>(sortedBooks: T[], sort: SortKey): Section<T>[] {
  if (
    sort !== "title_asc" &&
    sort !== "title_desc" &&
    sort !== "author_asc" &&
    sort !== "author_desc"
  ) {
    return [{ header: null, books: sortedBooks }];
  }

  const isTitleSort = sort === "title_asc" || sort === "title_desc";
  const keyFor = (book: T) =>
    isTitleSort
      ? book.title.trim().charAt(0).toUpperCase() || "#"
      : primaryAuthor(book.authors) || "Autore sconosciuto";

  const sections: Section<T>[] = [];
  for (const book of sortedBooks) {
    const key = keyFor(book);
    const current = sections.at(-1);
    if (current?.header === key) {
      current.books.push(book);
    } else {
      sections.push({ header: key, books: [book] });
    }
  }
  return sections;
}
