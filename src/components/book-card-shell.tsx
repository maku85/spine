import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function BookCardShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "tactile-card group/card relative overflow-hidden border border-border/80 bg-card/95 py-0 transition-all duration-300 hover:border-brass/50 hover:shadow-xl",
        className,
      )}
    >
      <div className="absolute top-0 right-4 z-10 h-3 w-2.5 rounded-b-xs bg-brass/80 opacity-70 shadow-xs transition-all group-hover/card:h-4 group-hover/card:opacity-100" />
      <div className="absolute right-0 bottom-0 left-0 h-[3px] bg-gradient-to-r from-wood via-brass to-wood opacity-80" />
      <CardContent className="flex gap-4 p-4">{children}</CardContent>
    </Card>
  );
}
