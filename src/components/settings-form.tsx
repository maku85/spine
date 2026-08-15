"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProfile } from "@/lib/actions/profile";
import type {
  CardViewMode,
  PreferredLanguage,
} from "@/lib/supabase/database.types";

const LANGUAGE_KEYS: PreferredLanguage[] = ["it", "en"];
const CARD_VIEW_KEYS: CardViewMode[] = ["comfortable", "compact"];

export function SettingsForm({
  username,
  displayName,
  avatarUrl,
  language,
  cardView,
}: {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  language: PreferredLanguage;
  cardView: CardViewMode;
}) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const t = useTranslations("Settings.form");
  const tLanguages = useTranslations("Settings.languages");
  const tCardViews = useTranslations("Settings.cardViews");
  const common = useTranslations("Common.actions");

  return (
    <form action={action} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="username">{t("username")}</Label>
        <Input id="username" name="username" defaultValue={username} required />
        <p className="text-xs text-muted-foreground">{t("usernameHint")}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">{t("displayName")}</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={displayName ?? ""}
          placeholder={username}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="avatarUrl">{t("avatarUrl")}</Label>
        <Input
          id="avatarUrl"
          name="avatarUrl"
          type="url"
          defaultValue={avatarUrl ?? ""}
          placeholder="https://…"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="language">{t("language")}</Label>
        <Select name="language" defaultValue={language}>
          <SelectTrigger id="language" className="w-full">
            <SelectValue>
              {(value) => tLanguages(value as PreferredLanguage)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_KEYS.map((value) => (
              <SelectItem key={value} value={value}>
                {tLanguages(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("languageHint")}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="cardView">{t("cardView")}</Label>
        <Select name="cardView" defaultValue={cardView}>
          <SelectTrigger id="cardView" className="w-full">
            <SelectValue>
              {(value) => tCardViews(value as CardViewMode)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CARD_VIEW_KEYS.map((value) => (
              <SelectItem key={value} value={value}>
                {tCardViews(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("cardViewHint")}</p>
      </div>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" className="mt-2 w-fit" disabled={pending}>
        {pending ? common("saving") : common("save")}
      </Button>
    </form>
  );
}
