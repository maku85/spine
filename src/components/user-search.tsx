"use client";

import { Search } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { UserResultCard } from "@/components/user-result-card";
import { type ProfileSearchResult, searchProfiles } from "@/lib/actions/users";

export function UserSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [isSearching, startSearch] = useTransition();

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      startSearch(async () => {
        setResults(await searchProfiles(trimmed));
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cerca per username o nome…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      {isSearching && (
        <p className="text-sm text-muted-foreground">Ricerca in corso…</p>
      )}
      {!isSearching && query.trim() && results.length === 0 && (
        <p className="text-sm text-muted-foreground">Nessun utente trovato</p>
      )}
      <div className="grid gap-3">
        {results.map((profile) => (
          <UserResultCard key={profile.id} profile={profile} />
        ))}
      </div>
    </div>
  );
}
