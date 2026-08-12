export type NytListDefinition = { listName: string; label: string };

export const DEFAULT_NYT_LISTS: NytListDefinition[] = [
  { listName: "combined-print-and-e-book-fiction", label: "Narrativa" },
  { listName: "hardcover-nonfiction", label: "Saggistica" },
  { listName: "young-adult-hardcover", label: "Young Adult" },
  { listName: "business-books", label: "Economia" },
  { listName: "trade-fiction-paperback", label: "Narrativa (tascabile)" },
];
