import { BookOpen, LogOut, Plus, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-3.5">
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 font-serif text-xl tracking-tight transition-opacity hover:opacity-90 sm:gap-2.5 sm:text-2xl"
          >
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-xs ring-1 ring-brass/30 transition-transform group-hover:scale-105 sm:size-8">
              <BookOpen className="size-4 text-primary" strokeWidth={2} />
            </div>
            <span className="font-serif font-normal text-foreground">
              Spine
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            {/* Suggerimenti: solo icona su mobile, icona+testo su desktop */}
            <Button
              render={<Link href="/suggestions" />}
              nativeButton={false}
              variant="ghost"
              size="icon-sm"
              aria-label="Suggerimenti"
              title="Suggerimenti"
              className="text-muted-foreground hover:text-foreground sm:hidden"
            >
              <Sparkles className="size-4 text-brass" />
            </Button>
            <Button
              render={<Link href="/suggestions" />}
              nativeButton={false}
              variant="ghost"
              size="sm"
              className="hidden gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              <Sparkles className="size-3.5 text-brass" />
              Suggerimenti
            </Button>

            {/* Aggiungi: icona su mobile, icona+testo su desktop */}
            <Button
              render={<Link href="/books/add" />}
              nativeButton={false}
              size="icon-sm"
              aria-label="Aggiungi libro"
              title="Aggiungi libro"
              className="shadow-xs sm:hidden"
            >
              <Plus className="size-4" />
            </Button>
            <Button
              render={<Link href="/books/add" />}
              nativeButton={false}
              size="sm"
              className="hidden gap-1.5 shadow-xs sm:inline-flex"
            >
              <Plus className="size-4" />
              Aggiungi libro
            </Button>

            {/* Avatar */}
            {profile && (
              <Link
                href={`/u/${profile.username}`}
                className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-muted"
                title="Il mio profilo pubblico"
              >
                <ProfileAvatar
                  name={profile.display_name || profile.username}
                  avatarUrl={profile.avatar_url}
                  size="md"
                  className="size-7 text-xs ring-1 ring-brass/40"
                />
                <span className="hidden text-xs font-mono text-muted-foreground sm:inline">
                  @{profile.username}
                </span>
              </Link>
            )}

            {/* Settings e Logout: solo su desktop su mobile si accede dalle impostazioni */}
            <Button
              render={<Link href="/settings" />}
              nativeButton={false}
              variant="ghost"
              size="icon-sm"
              aria-label="Impostazioni"
              title="Impostazioni"
              className="hidden text-muted-foreground hover:text-foreground sm:flex"
            >
              <Settings className="size-4" />
            </Button>
            <form action={signOut} className="hidden sm:block">
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                aria-label="Esci"
                title="Esci"
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="size-4" />
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
