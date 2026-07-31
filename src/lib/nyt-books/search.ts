"use server";

import { NytReviewsResponseSchema } from "./types";

export type NytReview = {
  url: string;
  summary: string | null;
  byline: string | null;
};

// Optional enrichment: a link to an actual New York Times book review, when
// one exists (the API only returns a short editorial summary + link — NYT
// doesn't give away the full review text, and we shouldn't republish it
// anyway). Coverage is sparse: only a fraction of books, mostly notable
// ones, ever got a NYT review. Requires NYT_BOOKS_API_KEY; without one, or
// when no review is found, this quietly returns null.
export async function fetchNytReview({
  isbn,
  title,
  authors,
}: {
  isbn: string | null;
  title: string;
  authors: string[];
}): Promise<NytReview | null> {
  const apiKey = process.env.NYT_BOOKS_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({ "api-key": apiKey });
  if (isbn) {
    params.set("isbn", isbn);
  } else {
    params.set("title", title);
    if (authors[0]) params.set("author", authors[0]);
  }

  try {
    const res = await fetch(
      `https://api.nytimes.com/svc/books/v3/reviews.json?${params.toString()}`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return null;

    const json = await res.json();
    const parsed = NytReviewsResponseSchema.safeParse(json);
    const review = parsed.success ? parsed.data.results?.[0] : undefined;
    if (!review) return null;

    return {
      url: review.url,
      summary: review.summary ?? null,
      byline: review.byline ?? null,
    };
  } catch {
    return null;
  }
}
