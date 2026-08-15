import { pickColor } from "@/lib/color";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "h-[80px] w-[54px] gap-1 p-2 rounded-[2px]",
  md: "h-[136px] w-[92px] gap-1.5 p-3.5 rounded-sm",
  compact: "h-[180px] w-[122px] gap-2 p-4 rounded-sm",
  lg: "h-[280px] w-[188px] gap-3 p-6 rounded-md",
} as const;

type Tier = { maxLength: number; font: string; clamp: string };

const TITLE_TIERS: Record<"sm" | "md" | "compact" | "lg", Tier[]> = {
  sm: [
    { maxLength: 20, font: "text-[9px]", clamp: "line-clamp-3" },
    { maxLength: 35, font: "text-[8px]", clamp: "line-clamp-4" },
    { maxLength: 55, font: "text-[7px]", clamp: "line-clamp-5" },
    {
      maxLength: Number.POSITIVE_INFINITY,
      font: "text-[6px]",
      clamp: "line-clamp-6",
    },
  ],
  md: [
    { maxLength: 25, font: "text-[11px]", clamp: "line-clamp-4" },
    { maxLength: 45, font: "text-[10px]", clamp: "line-clamp-5" },
    { maxLength: 70, font: "text-[8.5px]", clamp: "line-clamp-6" },
    {
      maxLength: Number.POSITIVE_INFINITY,
      font: "text-[7px]",
      clamp: "line-clamp-[8]",
    },
  ],
  compact: [
    { maxLength: 25, font: "text-sm", clamp: "line-clamp-4" },
    { maxLength: 45, font: "text-[12px]", clamp: "line-clamp-5" },
    { maxLength: 70, font: "text-[10px]", clamp: "line-clamp-6" },
    {
      maxLength: Number.POSITIVE_INFINITY,
      font: "text-[8.5px]",
      clamp: "line-clamp-[8]",
    },
  ],
  lg: [
    { maxLength: 30, font: "text-lg", clamp: "line-clamp-6" },
    { maxLength: 55, font: "text-[15px]", clamp: "line-clamp-[7]" },
    { maxLength: 90, font: "text-[13px]", clamp: "line-clamp-[9]" },
    {
      maxLength: Number.POSITIVE_INFINITY,
      font: "text-[11px]",
      clamp: "line-clamp-[11]",
    },
  ],
};

const AUTHOR_TIERS: Record<"md" | "compact" | "lg", Tier[]> = {
  md: [
    { maxLength: 10, font: "text-[7.5px]", clamp: "line-clamp-1" },
    { maxLength: 24, font: "text-[6.5px]", clamp: "line-clamp-2" },
    { maxLength: 42, font: "text-[5.5px]", clamp: "line-clamp-3" },
    {
      maxLength: Number.POSITIVE_INFINITY,
      font: "text-[4.5px]",
      clamp: "line-clamp-[4]",
    },
  ],
  compact: [
    { maxLength: 10, font: "text-[9px]", clamp: "line-clamp-1" },
    { maxLength: 24, font: "text-[8px]", clamp: "line-clamp-2" },
    { maxLength: 42, font: "text-[7px]", clamp: "line-clamp-3" },
    {
      maxLength: Number.POSITIVE_INFINITY,
      font: "text-[6px]",
      clamp: "line-clamp-[4]",
    },
  ],
  lg: [
    { maxLength: 17, font: "text-[10px]", clamp: "line-clamp-1" },
    { maxLength: 40, font: "text-[8.5px]", clamp: "line-clamp-2" },
    { maxLength: 75, font: "text-[7px]", clamp: "line-clamp-3" },
    {
      maxLength: Number.POSITIVE_INFINITY,
      font: "text-[6px]",
      clamp: "line-clamp-[4]",
    },
  ],
};

function pickTier(tiers: Tier[], length: number): Tier {
  return (
    tiers.find((tier) => length <= tier.maxLength) ?? tiers[tiers.length - 1]
  );
}

export function BookCover({
  title,
  author,
  size = "md",
  className,
}: {
  title: string;
  author?: string | null;
  size?: "sm" | "md" | "compact" | "lg";
  className?: string;
}) {
  const bg = pickColor(title);
  const titleTier = pickTier(TITLE_TIERS[size], title.length);
  const authorTier =
    size !== "sm" && author
      ? pickTier(AUTHOR_TIERS[size], author.length)
      : null;

  return (
    <div
      className={cn(
        "book-cover-3d group-hover/card:-translate-y-1 group-hover/card:-rotate-y-3 relative flex shrink-0 flex-col justify-between overflow-hidden text-white transition-all duration-300 select-none",
        SIZE_CLASSES[size],
        className,
      )}
      style={{ backgroundColor: bg }}
    >
      {/* Spine Crease Hinge Channel */}
      <div className="book-spine-crease" />

      {/* Simulated Page Stack (Right Edge) */}
      <div className="pointer-events-none absolute top-1 bottom-1 right-0 w-[2px] rounded-r-xs bg-gradient-to-l from-amber-50/80 via-amber-100/40 to-transparent shadow-xs" />

      {/* Texture & Cloth Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/35 via-black/5 to-white/20" />
      <div className="pointer-events-none absolute inset-1.5 rounded-[inherit] border border-white/20 opacity-60" />

      {/* Header Foil Line */}
      <div className="relative z-10 flex items-center pl-1.5">
        <div className="h-[1px] flex-1 bg-gradient-to-r from-brass/40 via-brass to-brass/40" />
      </div>

      {/* Book Cover Typography */}
      <div className="relative z-10 my-auto flex flex-col gap-1 pl-2 pr-1">
        <p
          className={cn(
            "font-serif font-medium leading-[1.15] tracking-tight text-balance drop-shadow-md",
            titleTier.font,
            titleTier.clamp,
          )}
        >
          {title}
        </p>
        {author && (
          <p
            className={cn(
              "font-mono tracking-widest uppercase opacity-85 drop-shadow-sm text-brass/90",
              authorTier ? authorTier.font : "hidden",
              authorTier?.clamp,
            )}
          >
            {author}
          </p>
        )}
      </div>

      {/* Tailband Foil Line */}
      <div className="relative z-10 flex items-center pl-1.5">
        <div className="h-[1px] flex-1 bg-gradient-to-r from-brass/40 via-brass to-brass/40" />
      </div>
    </div>
  );
}
