export type NytListDefinition = { listName: string; label: string };

export const DEFAULT_NYT_LISTS: NytListDefinition[] = [
  { listName: "combined-print-and-e-book-fiction", label: "Narrativa" },
  { listName: "young-adult-hardcover", label: "Young Adult" },
  { listName: "trade-fiction-paperback", label: "Narrativa (tascabile)" },
];
