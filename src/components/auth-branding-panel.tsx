import { BookMarked, Sparkles } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BookCover } from "@/components/book-cover";

const SAMPLE_BOOKS_IT = [
  { title: "Il nome della rosa", author: "Umberto Eco" },
  { title: "Klara e il Sole", author: "Kazuo Ishiguro" },
  { title: "Cent'anni di solitudine", author: "Gabriel García Márquez" },
];

const SAMPLE_BOOKS_EN = [
  { title: "The Name of the Rose", author: "Umberto Eco" },
  { title: "Klara and the Sun", author: "Kazuo Ishiguro" },
  { title: "One Hundred Years of Solitude", author: "Gabriel García Márquez" },
];

export async function AuthBrandingPanel() {
  const t = await getTranslations("Auth.branding");
  const locale = await getLocale();
  const sampleBooks = locale === "en" ? SAMPLE_BOOKS_EN : SAMPLE_BOOKS_IT;

  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-b from-primary via-primary/95 to-wood/80 p-12 text-primary-foreground md:flex">
      {/* Decorative ambient background glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-brass/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 size-80 rounded-full bg-wood/40 blur-3xl" />

      <Link
        href="/"
        className="relative z-10 flex items-center gap-2.5 font-serif text-3xl tracking-tight"
      >
        <div className="flex size-9 items-center justify-center rounded-lg bg-brass/20 text-brass shadow-xs ring-1 ring-brass/40">
          <BookMarked className="size-5" strokeWidth={1.75} />
        </div>
        <span>Spine</span>
      </Link>

      <div className="relative z-10 my-auto flex flex-col gap-8 py-10">
        <div>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brass/30 bg-brass/10 px-3 py-1 text-xs font-mono tracking-wider text-brass">
            <Sparkles className="size-3" />
            {t("badge")}
          </div>
          <h2 className="max-w-md font-serif text-4xl leading-tight font-normal text-balance">
            {t("heading")}
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-primary-foreground/80">
            {t("body")}
          </p>
        </div>

        {/* Tactile Book Preview Stack */}
        <div className="flex items-center gap-4 pt-2">
          {sampleBooks.map((book, i) => (
            <div
              key={book.title}
              className="transition-transform duration-300 hover:-translate-y-2"
              style={{
                transform: `rotate(${i === 0 ? "-3deg" : i === 2 ? "3deg" : "0deg"})`,
              }}
            >
              <BookCover title={book.title} author={book.author} size="md" />
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between border-t border-primary-foreground/15 pt-4 text-xs">
        <span className="font-mono tracking-widest text-primary-foreground/50 uppercase">
          {t("edition")}
        </span>
        <span className="font-serif italic text-brass">{t("tagline")}</span>
      </div>
    </div>
  );
}
