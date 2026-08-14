import { getTranslations } from "next-intl/server";
import { UserSearch } from "@/components/user-search";

export default async function UsersPage() {
  const t = await getTranslations("Public.usersPage");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-serif text-2xl">{t("title")}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{t("subtitle")}</p>
      <UserSearch />
    </div>
  );
}
