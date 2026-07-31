import { z } from "zod";

export const OLDocSchema = z.object({
  key: z.string(),
  title: z.string(),
  author_name: z.array(z.string()).optional(),
  isbn: z.array(z.string()).optional(),
  edition_key: z.array(z.string()).optional(),
  first_publish_year: z.number().optional(),
  edition_count: z.number().optional(),
});

export const OLSearchResponseSchema = z.object({
  docs: z.array(OLDocSchema),
});

export type OLDoc = z.infer<typeof OLDocSchema>;

export type OLSearchResult = {
  workKey: string;
  title: string;
  authors: string[];
  isbn: string | null;
  editionKey: string | null;
  firstPublishYear: number | null;
};
