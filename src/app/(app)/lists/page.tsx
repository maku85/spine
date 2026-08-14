import { getTranslations } from "next-intl/server";
import { ListManager, type ListSummary } from "@/components/list-manager";
import { createClient } from "@/lib/supabase/server";

export default async function ListsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const t = await getTranslations("Lists.page");

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const listIds = (lists ?? []).map((list) => list.id);

  const { data: listBooks } =
    listIds.length > 0
      ? await supabase
          .from("list_books")
          .select("list_id, user_books(id, books(title, authors))")
          .in("list_id", listIds)
      : { data: [] };

  const booksByListId = new Map<
    string,
    { userBookId: string; title: string; authors: string[] }[]
  >();
  for (const row of listBooks ?? []) {
    const userBook = row.user_books;
    const book = userBook?.books;
    if (!userBook || !book) continue;
    const existing = booksByListId.get(row.list_id) ?? [];
    existing.push({
      userBookId: userBook.id,
      title: book.title,
      authors: book.authors,
    });
    booksByListId.set(row.list_id, existing);
  }

  const listSummaries: ListSummary[] = (lists ?? []).map((list) => ({
    id: list.id,
    name: list.name,
    books: booksByListId.get(list.id) ?? [],
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-2xl">{t("title")}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{t("subtitle")}</p>
      <ListManager lists={listSummaries} />
    </div>
  );
}
