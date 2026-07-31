import { z } from "zod";

// Verified against a live API response: field names are lowercase and
// differ from what the published docs describe (they document
// "Similar.Results[].Name/wTeaser"; the actual response is
// "similar.results[].name/description").
export const TasteDiveResultSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
});

export const TasteDiveResponseSchema = z.object({
  similar: z.object({
    results: z.array(TasteDiveResultSchema).optional(),
  }),
});
