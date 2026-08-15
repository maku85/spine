"use client";

import { useTranslations } from "next-intl";
import { SuggestionListSection } from "@/components/suggestion-list-section";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import type { SuggestedBook } from "@/lib/suggestions/read";

type SectionItem = {
  book: SuggestedBook;
  detail: string | number | null;
};

type Section = {
  key: string;
  label: string;
  items: SectionItem[];
};

function SectionGroup({
  sections,
  defaultVisible,
}: {
  sections: Section[];
  defaultVisible?: number;
}) {
  const t = useTranslations("Suggestions");

  if (sections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("emptyCategory")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {sections.map((section) => (
        <SuggestionListSection
          key={section.key}
          label={section.label}
          items={section.items}
          defaultVisible={defaultVisible}
        />
      ))}
    </div>
  );
}

export function SuggestionsTabs({
  nytSections,
  hardcoverSections,
  topRatedSection,
}: {
  nytSections: Section[];
  hardcoverSections: Section[];
  topRatedSection: Section;
}) {
  const t = useTranslations("Suggestions");

  return (
    <Tabs defaultValue="nyt">
      <TabsList>
        <TabsTab value="nyt">{t("tabs.nyt")}</TabsTab>
        <TabsTab value="hardcover">{t("tabs.hardcover")}</TabsTab>
        <TabsTab value="top-rated">{t("topRated")}</TabsTab>
      </TabsList>
      <TabsPanel value="nyt" className="mt-8">
        <SectionGroup sections={nytSections} />
      </TabsPanel>
      <TabsPanel value="hardcover" className="mt-8">
        <SectionGroup sections={hardcoverSections} />
      </TabsPanel>
      <TabsPanel value="top-rated" className="mt-8">
        <SectionGroup
          sections={topRatedSection.items.length > 0 ? [topRatedSection] : []}
          defaultVisible={topRatedSection.items.length}
        />
      </TabsPanel>
    </Tabs>
  );
}
