import type { ReadingStatus } from "@/lib/supabase/database.types";

export const STATUS_ORDER: ReadingStatus[] = [
  "wishlist",
  "to_read",
  "reading",
  "read",
];
