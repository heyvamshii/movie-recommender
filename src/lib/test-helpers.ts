import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCatalog } from "./catalog";
import type { Catalog, Movie } from "./types";

const DATA_DIR = join(process.cwd(), "public", "data");

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(join(DATA_DIR, name), "utf-8"));
}

let cached: Catalog | null = null;

/** The real exported catalog, as the browser would load it. */
export function loadRealCatalog(): Catalog {
  cached ??= buildCatalog(readJson("movies.json"), readJson("neighbors.json"), readJson("users.json"));
  return cached;
}

export function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 1,
    title: "Movie",
    year: 2000,
    genres: [],
    poster: null,
    backdrop: null,
    overview: "",
    runtime: null,
    directors: [],
    cast: [],
    keywords: [],
    tags: [],
    ratings: 10,
    likes: 5,
    avg: 4,
    tmdb: null,
    ...overrides,
  };
}

/**
 * 4 movies. Movie 0 is similar to 1 (0.8) and 2 (0.4); movie 3 to 2 (0.5).
 * Same neighbor tables for both methods keep the arithmetic easy to follow.
 */
export function makeTinyCatalog(): Catalog {
  const movies = [
    makeMovie({ id: 10, title: "Alpha", genres: ["Sci-Fi"], directors: ["Ann"], likes: 4 }),
    makeMovie({ id: 20, title: "Beta", genres: ["Sci-Fi"], directors: ["Ann"], likes: 2 }),
    makeMovie({ id: 30, title: "Gamma", genres: ["Drama"], likes: 8 }),
    makeMovie({ id: 40, title: "Delta", genres: ["Drama"], likes: 1 }),
  ];
  const neighbors = [
    { ids: [1, 2], sims: [0.8, 0.4], support: [12, 5] },
    { ids: [0], sims: [0.8], support: [12] },
    { ids: [3, 0], sims: [0.5, 0.4], support: [7, 5] },
    { ids: [2], sims: [0.5], support: [7] },
  ];
  return {
    movies,
    popular: [2, 0, 1, 3],
    popularity: movies.map((movie) => movie.likes / 8),
    collaborative: neighbors,
    content: neighbors.map(({ ids, sims }) => ({ ids, sims, support: null })),
    users: [{ id: 7, ratings: new Map([[0, 5]]), liked: new Map([[1, 4.5]]) }],
    featured: [0],
    indexById: new Map(movies.map((movie, idx) => [movie.id, idx])),
  };
}
