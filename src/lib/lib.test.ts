import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCatalog, fetchCatalog, parseNeighbors } from "./catalog";
import { formatRuntime, formatYear, reasonText, sharedFeatures } from "./explain";
import { backdropUrl, genreGradient, posterUrl } from "./poster";
import { RATINGS_KEY, isValidRating, loadRatings, saveRatings } from "./storage";
import { makeMovie, makeTinyCatalog } from "./test-helpers";

const RAW_MOVIES = { movies: [makeMovie({ id: 1, likes: 4 }), makeMovie({ id: 2, likes: 2 })], popular: [0, 1] };
const RAW_NEIGHBORS = { collaborative: [[1, 0.5, 3], []], content: [[1, 0.25], []] };

describe("catalog parsing", () => {
  it("builds a catalog from the two data files", () => {
    const catalog = buildCatalog(RAW_MOVIES, RAW_NEIGHBORS);
    expect(catalog.popularity).toEqual([1, 0.5]);
    expect(catalog.collaborative[0]).toEqual({ ids: [1], sims: [0.5], support: [3] });
    expect(catalog.content[0]).toEqual({ ids: [1], sims: [0.25], support: null });
    expect(catalog.indexById.get(2)).toBe(1);
  });

  it("rejects malformed files with a clear message", () => {
    expect(() => buildCatalog({}, RAW_NEIGHBORS)).toThrow(/movies.json/);
    expect(() => buildCatalog(RAW_MOVIES, null)).toThrow(/neighbors.json/);
    expect(() => buildCatalog({ movies: [], popular: [] }, RAW_NEIGHBORS)).toThrow(/no movies/);
    expect(() => buildCatalog(RAW_MOVIES, { collaborative: [], content: [] })).toThrow(/do not match/);
    expect(() => parseNeighbors([[1, 0.5]], true, 2)).toThrow(/wrong length/);
    expect(() => parseNeighbors([[5, 0.5]], false, 2)).toThrow(/points to movie 5/);
  });

  it("fetches both files and reports HTTP errors", async () => {
    const files: Record<string, unknown> = {
      "/data/movies.json": RAW_MOVIES,
      "/data/neighbors.json": RAW_NEIGHBORS,
    };
    const ok = (async (path: string) => ({ ok: true, status: 200, json: async () => files[path] })) as unknown as typeof fetch;
    expect((await fetchCatalog(ok)).movies).toHaveLength(2);
    const missing = (async () => ({ ok: false, status: 404 })) as unknown as typeof fetch;
    await expect(fetchCatalog(missing)).rejects.toThrow(/HTTP 404/);
  });
});

describe("explanations", () => {
  const catalog = makeTinyCatalog();

  it("sharedFeatures puts specific matches before genres and caps at three", () => {
    const a = makeMovie({ directors: ["Ann"], cast: ["Bo"], keywords: ["heist", "robot"], genres: ["Drama"] });
    const b = makeMovie({ directors: ["ann"], cast: ["Bo"], keywords: ["Heist", "robot"], genres: ["Drama"] });
    expect(sharedFeatures(a, b)).toEqual(["Ann", "Bo", "heist"]);
    expect(sharedFeatures(a, makeMovie())).toEqual([]);
  });

  it("reasonText writes a headline and detail for every reason kind", () => {
    expect(reasonText({ kind: "collaborative", from: 0, support: 12 }, catalog)).toEqual({
      headline: "Because you liked Alpha",
      detail: "12 people rated both and liked them alike",
    });
    expect(reasonText({ kind: "content", from: 0, shared: ["Ann", "Sci-Fi"] }, catalog).detail).toBe(
      "Shares: Ann · Sci-Fi",
    );
    expect(reasonText({ kind: "content", from: 0, shared: [] }, catalog).detail).toBe("Similar description");
    expect(reasonText({ kind: "popular", likes: 80 }, catalog).headline).toBe("Popular pick");
  });

  it("formats years and runtimes", () => {
    expect(formatYear(makeMovie({ year: 1999 }))).toBe("1999");
    expect(formatYear(makeMovie({ year: null }))).toBe("");
    expect(formatRuntime(136)).toBe("2h 16m");
    expect(formatRuntime(45)).toBe("45m");
    expect(formatRuntime(null)).toBe("");
  });
});

describe("poster helpers", () => {
  it("builds TMDB image URLs and genre fallbacks", () => {
    expect(posterUrl("/a.jpg")).toBe("https://image.tmdb.org/t/p/w342/a.jpg");
    expect(posterUrl(null)).toBeNull();
    expect(backdropUrl("/b.jpg", "w780")).toBe("https://image.tmdb.org/t/p/w780/b.jpg");
    expect(backdropUrl(null)).toBeNull();
    expect(genreGradient(["Horror"])).toContain("#7a1414");
    expect(genreGradient(["Unknown"])).toContain("#4b4f5c");
  });
});

describe("storage", () => {
  const catalog = makeTinyCatalog();
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("saves ratings by MovieLens id and loads them back", () => {
    saveRatings(new Map([[1, 4.5]]), catalog);
    expect(JSON.parse(store[RATINGS_KEY])).toEqual([[20, 4.5]]);
    expect(loadRatings(catalog)).toEqual(new Map([[1, 4.5]]));
  });

  it("skips unknown movies, invalid ratings and corrupted data", () => {
    store[RATINGS_KEY] = JSON.stringify([[20, 4], [999, 5], [10, 7], [30, 2.25], "x"]);
    expect(loadRatings(catalog)).toEqual(new Map([[1, 4]]));
    store[RATINGS_KEY] = "{not json";
    expect(loadRatings(catalog).size).toBe(0);
    store[RATINGS_KEY] = '{"a":1}';
    expect(loadRatings(catalog).size).toBe(0);
  });

  it("validates ratings", () => {
    expect(isValidRating(0.5)).toBe(true);
    expect(isValidRating(5)).toBe(true);
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(3.3)).toBe(false);
    expect(isValidRating("4")).toBe(false);
  });


  it("keeps working when storage is blocked", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(loadRatings(catalog).size).toBe(0);
    expect(() => saveRatings(new Map([[0, 4]]), catalog)).not.toThrow();
  });
});
