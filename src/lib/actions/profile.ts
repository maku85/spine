"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

function buildSchema(t: Awaited<ReturnType<typeof getTranslations>>) {
  return z.object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_]{3,20}$/, { error: t("usernameFormat") }),
    displayName: z
      .string()
      .trim()
      .max(60)
      .optional()
      .transform((value) => value || null),
    avatarUrl: z
      .union([z.url({ error: t("avatarUrl") }), z.literal("")])
      .optional()
      .transform((value) => value || null),
    language: z.enum(["it", "en"]),
  });
}

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

  const rawLanguage = formData.get("language");
  const locale = rawLanguage === "en" ? "en" : "it";
  const t = await getTranslations({ locale, namespace: "Errors" });

  const validated = buildSchema(t).safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    avatarUrl: formData.get("avatarUrl"),
    language: rawLanguage,
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
      return { error: t("usernameTaken") };
    }
    throw error;
  }

  revalidatePath("/settings");
  revalidatePath(`/u/${username}`);
  return undefined;
}
