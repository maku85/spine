import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Cookie-free client for pages that only ever read publicly-visible data
// (RLS `using (true)`) regardless of who's asking. Unlike
// `@/lib/supabase/server`, this never calls `cookies()`, so pages using it
// stay eligible for static rendering/ISR instead of being forced dynamic
// on every request.
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createSupabaseClient<Database>(url, anonKey);
}
