import { pickColor } from "@/lib/color";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "h-[80px] w-[54px] gap-1 p-2 rounded-[2px]",
  md: "h-[136px] w-[92px] gap-1.5 p-3.5 rounded-sm",
  lg: "h-[280px] w-[188px] gap-3 p-6 rounded-md",
} as const;

const TITLE_CLASSES = {
  sm: "font-serif text-[9px] font-medium leading-[1.15] line-clamp-3 tracking-tight",
  md: "font-serif text-[11px] font-medium leading-snug line-clamp-4 tracking-tight",
  lg: "font-serif text-lg font-normal leading-snug line-clamp-6 tracking-tight",
} as const;

const AUTHOR_CLASSES = {
  sm: "hidden",
  md: "font-mono text-[7.5px] tracking-widest uppercase truncate opacity-85",
  lg: "font-mono text-[10px] tracking-widest uppercase truncate opacity-90",
} as const;

export function BookCover({
  title,
  author,
  size = "md",
  className,
}: {
  title: string;
  author?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const bg = pickColor(title);

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
            TITLE_CLASSES[size],
            "text-balance drop-shadow-md font-serif",
          )}
        >
          {title}
        </p>
        {author && (
          <p
            className={cn(AUTHOR_CLASSES[size], "drop-shadow-sm text-brass/90")}
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
