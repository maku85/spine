import { BookMarked, BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FollowButton } from "@/components/follow-button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { PublicBookCard } from "@/components/public-book-card";
import { PublicLibraryView } from "@/components/public-library-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createPublicClient } from "@/lib/supabase/public";

type ProfileSummary = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

function ProfileRow({ profile }: { profile: ProfileSummary }) {
  const name = profile.displayName || profile.username;
  return (
    <Link
      href={`/u/${profile.username}`}
      className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-secondary/50"
    >
      <ProfileAvatar name={name} avatarUrl={profile.avatarUrl} size="md" />
      <div className="min-w-0">
        <p className="truncate font-serif text-sm">{name}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          @{profile.username}
        </p>
      </div>
    </Link>
  );
}

export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const t = await getTranslations("Public");

  const supabase = createPublicClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const { data: userBooks } = await supabase
    .from("user_books")
    .select(
      "id, status, liked, books(title, authors, description, subjects, first_publish_year)",
    )
    .eq("user_id", profile.id)
    .order("added_at", { ascending: false });

  const books = (userBooks ?? [])
    .filter(
      (
        userBook,
      ): userBook is typeof userBook & {
        books: NonNullable<typeof userBook.books>;
      } => userBook.books !== null,
    )
    .map((userBook) => ({
      userBookId: userBook.id,
      title: userBook.books.title,
      authors: userBook.books.authors,
      status: userBook.status,
      liked: userBook.liked,
      description: userBook.books.description,
      subjects: userBook.books.subjects,
      firstPublishYear: userBook.books.first_publish_year,
    }));
  const name = profile.display_name || profile.username;

  const readCount = books.filter((b) => b.status === "read").length;
  const readingCount = books.filter((b) => b.status === "reading").length;
  const wishlistCount = books.filter((b) => b.status === "wishlist").length;

  const [{ data: followerRows }, { data: followingRows }] = await Promise.all([
    supabase
      .from("follows")
      .select("follower_id")
      .eq("followed_id", profile.id),
    supabase
      .from("follows")
      .select("followed_id")
      .eq("follower_id", profile.id),
  ]);

  const followerIds = (followerRows ?? []).map((r) => r.follower_id);
  const followingIds = (followingRows ?? []).map((r) => r.followed_id);

  const [{ data: followerProfiles }, { data: followingProfiles }] =
    await Promise.all([
      followerIds.length > 0
        ? supabase
            .from("profiles")
            .select("username, display_name, avatar_url")
            .in("id", followerIds)
        : Promise.resolve({ data: [] }),
      followingIds.length > 0
        ? supabase
            .from("profiles")
            .select("username, display_name, avatar_url")
            .in("id", followingIds)
        : Promise.resolve({ data: [] }),
    ]);

  const followers: ProfileSummary[] = (followerProfiles ?? []).map((p) => ({
    username: p.username,
    displayName: p.display_name,
    avatarUrl: p.avatar_url,
  }));
  const following: ProfileSummary[] = (followingProfiles ?? []).map((p) => ({
    username: p.username,
    displayName: p.display_name,
    avatarUrl: p.avatar_url,
  }));

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: true });

  const listIds = (lists ?? []).map((list) => list.id);
  const { data: listBookRows } =
    listIds.length > 0
      ? await supabase
          .from("list_books")
          .select("list_id, user_book_id")
          .in("list_id", listIds)
      : { data: [] };

  const booksByUserBookId = new Map(books.map((b) => [b.userBookId, b]));
  const listsWithBooks = (lists ?? [])
    .map((list) => ({
      id: list.id,
      name: list.name,
      books: (listBookRows ?? [])
        .filter((row) => row.list_id === list.id)
        .map((row) => booksByUserBookId.get(row.user_book_id))
        .filter((b): b is NonNullable<typeof b> => b !== undefined),
    }))
    .filter((list) => list.books.length > 0);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-3.5">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-2 font-serif text-xl tracking-tight transition-opacity hover:opacity-90 sm:gap-2.5 sm:text-2xl"
          >
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-xs ring-1 ring-brass/30 transition-transform group-hover:scale-105 sm:size-8">
              <BookOpen className="size-4 text-primary" strokeWidth={2} />
            </div>
            <span className="font-serif font-normal text-foreground">
              Spine
            </span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Mobile: solo icona */}
            <Button
              render={<Link href="/signup" />}
              nativeButton={false}
              size="icon-sm"
              aria-label={t("createLibrary")}
              title={t("createLibrary")}
              className="shadow-xs sm:hidden"
            >
              <Sparkles className="size-4 text-brass" />
            </Button>
            {/* Desktop: icona + testo */}
            <Button
              render={<Link href="/signup" />}
              nativeButton={false}
              size="sm"
              className="hidden gap-1.5 shadow-xs sm:inline-flex"
            >
              <Sparkles className="size-3.5 text-brass" />
              {t("createLibrary")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Profile Hero Banner */}
        <div className="relative mb-8 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card/90 to-secondary/30 p-5 shadow-xs sm:mb-10 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-brass/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              <ProfileAvatar
                name={name}
                avatarUrl={profile.avatar_url}
                size="lg"
                className="size-14 shrink-0 text-xl ring-2 ring-brass/50 shadow-md sm:size-16"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-serif text-2xl font-normal tracking-tight sm:text-3xl">
                    {name}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full border border-brass/40 bg-brass/10 px-2.5 py-0.5 font-mono text-[10px] tracking-widest text-brass uppercase">
                    {t("curator")}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  @{profile.username}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <Dialog>
                    <DialogTrigger
                      render={
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                          disabled={followers.length === 0}
                        />
                      }
                    >
                      <span className="font-medium text-foreground">
                        {followers.length}
                      </span>{" "}
                      {t("followers")}
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-sm">
                      <DialogHeader>
                        <DialogTitle>{t("followersDialogTitle")}</DialogTitle>
                      </DialogHeader>
                      <div className="flex flex-col gap-1">
                        {followers.map((f) => (
                          <ProfileRow key={f.username} profile={f} />
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog>
                    <DialogTrigger
                      render={
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                          disabled={following.length === 0}
                        />
                      }
                    >
                      <span className="font-medium text-foreground">
                        {following.length}
                      </span>{" "}
                      {t("following")}
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-sm">
                      <DialogHeader>
                        <DialogTitle>{t("followingDialogTitle")}</DialogTitle>
                      </DialogHeader>
                      <div className="flex flex-col gap-1">
                        {following.map((f) => (
                          <ProfileRow key={f.username} profile={f} />
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="mt-3">
                  <FollowButton
                    profileUserId={profile.id}
                    profileUsername={profile.username}
                  />
                </div>
              </div>
            </div>

            {/* Reading Stats Pills */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-4 sm:border-t-0 sm:pt-0">
              <div className="flex flex-col items-center rounded-xl border border-border/60 bg-background/60 px-4 py-2 text-center min-w-[75px]">
                <span className="font-serif text-xl font-normal text-foreground">
                  {books.length}
                </span>
                <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                  {t("stats.volumes")}
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-border/60 bg-background/60 px-4 py-2 text-center min-w-[75px]">
                <span className="font-serif text-xl font-normal text-primary">
                  {readCount}
                </span>
                <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                  {t("stats.read")}
                </span>
              </div>
              {readingCount > 0 && (
                <div className="flex flex-col items-center rounded-xl border border-border/60 bg-background/60 px-4 py-2 text-center min-w-[75px]">
                  <span className="font-serif text-xl font-normal text-brass">
                    {readingCount}
                  </span>
                  <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                    {t("stats.reading")}
                  </span>
                </div>
              )}
              {wishlistCount > 0 && (
                <div className="flex flex-col items-center rounded-xl border border-border/60 bg-background/60 px-4 py-2 text-center min-w-[75px]">
                  <span className="font-serif text-xl font-normal text-muted-foreground">
                    {wishlistCount}
                  </span>
                  <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                    {t("stats.toRead")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {books.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 py-16 text-center">
            <BookMarked className="mx-auto size-10 text-muted-foreground/50 mb-3" />
            <p className="font-serif text-lg text-foreground">
              {t("emptyLibrary.title")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("emptyLibrary.message", { username: profile.username })}
            </p>
          </div>
        ) : (
          <PublicLibraryView books={books} />
        )}

        {listsWithBooks.length > 0 && (
          <div className="mt-10 flex flex-col gap-10 border-t border-border/60 pt-8 sm:mt-12">
            {listsWithBooks.map((list) => (
              <div key={list.id}>
                <h2 className="mb-4 flex items-center gap-3">
                  <span className="font-serif text-xl font-medium text-primary">
                    {list.name}
                  </span>
                  <span className="h-[1px] flex-1 bg-gradient-to-r from-border via-border/50 to-transparent" />
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.books.map((book) => (
                    <PublicBookCard key={book.userBookId} {...book} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
