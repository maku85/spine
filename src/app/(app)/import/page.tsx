import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BookieImportForm } from "@/components/bookie-import-form";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export default async function ImportPage() {
  const t = await getTranslations("Settings.import");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("backLink")}
      </Link>
      <h1 className="font-serif text-2xl">{t("title")}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{t("body")}</p>
      <BookieImportForm />
    </div>
  );
}
