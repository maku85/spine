import { getTranslations } from "next-intl/server";
import { BookSearch } from "@/components/book-search";
import { createClient } from "@/lib/supabase/server";

export default async function ExplorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("language")
    .eq("id", user?.id ?? "")
    .single();
  const preferredLanguage = profile?.language ?? "it";
  const t = await getTranslations("Explore.page");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-2xl">{t("title")}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{t("subtitle")}</p>
      <BookSearch preferredLanguage={preferredLanguage} />
    </div>
  );
}
