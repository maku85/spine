"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function AuthDialog({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <Dialog
      defaultOpen
      onOpenChange={(open) => {
        if (!open) router.push("/explore");
      }}
    >
      <DialogContent className="sm:max-w-sm">{children}</DialogContent>
    </Dialog>
  );
}
