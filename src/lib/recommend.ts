/**
 * Live recommendations in the browser. A line-for-line port of pipeline/recsys/scoring.py:
 * the parity test (recommend.test.ts) checks both produce exactly the same top-10 lists.
 */
import { sharedFeatures } from "./explain";
import type { Catalog, Method, NeighborList, Profile, Reason, Recommendation, RecommendationSet } from "./types";

export const NEUTRAL_RATING = 3;
export const HYBRID_HALF_POINT = 5;
export const POPULARITY_PRIOR = 5;
export const TOP_N = 10;

export type ScoreEntry = { score: number; from: number; slot: number; best: number };

/** score(movie) = sum over rated movies of similarity x (rating - neutral) */
export function neighborScores(profile: Profile, table: NeighborList[], neutral = NEUTRAL_RATING) {
  const scores = new Map<number, ScoreEntry>();
  const rated = [...profile.keys()].sort((a, b) => a - b);
  for (const movie of rated) {
    const weight = profile.get(movie)! - neutral;
    if (weight === 0) continue;
    const { ids, sims } = table[movie];
    for (let slot = 0; slot < ids.length; slot++) {
      const candidate = ids[slot];
      if (profile.has(candidate)) continue;
      const contribution = sims[slot] * weight;
      const entry = scores.get(candidate);
      if (!entry) {
        scores.set(candidate, { score: 0 + contribution, from: movie, slot, best: contribution });
        continue;
      }
      entry.score = entry.score + contribution;
      if (contribution > entry.best) Object.assign(entry, { from: movie, slot, best: contribution });
    }
  }
  return scores;
}

export function hybridWeight(nRatings: number, halfPoint = HYBRID_HALF_POINT): number {
  return nRatings / (nRatings + halfPoint);
}

function maxPositive(scores: Map<number, ScoreEntry>): number {
  let max = 0;
  for (const { score } of scores.values()) if (score > max) max = score;
  return max;
}

export type HybridEntry = { score: number; parts: { collaborative: number; content: number; popular: number } };

/** alpha x collaborative + (1 - alpha) x (content + prior x popularity), parts scaled to 0..1 */
export function hybridScores(
  collab: Map<number, ScoreEntry>,
  content: Map<number, ScoreEntry>,
  nRatings: number,
  popularity: number[],
): Map<number, HybridEntry> {
  const alpha = hybridWeight(nRatings);
  const cold = 1 - alpha;
  const collabMax = maxPositive(collab);
  const contentMax = maxPositive(content);
  const combined = new Map<number, HybridEntry>();
  popularity.forEach((popularPart, item) => {
    const collabPart = collabMax > 0 ? (collab.get(item)?.score ?? 0) / collabMax : 0;
    const contentPart = contentMax > 0 ? (content.get(item)?.score ?? 0) / contentMax : 0;
    combined.set(item, {
      score: alpha * collabPart + cold * (contentPart + POPULARITY_PRIOR * popularPart),
      parts: {
        collaborative: alpha * collabPart,
        content: cold * contentPart,
        popular: cold * POPULARITY_PRIOR * popularPart,
      },
    });
  });
  return combined;
}

/** Highest positive scores first (ties -> lower index); pad with popular movies. */
export function rankTopN(
  scores: Map<number, { score: number }>,
  exclude: Set<number>,
  popularOrder: number[],
  n = TOP_N,
): number[] {
  const ranked = [...scores.entries()]
    .filter(([item, { score }]) => score > 0 && !exclude.has(item))
    .sort((a, b) => b[1].score - a[1].score || a[0] - b[0]);
  const chosen = ranked.slice(0, n).map(([item]) => item);
  const taken = new Set(chosen);
  for (const item of popularOrder) {
    if (chosen.length >= n) break;
    if (!exclude.has(item) && !taken.has(item)) {
      chosen.push(item);
      taken.add(item);
    }
  }
  return chosen;
}

function popularReason(catalog: Catalog, idx: number): Reason {
  return { kind: "popular", likes: catalog.movies[idx].likes };
}

function collabReason(catalog: Catalog, idx: number, entry: ScoreEntry | undefined): Reason {
  if (!entry || entry.score <= 0) return popularReason(catalog, idx);
  const support = catalog.collaborative[entry.from].support?.[entry.slot] ?? 0;
  return { kind: "collaborative", from: entry.from, support };
}

function contentReason(catalog: Catalog, idx: number, entry: ScoreEntry | undefined): Reason {
  if (!entry || entry.score <= 0) return popularReason(catalog, idx);
  return { kind: "content", from: entry.from, shared: sharedFeatures(catalog.movies[idx], catalog.movies[entry.from]) };
}

export function recommendAll(profile: Profile, catalog: Catalog, n = TOP_N): RecommendationSet {
  const exclude = new Set(profile.keys());
  const collab = neighborScores(profile, catalog.collaborative);
  const content = neighborScores(profile, catalog.content);
  const hybrid = hybridScores(collab, content, profile.size, catalog.popularity);

  const collaborative = rankTopN(collab, exclude, catalog.popular, n).map((idx) => ({
    idx,
    score: collab.get(idx)?.score ?? 0,
    reason: collabReason(catalog, idx, collab.get(idx)),
  }));
  const contentList = rankTopN(content, exclude, catalog.popular, n).map((idx) => ({
    idx,
    score: content.get(idx)?.score ?? 0,
    reason: contentReason(catalog, idx, content.get(idx)),
  }));
  const hybridList = rankTopN(hybrid, exclude, catalog.popular, n).map((idx): Recommendation => {
    const { score, parts } = hybrid.get(idx)!;
    const total = parts.collaborative + parts.content + parts.popular;
    const mix =
      total > 0
        ? { collaborative: parts.collaborative / total, content: parts.content / total, popular: parts.popular / total }
        : { collaborative: 0, content: 0, popular: 1 };
    const driver = (Object.keys(mix) as (keyof typeof mix)[]).reduce((a, b) => (mix[b] > mix[a] ? b : a));
    const reason =
      driver === "collaborative"
        ? collabReason(catalog, idx, collab.get(idx))
        : driver === "content"
          ? contentReason(catalog, idx, content.get(idx))
          : popularReason(catalog, idx);
    return { idx, score, reason, mix };
  });
  const popular = rankTopN(new Map(), exclude, catalog.popular, n).map((idx) => ({
    idx,
    score: 0,
    reason: popularReason(catalog, idx),
  }));

  return { collaborative, content: contentList, hybrid: hybridList, popular };
}

/** "Because you liked X": X's nearest neighbors in one table, skipping movies already rated. */
export function similarTo(
  movie: number,
  catalog: Catalog,
  method: Extract<Method, "collaborative" | "content">,
  exclude: Set<number>,
  n = TOP_N,
): Recommendation[] {
  const list = catalog[method][movie];
  const result: Recommendation[] = [];
  for (let slot = 0; slot < list.ids.length && result.length < n; slot++) {
    const idx = list.ids[slot];
    if (exclude.has(idx)) continue;
    const reason: Reason =
      method === "collaborative"
        ? { kind: "collaborative", from: movie, support: list.support?.[slot] ?? 0 }
        : { kind: "content", from: movie, shared: sharedFeatures(catalog.movies[idx], catalog.movies[movie]) };
    result.push({ idx, score: list.sims[slot], reason });
  }
  return result;
}

/** The profile's favorite movie: highest rating, then most liked overall. */
export function favoriteMovie(profile: Profile, catalog: Catalog, skip = new Set<number>()): number | null {
  let best: number | null = null;
  for (const [idx, rating] of profile) {
    if (skip.has(idx) || rating < 4) continue;
    if (
      best === null ||
      rating > profile.get(best)! ||
      (rating === profile.get(best)! && catalog.movies[idx].likes > catalog.movies[best].likes)
    ) {
      best = idx;
    }
  }
  return best;
}
