"use client";

import { useTranslations } from "next-intl";
import { signInWithGoogle } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const t = useTranslations("Auth");
  return (
    <form action={signInWithGoogle}>
      <Button type="submit" variant="outline" className="w-full">
        {t("google")}
      </Button>
    </form>
  );
}
