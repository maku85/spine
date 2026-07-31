// Muted cloth-hardcover tones, not an arbitrary hue wheel — keeps generated
// covers/avatars feeling curated rather than randomly colorful.
const PALETTE = [
  "oklch(0.4 0.07 165)", // library green
  "oklch(0.36 0.1 25)", // oxblood
  "oklch(0.34 0.07 250)", // navy
  "oklch(0.4 0.06 50)", // walnut
  "oklch(0.3 0.015 150)", // charcoal ink
  "oklch(0.37 0.06 200)", // deep teal
];

export function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
