declare module "franc-min" {
  interface FrancOptions {
    only?: string[];
    ignore?: string[];
    minLength?: number;
  }

  // Returns an ISO 639-3 language code, or "und" if it can't tell.
  export function franc(value: string, options?: FrancOptions): string;
}
