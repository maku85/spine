"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, {
      error: "Usa 3-20 caratteri: lettere minuscole, numeri, underscore.",
    }),
  displayName: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((value) => value || null),
  avatarUrl: z
    .union([z.url({ error: "Inserisci un URL valido." }), z.literal("")])
    .optional()
    .transform((value) => value || null),
  language: z.enum(["it", "all"]),
});

export type ProfileFormState = { error: string } | undefined;

export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const validated = ProfileSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    avatarUrl: formData.get("avatarUrl"),
    language: formData.get("language"),
  });

  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  const { username, displayName, avatarUrl, language } = validated.data;

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      display_name: displayName,
      avatar_url: avatarUrl,
      language,
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Questo username è già in uso." };
    }
    throw error;
  }

  revalidatePath("/settings");
  revalidatePath(`/u/${username}`);
  return undefined;
}
