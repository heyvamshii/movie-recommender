import { describe, expect, it } from "vitest";
import { hybridMix, listChanges, pickStory, pickerMovies } from "./demo";
import { recommendAll } from "./recommend";
import { loadRealCatalog, makeTinyCatalog } from "./test-helpers";
import type { Recommendation } from "./types";

describe("listChanges", () => {
  it("reports nothing before the first click", () => {
    const { changes, changed } = listChanges(null, [1, 2]);
    expect(changed).toBe(0);
    expect(changes.get(1)).toEqual({ kind: "same" });
  });

  it("marks new movies and how far others moved", () => {
    const { changes, changed } = listChanges([1, 2, 3, 4], [3, 1, 9, 2]);
    expect(changed).toBe(1);
    expect(changes.get(9)).toEqual({ kind: "new" });
    expect(changes.get(3)).toEqual({ kind: "up", by: 2 });
    expect(changes.get(1)).toEqual({ kind: "down", by: 1 });
    expect(changes.get(2)).toEqual({ kind: "down", by: 2 });
    expect(listChanges([5, 6], [5, 6]).changes.get(6)).toEqual({ kind: "same" });
  });
});

describe("pickerMovies", () => {
  it("takes popular movies but limits how many share a first genre", () => {
    const catalog = makeTinyCatalog(); // popular order 2, 0, 1, 3 -> Drama, Sci-Fi, Sci-Fi, Drama
    expect(pickerMovies(catalog, 4, 1)).toEqual([2, 0]);
    expect(pickerMovies(catalog, 3, 2)).toEqual([2, 0, 1]);
  });

  it("gives a varied, well-known set on the real data", () => {
    const catalog = loadRealCatalog();
    const picks = pickerMovies(catalog, 30);
    expect(picks).toHaveLength(30);
    expect(new Set(picks.map((idx) => catalog.movies[idx].genres[0])).size).toBeGreaterThanOrEqual(10);
  });
});

describe("hybridMix", () => {
  it("averages the popular share of the hybrid list", () => {
    const recs = [
      { idx: 0, score: 1, reason: { kind: "popular", likes: 1 }, mix: { collaborative: 0.2, content: 0.2, popular: 0.6 } },
      { idx: 1, score: 1, reason: { kind: "popular", likes: 1 }, mix: { collaborative: 0, content: 0, popular: 1 } },
    ] satisfies Recommendation[];
    expect(hybridMix(recs).popular).toBeCloseTo(0.8);
    expect(hybridMix(recs).personal).toBeCloseTo(0.2);
    expect(hybridMix([])).toEqual({ personal: 0, popular: 1 });
  });
});

describe("pickStory", () => {
  it("names a fan-overlap pick and a look-alike for the movie just picked", () => {
    const catalog = makeTinyCatalog();
    const story = pickStory(0, recommendAll(new Map([[0, 5]]), catalog), catalog);
    expect(story.collaborative).toBe("People who loved Alpha also loved Beta.");
    expect(story.content).toBe("Beta is similar to Alpha: Ann · Sci-Fi.");
    expect(story.hybrid).toMatch(/^Now \d+% based on your picks, \d+% on what is popular\.$/);
  });

  it("says so when the pick drives nothing in a list", () => {
    const catalog = makeTinyCatalog();
    const lists = recommendAll(new Map(), catalog);
    const story = pickStory(3, lists, catalog);
    expect(story.collaborative).toContain("no strong fan overlap");
    expect(story.content).toContain("No close look-alikes");
  });
});
