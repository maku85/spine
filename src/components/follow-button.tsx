"use client";

import { UserCheck, UserPlus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  followUser,
  getFollowStatus,
  unfollowUser,
} from "@/lib/actions/follows";

type Status = "loading" | "hidden" | "not-following" | "following";

export function FollowButton({
  profileUserId,
  profileUsername,
}: {
  profileUserId: string;
  profileUsername: string;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getFollowStatus(profileUserId).then((result) => {
      if (cancelled) return;
      setStatus(
        result === null
          ? "hidden"
          : result.isFollowing
            ? "following"
            : "not-following",
      );
    });
    return () => {
      cancelled = true;
    };
  }, [profileUserId]);

  if (status === "loading" || status === "hidden") return null;

  const isFollowing = status === "following";

  return (
    <Button
      type="button"
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      disabled={pending}
      className="gap-1.5"
      onClick={() =>
        startTransition(async () => {
          if (isFollowing) {
            await unfollowUser(profileUserId, profileUsername);
            setStatus("not-following");
          } else {
            await followUser(profileUserId, profileUsername);
            setStatus("following");
          }
        })
      }
    >
      {isFollowing ? (
        <>
          <UserCheck className="size-3.5" />
          Seguito
        </>
      ) : (
        <>
          <UserPlus className="size-3.5" />
          Segui
        </>
      )}
    </Button>
  );
}
