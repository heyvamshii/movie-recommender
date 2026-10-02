import type { Catalog, Movie, MovieLensUser, NeighborList } from "./types";

type RawMovies = { movies: Movie[]; popular: number[] };
type RawNeighbors = { collaborative: number[][]; content: number[][] };
type RawUsers = { users: { id: number; ratings: number[]; liked: number[] }[]; featured: number[] };

function fail(message: string): never {
  throw new Error(`Bad data file: ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** [idx, sim, support, idx, sim, support, ...] or [idx, sim, idx, sim, ...] */
export function parseNeighbors(rows: number[][], withSupport: boolean, nMovies: number): NeighborList[] {
  const stride = withSupport ? 3 : 2;
  return rows.map((flat, movie) => {
    if (!Array.isArray(flat) || flat.length % stride !== 0) fail(`neighbor row ${movie} has the wrong length`);
    const ids: number[] = [];
    const sims: number[] = [];
    const support: number[] = [];
    for (let i = 0; i < flat.length; i += stride) {
      const id = flat[i];
      if (!Number.isInteger(id) || id < 0 || id >= nMovies) fail(`neighbor row ${movie} points to movie ${id}`);
      ids.push(id);
      sims.push(flat[i + 1]);
      if (withSupport) support.push(flat[i + 2]);
    }
    return { ids, sims, support: withSupport ? support : null };
  });
}

/** [idx, rating, idx, rating, ...] -> Map */
export function parsePairs(flat: number[], nMovies: number): Map<number, number> {
  const pairs = new Map<number, number>();
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const idx = flat[i];
    if (!Number.isInteger(idx) || idx < 0 || idx >= nMovies) fail(`rating points to movie ${idx}`);
    pairs.set(idx, flat[i + 1]);
  }
  return pairs;
}

export function buildCatalog(moviesRaw: unknown, neighborsRaw: unknown, usersRaw: unknown): Catalog {
  if (!isObject(moviesRaw) || !Array.isArray(moviesRaw.movies) || !Array.isArray(moviesRaw.popular)) {
    fail("movies.json needs 'movies' and 'popular' arrays");
  }
  if (!isObject(neighborsRaw) || !Array.isArray(neighborsRaw.collaborative) || !Array.isArray(neighborsRaw.content)) {
    fail("neighbors.json needs 'collaborative' and 'content' arrays");
  }
  if (!isObject(usersRaw) || !Array.isArray(usersRaw.users) || !Array.isArray(usersRaw.featured)) {
    fail("users.json needs 'users' and 'featured' arrays");
  }
  const { movies, popular } = moviesRaw as RawMovies;
  const neighbors = neighborsRaw as RawNeighbors;
  const usersFile = usersRaw as RawUsers;
  const n = movies.length;
  if (n === 0) fail("no movies");
  if (neighbors.collaborative.length !== n || neighbors.content.length !== n) {
    fail("neighbor tables do not match the movie list");
  }

  const mostLikes = Math.max(...movies.map((movie) => movie.likes));
  const users: MovieLensUser[] = usersFile.users.map((user) => ({
    id: user.id,
    ratings: parsePairs(user.ratings, n),
    liked: parsePairs(user.liked, n),
  }));

  return {
    movies,
    popular,
    // same division as the Python pipeline, so scores match bit for bit
    popularity: movies.map((movie) => movie.likes / mostLikes),
    collaborative: parseNeighbors(neighbors.collaborative, true, n),
    content: parseNeighbors(neighbors.content, false, n),
    users,
    featured: usersFile.featured.filter((idx) => idx >= 0 && idx < users.length),
    indexById: new Map(movies.map((movie, idx) => [movie.id, idx])),
  };
}

export const DATA_FILES = ["/data/movies.json", "/data/neighbors.json", "/data/users.json"] as const;

export async function fetchCatalog(fetcher: typeof fetch = fetch): Promise<Catalog> {
  const responses = await Promise.all(DATA_FILES.map((path) => fetcher(path)));
  responses.forEach((response, i) => {
    if (!response.ok) throw new Error(`Could not load ${DATA_FILES[i]} (HTTP ${response.status})`);
  });
  const [movies, neighbors, users] = await Promise.all(responses.map((response) => response.json()));
  return buildCatalog(movies, neighbors, users);
}
