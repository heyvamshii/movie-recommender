import type { Catalog, Movie, NeighborList } from "./types";

type RawMovies = { movies: Movie[]; popular: number[] };
type RawNeighbors = { collaborative: number[][]; content: number[][] };

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

export function buildCatalog(moviesRaw: unknown, neighborsRaw: unknown): Catalog {
  if (!isObject(moviesRaw) || !Array.isArray(moviesRaw.movies) || !Array.isArray(moviesRaw.popular)) {
    fail("movies.json needs 'movies' and 'popular' arrays");
  }
  if (!isObject(neighborsRaw) || !Array.isArray(neighborsRaw.collaborative) || !Array.isArray(neighborsRaw.content)) {
    fail("neighbors.json needs 'collaborative' and 'content' arrays");
  }
  const { movies, popular } = moviesRaw as RawMovies;
  const neighbors = neighborsRaw as RawNeighbors;
  const n = movies.length;
  if (n === 0) fail("no movies");
  if (neighbors.collaborative.length !== n || neighbors.content.length !== n) {
    fail("neighbor tables do not match the movie list");
  }

  const mostLikes = Math.max(...movies.map((movie) => movie.likes));

  return {
    movies,
    popular,
    // same division as the Python pipeline, so scores match bit for bit
    popularity: movies.map((movie) => movie.likes / mostLikes),
    collaborative: parseNeighbors(neighbors.collaborative, true, n),
    content: parseNeighbors(neighbors.content, false, n),
    indexById: new Map(movies.map((movie, idx) => [movie.id, idx])),
  };
}

export const DATA_FILES = ["/data/movies.json", "/data/neighbors.json"] as const;

export async function fetchCatalog(fetcher: typeof fetch = fetch): Promise<Catalog> {
  const responses = await Promise.all(DATA_FILES.map((path) => fetcher(path)));
  responses.forEach((response, i) => {
    if (!response.ok) throw new Error(`Could not load ${DATA_FILES[i]} (HTTP ${response.status})`);
  });
  const [movies, neighbors] = await Promise.all(responses.map((response) => response.json()));
  return buildCatalog(movies, neighbors);
}
