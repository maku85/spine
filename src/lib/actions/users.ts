"use server";

import { createClient } from "@/lib/supabase/server";

export type ProfileSearchResult = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export async function searchProfiles(
  query: string,
): Promise<ProfileSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pattern = `%${trimmed}%`;
  const select = "id, username, display_name, avatar_url";

  const [byUsername, byDisplayName] = await Promise.all([
    supabase
      .from("profiles")
      .select(select)
      .ilike("username", pattern)
      .limit(30),
    supabase
      .from("profiles")
      .select(select)
      .ilike("display_name", pattern)
      .limit(30),
  ]);

  const merged = new Map<string, ProfileSearchResult>();
  for (const row of [
    ...(byUsername.data ?? []),
    ...(byDisplayName.data ?? []),
  ]) {
    if (user && row.id === user.id) continue;
    merged.set(row.id, {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
    });
  }

  return [...merged.values()].slice(0, 30);
}
