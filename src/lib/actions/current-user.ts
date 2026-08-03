import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export async function requireUserWithUsername(
  supabase: SupabaseClient<Database>,
): Promise<{ id: string; username: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Profile not found");

  return { id: user.id, username: profile.username };
}
