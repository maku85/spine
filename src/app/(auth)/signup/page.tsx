"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthBrandingPanel } from "@/components/auth-branding-panel";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupsEnabled } from "@/lib/feature-flags";
import { signUp } from "../actions";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, undefined);

  return (
    <div className="grid min-h-svh md:grid-cols-2 bg-background">
      <AuthBrandingPanel />
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h1 className="font-serif text-3xl font-normal tracking-tight">
              Crea un account
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Inizia a catalogare i tuoi volumi e le tue letture.
            </p>
          </div>

          {!signupsEnabled() ? (
            <p className="rounded-xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground">
              Le registrazioni sono temporaneamente sospese. Riprova più tardi,
              oppure{" "}
              <Link
                href="/login"
                className="font-medium text-foreground underline underline-offset-4 hover:text-primary transition-colors"
              >
                accedi
              </Link>{" "}
              se hai già un account.
            </p>
          ) : (
            <>
              <form action={action} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor="email"
                    className="text-xs font-mono tracking-wider uppercase text-muted-foreground"
                  >
                    Email
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
                    Password
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
                  {pending ? "Creazione in corso…" : "Crea account"}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3 text-xs font-mono text-muted-foreground/70 uppercase tracking-widest">
                <div className="h-[1px] flex-1 bg-border/60" />
                oppure
                <div className="h-[1px] flex-1 bg-border/60" />
              </div>

              <GoogleSignInButton />

              <p className="mt-8 text-center text-sm text-muted-foreground">
                Hai già un account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-foreground underline underline-offset-4 hover:text-primary transition-colors"
                >
                  Accedi
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
