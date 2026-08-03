"use server";

import { revalidatePath } from "next/cache";
import { requireUserWithUsername } from "@/lib/actions/current-user";
import { createClient } from "@/lib/supabase/server";

function revalidateListPages(username: string) {
  revalidatePath("/lists");
  revalidatePath(`/u/${username}`);
}

export async function createList(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Il nome della lista non può essere vuoto.");

  const supabase = await createClient();
  const { id: userId, username } = await requireUserWithUsername(supabase);

  const { error } = await supabase
    .from("lists")
    .insert({ user_id: userId, name: trimmed });
  if (error) throw error;

  revalidateListPages(username);
}

export async function renameList(listId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Il nome della lista non può essere vuoto.");

  const supabase = await createClient();
  const { username } = await requireUserWithUsername(supabase);

  const { error } = await supabase
    .from("lists")
    .update({ name: trimmed })
    .eq("id", listId);
  if (error) throw error;

  revalidateListPages(username);
}

export async function deleteList(listId: string) {
  const supabase = await createClient();
  const { username } = await requireUserWithUsername(supabase);

  const { error } = await supabase.from("lists").delete().eq("id", listId);
  if (error) throw error;

  revalidateListPages(username);
}

export async function addBookToList(listId: string, userBookId: string) {
  const supabase = await createClient();
  const { username } = await requireUserWithUsername(supabase);

  const { error } = await supabase
    .from("list_books")
    .insert({ list_id: listId, user_book_id: userBookId });
  if (error && error.code !== "23505") throw error;

  revalidateListPages(username);
  revalidatePath(`/books/${userBookId}`);
}

export async function removeBookFromList(listId: string, userBookId: string) {
  const supabase = await createClient();
  const { username } = await requireUserWithUsername(supabase);

  const { error } = await supabase
    .from("list_books")
    .delete()
    .eq("list_id", listId)
    .eq("user_book_id", userBookId);
  if (error) throw error;

  revalidateListPages(username);
  revalidatePath(`/books/${userBookId}`);
}
