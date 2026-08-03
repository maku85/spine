"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FollowStatus = { isFollowing: boolean } | null;

export async function getFollowStatus(
  profileUserId: string,
): Promise<FollowStatus> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id === profileUserId) return null;

  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("followed_id", profileUserId)
    .maybeSingle();

  return { isFollowing: Boolean(data) };
}

export async function followUser(
  profileUserId: string,
  profileUsername: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, followed_id: profileUserId });

  if (error && error.code !== "23505") throw error;
  revalidatePath(`/u/${profileUsername}`);
}

export async function unfollowUser(
  profileUserId: string,
  profileUsername: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("followed_id", profileUserId);

  if (error) throw error;
  revalidatePath(`/u/${profileUsername}`);
}
