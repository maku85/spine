import { pickColor } from "@/lib/color";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
} as const;

export function ProfileAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "md" | "lg";
  className?: string;
}) {
  if (avatarUrl) {
    // Arbitrary user-provided URL: can't be pre-configured in
    // next.config.ts's images.remotePatterns, so a plain <img> is used
    // instead of next/image here.
    return (
      // biome-ignore lint/performance/noImgElement: external, user-provided URL
      <img
        src={avatarUrl}
        alt={name}
        className={cn(
          "shrink-0 rounded-full object-cover ring-1 ring-black/10",
          SIZE_CLASSES[size],
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-serif text-primary-foreground ring-1 ring-black/10",
        SIZE_CLASSES[size],
        className,
      )}
      style={{ backgroundColor: pickColor(name) }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
