/** Helpers for the live demo: what changed after a click, and how to say it in one line. */
import { reasonText } from "./explain";
import type { BaseRecommendationSet, Catalog, Recommendation } from "./types";

export type Change = { kind: "new" } | { kind: "up"; by: number } | { kind: "down"; by: number } | { kind: "same" };

/** Compare a top-10 list with the one shown before the last click. */
export function listChanges(previous: number[] | null, next: number[]): { changes: Map<number, Change>; changed: number } {
  const changes = new Map<number, Change>();
  if (previous === null) {
    next.forEach((idx) => changes.set(idx, { kind: "same" }));
    return { changes, changed: 0 };
  }
  const before = new Map(previous.map((idx, rank) => [idx, rank]));
  let changed = 0;
  next.forEach((idx, rank) => {
    const old = before.get(idx);
    if (old === undefined) {
      changes.set(idx, { kind: "new" });
      changed++;
    } else if (old > rank) {
      changes.set(idx, { kind: "up", by: old - rank });
    } else if (old < rank) {
      changes.set(idx, { kind: "down", by: rank - old });
    } else {
      changes.set(idx, { kind: "same" });
    }
  });
  return { changes, changed };
}

/** Well-known movies to click, mixing genres so the demo can show very different tastes. */
export function pickerMovies(catalog: Catalog, count: number, perGenre = 2): number[] {
  const perFirstGenre = new Map<string, number>();
  const chosen: number[] = [];
  for (const idx of catalog.popular) {
    if (chosen.length >= count) break;
    const genre = catalog.movies[idx].genres[0] ?? "Other";
    const used = perFirstGenre.get(genre) ?? 0;
    if (used >= perGenre) continue;
    perFirstGenre.set(genre, used + 1);
    chosen.push(idx);
  }
  return chosen;
}

export type Mix = { personal: number; popular: number };

/** How much of the hybrid's top 10 comes from your picks vs from overall popularity. */
export function hybridMix(recs: Recommendation[]): Mix {
  if (recs.length === 0) return { personal: 0, popular: 1 };
  const popular = recs.reduce((sum, rec) => sum + (rec.mix?.popular ?? 1), 0) / recs.length;
  return { personal: 1 - popular, popular };
}

export type Story = { collaborative: string; content: string; hybrid: string };

/** One plain sentence per method about the movie just picked. */
export function pickStory(pick: number, lists: BaseRecommendationSet, catalog: Catalog): Story {
  const title = catalog.movies[pick].title;
  const fromPick = (recs: Recommendation[]) =>
    recs.find((rec) => (rec.reason.kind === "collaborative" || rec.reason.kind === "content") && rec.reason.from === pick);

  const collab = fromPick(lists.collaborative);
  const content = fromPick(lists.content);
  const mix = hybridMix(lists.hybrid);
  return {
    collaborative: collab
      ? `People who loved ${title} also loved ${catalog.movies[collab.idx].title}.`
      : `${title} has no strong fan overlap with the current list yet.`,
    content: content
      ? `${catalog.movies[content.idx].title} is similar to ${title}: ${reasonText(content.reason, catalog).detail.replace("Shares: ", "")}.`
      : `No close look-alikes for ${title} made the top 10.`,
    hybrid: `Now ${Math.round(mix.personal * 100)}% based on your picks, ${Math.round(mix.popular * 100)}% on what is popular.`,
  };
}

export type FeedLike = {
  recs: { movieId: number; supporters: number; appUsers: { name: string; shared: number[] }[] }[];
  matched: number;
  appMatches: { name: string; shared: number[] }[];
};

/** Server feed (movieIds) -> recommendations the columns can show. */
export function feedRecommendations(feed: FeedLike, catalog: Catalog): Recommendation[] {
  const toIdx = (ids: number[]) => ids.flatMap((id) => catalog.indexById.get(id) ?? []);
  return feed.recs.flatMap((rec) => {
    const idx = catalog.indexById.get(rec.movieId);
    if (idx === undefined) return [];
    const friend = rec.appUsers[0];
    return [
      {
        idx,
        score: rec.supporters,
        reason: {
          kind: "userbased" as const,
          supporters: rec.supporters,
          friend: friend ? { name: friend.name, shared: toIdx(friend.shared) } : null,
        },
      },
    ];
  });
}

/** "Matched with 41 people who share your likes, including user3 (2 shared likes: The Avengers, Iron Man)." */
export function peopleStory(feed: FeedLike, catalog: Catalog): string {
  if (feed.matched === 0) return "Nobody shares your likes yet. Like a few more movies.";
  const people = `Matched with ${feed.matched} ${feed.matched === 1 ? "person who shares" : "people who share"} your likes`;
  const friend = feed.appMatches[0];
  if (!friend) return `${people}.`;
  const titles = friend.shared.flatMap((id) => {
    const idx = catalog.indexById.get(id);
    return idx === undefined ? [] : [catalog.movies[idx].title];
  });
  const count = `${friend.shared.length} shared like${friend.shared.length === 1 ? "" : "s"}`;
  return `${people}, including ${friend.name} (${count}: ${titles.slice(0, 2).join(", ")}).`;
}
