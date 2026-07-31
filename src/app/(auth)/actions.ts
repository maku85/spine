"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get("host");
  const proto =
    headersList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const CredentialsSchema = z.object({
  email: z.email({ error: "Inserisci un indirizzo email valido." }),
  password: z
    .string()
    .min(8, { error: "La password deve contenere almeno 8 caratteri." }),
});

export type AuthFormState = { error: string } | undefined;

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validated = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(validated.data);

  if (error) {
    return { error: "Credenziali non valide." };
  }

  redirect("/dashboard");
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validated = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { error: validated.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(validated.data);

  if (error) {
    return { error: error.message };
  }

  // With email confirmation enabled (Supabase default), signUp does not
  // return a session until the user clicks the confirmation link.
  if (!data.session) {
    return { error: "Controlla la tua email per confermare la registrazione." };
  }

  redirect("/dashboard");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const baseUrl = await getBaseUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${baseUrl}/auth/callback` },
  });

  if (error || !data.url) {
    throw error ?? new Error("Could not start Google sign-in");
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
