import { describe, expect, it } from "vitest";
import { similarPeople, userBasedRecs, type Person } from "./userBased";

const person = (id: string, likes: number[], name: string | null = null): Person => ({ id, name, likes: new Set(likes) });

describe("user-based filtering", () => {
  // same case as pipeline/tests/test_userbased.py, so both implementations agree
  const people = [person("a", [1, 2, 3]), person("b", [1, 4], "user2"), person("c", [5]), person("d", [])];
  const mine = new Set([1, 2]);

  it("scores people by shared likes / sqrt(my likes x their likes) and skips strangers", () => {
    const matches = similarPeople(mine, people);
    expect(matches.map((match) => match.person.id)).toEqual(["a", "b"]);
    expect(matches[0].similarity).toBeCloseTo(2 / Math.sqrt(6));
    expect(matches[1].similarity).toBeCloseTo(0.5);
    expect(matches[1].shared).toEqual([1]);
  });

  it("keeps only the k most similar people, ties by id", () => {
    const tied = [person("z", [1]), person("y", [1])];
    expect(similarPeople(new Set([1]), tied, 1).map((match) => match.person.id)).toEqual(["y"]);
  });

  it("recommends what similar people liked, naming app users", () => {
    const recs = userBasedRecs(mine, similarPeople(mine, people));
    expect(recs.map((rec) => rec.movieId)).toEqual([3, 4]);
    expect(recs[0].score).toBeCloseTo(2 / Math.sqrt(6));
    expect(recs[1]).toMatchObject({ supporters: 1, appUsers: [{ name: "user2", shared: [1] }] });
  });

  it("lets weighted people (site accounts) count more", () => {
    const weighted = [person("a", [1, 3]), person("b", [1, 4], "user2")].map((p) =>
      p.name ? { ...p, weight: 5 } : p,
    );
    expect(userBasedRecs(new Set([1]), similarPeople(new Set([1]), weighted)).map((rec) => rec.movieId)).toEqual([4, 3]);
  });

  it("returns nothing when nobody shares a like", () => {
    expect(userBasedRecs(new Set([9]), similarPeople(new Set([9]), people))).toEqual([]);
  });
});
