/**
 * A logged-in user's personal data: their likes and the user-based "people like you" feed,
 * matched against all 610 MovieLens users plus every other ReelMatch account.
 */
import "server-only";
import { similarPeople, userBasedRecs, type Person } from "@/lib/userBased";
import movielens from "./movielens-likes.json";
import type { LikeStore } from "./store";
import { DEMO_USERNAMES, findUser } from "./users";

export type FeedMatch = { name: string; shared: number[]; similarity: number };
export type Feed = {
  likes: number[];
  recs: { movieId: number; supporters: number; appUsers: { name: string; shared: number[] }[] }[];
  /** total similar people found, and the ReelMatch accounts among them */
  matched: number;
  appMatches: FeedMatch[];
};

/** Accounts on this site are the live community, so their likes count more than 2018 MovieLens users. */
export const APP_USER_WEIGHT = 5;

const KNOWN_MOVIES = new Set<number>(movielens.movieIds);
const MOVIELENS_PEOPLE: Person[] = movielens.users.map((likes, index) => ({
  id: `movielens-${index + 1}`,
  name: null,
  likes: new Set(likes),
}));

export function isKnownMovie(movieId: unknown): movieId is number {
  return typeof movieId === "number" && Number.isInteger(movieId) && KNOWN_MOVIES.has(movieId);
}

export async function buildFeed(store: LikeStore, userId: string): Promise<Feed> {
  const rows = await store.listAll();
  const byUser = new Map<string, number[]>();
  for (const { userId: owner, movieId } of rows) {
    if (!KNOWN_MOVIES.has(movieId)) continue;
    byUser.set(owner, [...(byUser.get(owner) ?? []), movieId]);
  }
  const likes = byUser.get(userId) ?? [];
  const mine = new Set(likes);
  if (mine.size === 0) return { likes, recs: [], matched: 0, appMatches: [] };

  const appPeople: Person[] = DEMO_USERNAMES.filter((name) => name !== userId).map((name) => ({
    id: name,
    name: findUser(name)?.displayName ?? name,
    likes: new Set(byUser.get(name) ?? []),
    weight: APP_USER_WEIGHT,
  }));
  // every overlapping account on the site always takes part, plus the closest MovieLens users
  const appMatches = similarPeople(mine, appPeople, appPeople.length);
  const matches = [...appMatches, ...similarPeople(mine, MOVIELENS_PEOPLE)];
  return {
    likes,
    recs: userBasedRecs(mine, matches).map(({ movieId, supporters, appUsers }) => ({ movieId, supporters, appUsers })),
    matched: matches.length,
    appMatches: appMatches.map((match) => ({ name: match.person.name!, shared: match.shared, similarity: match.similarity })),
  };
}
