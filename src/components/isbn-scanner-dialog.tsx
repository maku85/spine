"use client";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { ScanBarcode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function IsbnScannerDialog({
  onDetected,
}: {
  onDetected: (isbn: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open || !videoRef.current) return;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
    const reader = new BrowserMultiFormatReader(hints);

    let stopped = false;
    let controls: { stop: () => void } | undefined;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (stopped || !result) return;
        stopped = true;
        controls?.stop();
        onDetected(result.getText());
        setOpen(false);
      })
      .then((c) => {
        controls = c;
        if (stopped) controls.stop();
      })
      .catch(() => setError("Impossibile accedere alla fotocamera."));

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [open, onDetected]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Scansiona codice a barre"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <ScanBarcode className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inquadra il codice a barre (ISBN)</DialogTitle>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <video
              ref={videoRef}
              className="aspect-square w-full rounded-lg bg-black object-cover"
              muted
              playsInline
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
