import type { Catalog, Method, Movie, Reason } from "./types";

const MAX_SHARED = 3;

function overlap(a: string[], b: string[]): string[] {
  const other = new Set(b.map((value) => value.toLowerCase()));
  return a.filter((value) => other.has(value.toLowerCase()));
}

/** What two movies have in common, most specific first (director beats genre). */
export function sharedFeatures(a: Movie, b: Movie): string[] {
  const shared = [
    ...overlap(a.directors, b.directors),
    ...overlap(a.cast, b.cast),
    ...overlap(a.keywords, b.keywords),
    ...overlap(a.tags, b.tags),
    ...overlap(a.genres, b.genres),
  ];
  return [...new Set(shared)].slice(0, MAX_SHARED);
}

export type ReasonText = { headline: string; detail: string };

export function reasonText(reason: Reason, catalog: Catalog): ReasonText {
  switch (reason.kind) {
    case "collaborative": {
      const from = catalog.movies[reason.from].title;
      return {
        headline: `Because you liked ${from}`,
        detail: `${reason.support} people rated both, and fans of one tend to like the other`,
      };
    }
    case "content": {
      const from = catalog.movies[reason.from].title;
      return {
        headline: `Similar to ${from}`,
        detail: reason.shared.length > 0 ? `Shares: ${reason.shared.join(" · ")}` : "Similar description",
      };
    }
    case "popular":
      return { headline: "Popular pick", detail: `Liked by ${reason.likes} MovieLens users` };
  }
}

export const METHOD_LABEL: Record<Method | "svd", string> = {
  collaborative: "Collaborative",
  content: "Content-based",
  hybrid: "Hybrid",
  popular: "Popular",
  svd: "SVD (matrix factorization)",
};

export const METHOD_TAGLINE: Record<Method, string> = {
  collaborative: "People with your taste also liked",
  content: "Matches what you already like",
  hybrid: "Both blended, plus popularity while you are new",
  popular: "What most people liked",
};

export function formatYear(movie: Movie): string {
  return movie.year ? String(movie.year) : "";
}

export function formatRuntime(minutes: number | null): string {
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}
