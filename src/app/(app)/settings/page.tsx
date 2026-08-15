import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SettingsForm } from "@/components/settings-form";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, language")
    .eq("id", user?.id ?? "")
    .single();

  if (!profile) return null;

  const t = await getTranslations("Settings.page");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-serif text-2xl">{t("title")}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {t("publicProfileIntro")}{" "}
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
        language={profile.language}
      />

      <div className="mt-8 border-t border-border/60 pt-6">
        <h2 className="font-serif text-lg">{t("listsHeading")}</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          {t("listsBody")}
        </p>
        <Link
          href="/lists"
          className="text-sm font-medium text-primary underline underline-offset-2"
        >
          {t("manageLists")}
        </Link>
      </div>

      <div className="mt-8 border-t border-border/60 pt-6">
        <h2 className="font-serif text-lg">{t("importHeading")}</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          {t("importBody")}
        </p>
        <Link
          href="/import"
          className="text-sm font-medium text-primary underline underline-offset-2"
        >
          {t("importCta")}
        </Link>
      </div>
    </div>
  );
}
