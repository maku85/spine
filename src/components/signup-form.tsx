"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { signUp } from "@/app/(auth)/actions";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupsEnabled } from "@/lib/feature-flags";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, undefined);
  const t = useTranslations("Auth");

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-normal tracking-tight">
          {t("signup.title")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("signup.subtitle")}
        </p>
      </div>

      {!signupsEnabled() ? (
        <p className="rounded-xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground">
          {t("signup.disabled")}{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary transition-colors"
          >
            {t("signup.disabledLoginLink")}
          </Link>{" "}
          {t("signup.disabledSuffix")}
        </p>
      ) : (
        <>
          <form action={action} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="email"
                className="text-xs font-mono tracking-wider uppercase text-muted-foreground"
              >
                {t("signup.email")}
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="nome@esempio.it"
                required
                className="bg-card/80 border-border/70 focus-visible:ring-brass/50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="password"
                className="text-xs font-mono tracking-wider uppercase text-muted-foreground"
              >
                {t("signup.password")}
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                className="bg-card/80 border-border/70 focus-visible:ring-brass/50"
              />
            </div>
            {state?.error && (
              <p className="text-xs font-medium text-destructive">
                {state.error}
              </p>
            )}
            <Button
              type="submit"
              className="mt-2 w-full shadow-xs"
              disabled={pending}
            >
              {pending ? t("signup.submitting") : t("signup.submit")}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs font-mono text-muted-foreground/70 uppercase tracking-widest">
            <div className="h-[1px] flex-1 bg-border/60" />
            {t("or")}
            <div className="h-[1px] flex-1 bg-border/60" />
          </div>

          <GoogleSignInButton />

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {t("signup.hasAccount")}{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary transition-colors"
            >
              {t("signup.login")}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
