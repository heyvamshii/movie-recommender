import { describe, expect, it } from "vitest";
import parity from "./__fixtures__/parity.json";
import {
  HYBRID_HALF_POINT,
  POPULARITY_PRIOR,
  favoriteMovie,
  hybridScores,
  hybridWeight,
  neighborScores,
  rankTopN,
  recommendAll,
  similarTo,
} from "./recommend";
import { loadRealCatalog, makeTinyCatalog } from "./test-helpers";
import type { Method, Profile } from "./types";

type ParityCase = { name: string; profile: [number, number][]; expected: Record<Method, number[]> };

describe("parity with the Python pipeline", () => {
  const catalog = loadRealCatalog();

  it.each(parity as ParityCase[])("$name gives the same four top-10 lists", ({ profile, expected }) => {
    const lists = recommendAll(new Map(profile), catalog);
    for (const method of Object.keys(expected) as Method[]) {
      expect(lists[method].map((rec) => rec.idx), method).toEqual(expected[method]);
    }
  });
});

describe("neighborScores", () => {
  const catalog = makeTinyCatalog();

  it("weights similarity by how far the rating is above neutral", () => {
    const scores = neighborScores(new Map([[0, 5]]), catalog.collaborative);
    expect(scores.get(1)?.score).toBeCloseTo(1.6);
    expect(scores.get(2)?.score).toBeCloseTo(0.8);
  });

  it("pushes neighbors of disliked movies down and ignores neutral ratings", () => {
    expect(neighborScores(new Map([[3, 1]]), catalog.collaborative).get(2)?.score).toBeCloseTo(-1);
    expect(neighborScores(new Map([[0, 3]]), catalog.collaborative).size).toBe(0);
  });

  it("remembers which rated movie contributed most", () => {
    const scores = neighborScores(
      new Map([
        [0, 4],
        [3, 5],
      ]),
      catalog.collaborative,
    );
    // movie 2: 0.4 x 1 from movie 0, 0.5 x 2 from movie 3
    expect(scores.get(2)).toMatchObject({ from: 3, slot: 0 });
    expect(scores.get(2)?.score).toBeCloseTo(1.4);
  });
});

describe("hybrid", () => {
  it("weight grows with the number of ratings", () => {
    expect(hybridWeight(0)).toBe(0);
    expect(hybridWeight(HYBRID_HALF_POINT)).toBe(0.5);
    expect(hybridWeight(10, 10)).toBe(0.5);
  });

  it("is pure popularity for a brand-new user", () => {
    const scores = hybridScores(new Map(), new Map(), 0, [0.5, 1]);
    expect(scores.get(1)?.score).toBe(POPULARITY_PRIOR);
    expect(scores.get(0)?.parts).toEqual({ collaborative: 0, content: 0, popular: POPULARITY_PRIOR / 2 });
  });
});

describe("rankTopN", () => {
  it("sorts by score, breaks ties by index and pads with popular movies", () => {
    const scores = new Map([
      [4, { score: 0.5 }],
      [2, { score: 0.9 }],
      [3, { score: 0.5 }],
      [5, { score: -1 }],
    ]);
    expect(rankTopN(scores, new Set([9]), [9, 3, 7, 8], 5)).toEqual([2, 3, 4, 7, 8]);
  });
});

describe("recommendAll explanations", () => {
  const catalog = makeTinyCatalog();
  const lists = recommendAll(new Map([[0, 5]]), catalog, 3);

  it("never recommends a movie the person already rated", () => {
    for (const recs of Object.values(lists)) expect(recs.map((rec) => rec.idx)).not.toContain(0);
  });

  it("collaborative picks name the movie and how many people rated both", () => {
    expect(lists.collaborative[0]).toMatchObject({ idx: 1, reason: { kind: "collaborative", from: 0, support: 12 } });
  });

  it("content picks list the shared features", () => {
    expect(lists.content[0].reason).toEqual({ kind: "content", from: 0, shared: ["Ann", "Sci-Fi"] });
  });

  it("padding falls back to a popular reason", () => {
    expect(lists.collaborative[2]).toMatchObject({ idx: 3, reason: { kind: "popular", likes: 1 } });
  });

  it("hybrid picks carry a mix that sums to 1", () => {
    for (const rec of lists.hybrid) {
      const mix = rec.mix!;
      expect(mix.collaborative + mix.content + mix.popular).toBeCloseTo(1);
    }
  });
});

describe("row helpers", () => {
  const catalog = makeTinyCatalog();

  it("similarTo lists a movie's neighbors, skipping excluded ones", () => {
    expect(similarTo(2, catalog, "collaborative", new Set([3])).map((rec) => rec.idx)).toEqual([0]);
    expect(similarTo(0, catalog, "content", new Set())[0].reason).toMatchObject({ kind: "content", from: 0 });
  });

  it("favoriteMovie picks the highest rating, then the most liked", () => {
    const profile: Profile = new Map([
      [1, 5],
      [2, 5],
      [3, 3],
    ]);
    expect(favoriteMovie(profile, catalog)).toBe(2);
    expect(favoriteMovie(profile, catalog, new Set([2]))).toBe(1);
    expect(favoriteMovie(new Map([[3, 3.5]]), catalog)).toBeNull();
  });
});
