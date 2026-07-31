import { franc } from "franc-min";

export function isItalian(text: string, minLength = 10): boolean {
  return franc(text, { minLength }) === "ita";
}
