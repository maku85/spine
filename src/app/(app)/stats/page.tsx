import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { fetchCatalogStats } from "@/lib/catalog-stats/read";
import { createClient } from "@/lib/supabase/server";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/80 p-4">
      <p className="font-serif text-2xl">{value.toLocaleString()}</p>
      <p className="mt-1 font-mono text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
    </div>
  );
}

function ScriptRecommendation({
  command,
  reason,
}: {
  command: string;
  reason: string;
}) {
  return (
    <div className="rounded-xl border border-brass/30 bg-brass/5 p-4">
      <code className="block font-mono text-sm text-foreground">{command}</code>
      <p className="mt-1.5 text-xs text-muted-foreground">{reason}</p>
    </div>
  );
}

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("Stats");
  const stats = await fetchCatalogStats();

  if (!stats) {
    return (
      <div>
        <h1 className="font-serif text-2xl">{t("title")}</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {t("notConfigured")}
        </p>
      </div>
    );
  }

  const resolveReasonParts = [
    stats.listIsbnsUnresolved > 0 &&
      t("recommendations.resolveUnresolved", {
        count: stats.listIsbnsUnresolved,
      }),
    stats.translationRetryCandidates > 0 &&
      t("recommendations.resolveRetry", {
        count: stats.translationRetryCandidates,
      }),
  ].filter((part): part is string => Boolean(part));

  const recommendations = [
    stats.pendingReview > 0 && {
      command: "pnpm merge-duplicate-books",
      reason: t("recommendations.merge", { count: stats.pendingReview }),
    },
    stats.enrichCandidates > 0 && {
      command: "pnpm enrich-books",
      reason: t("recommendations.enrich", { count: stats.enrichCandidates }),
    },
    stats.hardcoverCandidates > 0 && {
      command:
        "node --env-file=.env.local scripts/import-hardcover-book-data.mts",
      reason: t("recommendations.hardcover", {
        count: stats.hardcoverCandidates,
      }),
    },
    resolveReasonParts.length > 0 && {
      command: "pnpm resolve-list-books",
      reason: resolveReasonParts.join(" "),
    },
  ].filter((r): r is { command: string; reason: string } => Boolean(r));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-2xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div>
        <h2 className="mb-3 font-mono text-xs tracking-wide text-muted-foreground uppercase">
          {t("sections.catalog")}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label={t("labels.totalBooks")} value={stats.totalBooks} />
          <StatCard
            label={t("labels.pendingReview")}
            value={stats.pendingReview}
          />
          <StatCard label={t("labels.withItalian")} value={stats.withItalian} />
          <StatCard label={t("labels.withEnglish")} value={stats.withEnglish} />
          <StatCard
            label={t("labels.withOlWorkKey")}
            value={stats.withOlWorkKey}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-mono text-xs tracking-wide text-muted-foreground uppercase">
          {t("sections.lists")}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label={t("labels.totalLists")} value={stats.totalLists} />
          <StatCard
            label={t("labels.listIsbnsTotal")}
            value={stats.listIsbnsTotal}
          />
          <StatCard
            label={t("labels.listIsbnsUnresolved")}
            value={stats.listIsbnsUnresolved}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-mono text-xs tracking-wide text-muted-foreground uppercase">
          {t("sections.recommendations")}
        </h2>
        {recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("allUpToDate")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recommendations.map((r) => (
              <ScriptRecommendation key={r.command} {...r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
