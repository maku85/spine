import { z } from "zod";

export const NytReviewSchema = z.object({
  url: z.string(),
  byline: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
});

export const NytReviewsResponseSchema = z.object({
  results: z.array(NytReviewSchema).optional(),
});
