import { z } from "zod";

export const GoogleBooksVolumeSchema = z.object({
  volumeInfo: z.object({
    description: z.string().optional(),
    categories: z.array(z.string()).optional(),
    averageRating: z.number().optional(),
    ratingsCount: z.number().optional(),
  }),
});

export const GoogleBooksResponseSchema = z.object({
  items: z.array(GoogleBooksVolumeSchema).optional(),
});
