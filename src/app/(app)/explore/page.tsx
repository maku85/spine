import { getTranslations } from "next-intl/server";
import { BookSearch } from "@/components/book-search";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { UserSearch } from "@/components/user-search";
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
  const t = await getTranslations("Explore");

  return (
    <div>
      <h1 className="font-serif text-2xl">{t("page.title")}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {t("page.subtitle")}
      </p>
      <Tabs defaultValue="books">
        <TabsList className="mb-6">
          <TabsTab value="books">{t("tabs.books")}</TabsTab>
          <TabsTab value="users">{t("tabs.users")}</TabsTab>
        </TabsList>
        <TabsPanel value="books">
          <BookSearch
            preferredLanguage={preferredLanguage}
            isAuthenticated={Boolean(user)}
          />
        </TabsPanel>
        <TabsPanel value="users">
          <UserSearch />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
