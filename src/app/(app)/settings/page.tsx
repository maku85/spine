import Link from "next/link";
import { SettingsForm } from "@/components/settings-form";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", user?.id ?? "")
    .single();

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-serif text-2xl">Impostazioni profilo</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Il tuo profilo pubblico è visibile su{" "}
        <Link
          href={`/u/${profile.username}`}
          className="underline underline-offset-2"
        >
          /u/{profile.username}
        </Link>
        .
      </p>
      <SettingsForm
        username={profile.username}
        displayName={profile.display_name}
        avatarUrl={profile.avatar_url}
      />

      <div className="mt-8 border-t border-border/60 pt-6">
        <h2 className="font-serif text-lg">Importa libreria</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          Hai un export di Bookie? Puoi importarlo nella tua libreria Spine.
        </p>
        <Link
          href="/import"
          className="text-sm font-medium text-primary underline underline-offset-2"
        >
          Importa da Bookie
        </Link>
      </div>
    </div>
  );
}
