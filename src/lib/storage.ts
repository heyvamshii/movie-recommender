/**
 * "Your" ratings live only in this browser (localStorage), keyed by MovieLens movieId so
 * they survive a pipeline re-run that reorders movie indexes.
 */
import type { Catalog, Profile } from "./types";

export const RATINGS_KEY = "reelmatch.ratings.v1";
export const ACTIVE_PROFILE_KEY = "reelmatch.profile.v1";

export type ActiveProfile = { kind: "you" } | { kind: "user"; user: number };

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private mode or blocked storage: start fresh
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage full or blocked: ratings still work for this visit
  }
}

export function isValidRating(value: unknown): value is number {
  return typeof value === "number" && value >= 0.5 && value <= 5 && Number.isInteger(value * 2);
}

export function loadRatings(catalog: Catalog): Profile {
  const profile: Profile = new Map();
  const raw = safeGet(RATINGS_KEY);
  if (!raw) return profile;
  try {
    const pairs: unknown = JSON.parse(raw);
    if (!Array.isArray(pairs)) return profile;
    for (const pair of pairs) {
      if (!Array.isArray(pair)) continue;
      const idx = catalog.indexById.get(pair[0]);
      if (idx !== undefined && isValidRating(pair[1])) profile.set(idx, pair[1]);
    }
  } catch {
    // corrupted value: ignore it
  }
  return profile;
}

export function saveRatings(profile: Profile, catalog: Catalog): void {
  const pairs = [...profile].map(([idx, rating]) => [catalog.movies[idx].id, rating]);
  safeSet(RATINGS_KEY, JSON.stringify(pairs));
}

export function loadActiveProfile(catalog: Catalog): ActiveProfile | null {
  const raw = safeGet(ACTIVE_PROFILE_KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const record = value as Record<string, unknown>;
    if (record.kind === "you") return { kind: "you" };
    if (record.kind === "user" && typeof record.user === "number" && catalog.users[record.user]) {
      return { kind: "user", user: record.user };
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveActiveProfile(profile: ActiveProfile): void {
  safeSet(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
}
