"use client";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { ScanBarcode } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function IsbnScannerDialog({
  onDetected,
}: {
  onDetected: (isbn: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null,
  );
  const t = useTranslations("Explore.scanner");

  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!open || !videoElement) return;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
    const reader = new BrowserMultiFormatReader(hints);

    let stopped = false;
    let controls: { stop: () => void } | undefined;

    reader
      .decodeFromVideoDevice(undefined, videoElement, (result) => {
        if (stopped || !result) return;
        stopped = true;
        controls?.stop();
        onDetectedRef.current(result.getText());
        setOpen(false);
      })
      .then((c) => {
        controls = c;
        if (stopped) controls.stop();
      })
      .catch(() => setError(t("cameraError")));

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [open, videoElement, t]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("triggerAriaLabel")}
          />
        }
      >
        <ScanBarcode className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <video
            ref={setVideoElement}
            className="aspect-square w-full rounded-lg bg-black object-cover"
            muted
            playsInline
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
