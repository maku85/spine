"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/lib/actions/profile";

export function SettingsForm({
  username,
  displayName,
  avatarUrl,
}: {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}) {
  const [state, action, pending] = useActionState(updateProfile, undefined);

  return (
    <form action={action} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" defaultValue={username} required />
        <p className="text-xs text-muted-foreground">
          Usato nell'indirizzo pubblico del tuo profilo.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Nome visualizzato</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={displayName ?? ""}
          placeholder={username}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="avatarUrl">URL avatar</Label>
        <Input
          id="avatarUrl"
          name="avatarUrl"
          type="url"
          defaultValue={avatarUrl ?? ""}
          placeholder="https://…"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" className="mt-2 w-fit" disabled={pending}>
        {pending ? "Salvataggio…" : "Salva"}
      </Button>
    </form>
  );
}
