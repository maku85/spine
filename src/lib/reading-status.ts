import type { ReadingStatus } from "@/lib/supabase/database.types";

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  wishlist: "Lista desideri",
  to_read: "Da leggere",
  reading: "In lettura",
  read: "Letto",
};

export const STATUS_ORDER: ReadingStatus[] = [
  "wishlist",
  "to_read",
  "reading",
  "read",
];
