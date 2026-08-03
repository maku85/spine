import { UserSearch } from "@/components/user-search";

export default function UsersPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-serif text-2xl">Cerca utenti</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Trova altri lettori per username o nome e seguili per raggiungere
        facilmente il loro profilo.
      </p>
      <UserSearch />
    </div>
  );
}
