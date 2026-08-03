import Link from "next/link";
import { FollowButton } from "@/components/follow-button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { ProfileSearchResult } from "@/lib/actions/users";

export function UserResultCard({ profile }: { profile: ProfileSearchResult }) {
  const name = profile.displayName || profile.username;

  return (
    <Card className="overflow-hidden border border-border/70 bg-card/90 py-0">
      <CardContent className="flex items-center gap-3 p-3">
        <Link
          href={`/u/${profile.username}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <ProfileAvatar name={name} avatarUrl={profile.avatarUrl} size="md" />
          <div className="min-w-0">
            <p className="truncate font-serif text-base">{name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              @{profile.username}
            </p>
          </div>
        </Link>
        <FollowButton
          profileUserId={profile.id}
          profileUsername={profile.username}
        />
      </CardContent>
    </Card>
  );
}
