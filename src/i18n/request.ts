import { headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

function localeFromPreference(preference: string | null | undefined): string {
  return preference === "en" ? "en" : "it";
}

function localeFromAcceptLanguage(acceptLanguage: string | null): string {
  const first = acceptLanguage?.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("en") ? "en" : "it";
}

async function resolveLocale(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("language")
      .eq("id", user.id)
      .single();
    if (profile) return localeFromPreference(profile.language);
  }

  const headerList = await headers();
  return localeFromAcceptLanguage(headerList.get("accept-language"));
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages };
});
