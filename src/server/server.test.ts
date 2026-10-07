import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildFeed, isKnownMovie } from "./feed";
import { SEED_LIKES } from "./seed";
import { ConfigError, createToken, readToken, sessionSecret } from "./session";
import { FileStore, SupabaseStore, checkSupabaseUrl, explainSupabaseError, getStore } from "./store";
import { authenticate, findUser, verifyPassword } from "./users";

const SECRET = "x".repeat(40);
const AVENGERS = 89745;
const IRON_MAN = 59315;
const tempStore = async () => new FileStore(join(await mkdtemp(join(tmpdir(), "reelmatch-")), "likes.json"));

describe("demo accounts", () => {
  it("accepts the demo password and rejects anything else", () => {
    expect(authenticate("User1 ", "reelmatch-demo")).toEqual({ id: "user1", username: "user1", displayName: "user1" });
    expect(authenticate("user1", "wrong")).toBeNull();
    expect(authenticate("nobody", "reelmatch-demo")).toBeNull();
    expect(authenticate("user3", "")).toBeNull();
    expect(findUser("user9")).toBeNull();
  });

  it("refuses malformed hashes", () => {
    expect(verifyPassword("x", "md5$abc")).toBe(false);
    expect(verifyPassword("x", "scrypt$")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a user id until it expires", () => {
    const token = createToken("user2", SECRET, 1_000);
    expect(readToken(token, SECRET, 2_000)).toBe("user2");
    expect(readToken(token, SECRET, 1_000 + 8 * 24 * 3600 * 1000)).toBeNull();
  });

  it("rejects tampered, foreign-key and malformed tokens", () => {
    const token = createToken("user2", SECRET);
    expect(readToken(token.replace("user2", "user3"), SECRET)).toBeNull();
    expect(readToken(token, "y".repeat(40))).toBeNull();
    expect(readToken("a.b", SECRET)).toBeNull();
    expect(readToken(undefined, SECRET)).toBeNull();
    expect(readToken(`user2.soon.${token.split(".")[2]}`, SECRET)).toBeNull();
  });

  it("requires a long secret in production only", () => {
    expect(sessionSecret({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBeTruthy();
    expect(sessionSecret({ NODE_ENV: "production", SESSION_SECRET: SECRET } as NodeJS.ProcessEnv)).toBe(SECRET);
    expect(() => sessionSecret({ NODE_ENV: "production", SESSION_SECRET: "short" } as NodeJS.ProcessEnv)).toThrow(
      ConfigError,
    );
  });
});

describe("file store", () => {
  it("starts with the seed likes and saves, removes and clears likes", async () => {
    const store = await tempStore();
    expect((await store.listAll()).filter((row) => row.userId === "user3")).toHaveLength(SEED_LIKES.user3.length);
    await Promise.all([store.setLike("user1", AVENGERS, true), store.setLike("user1", IRON_MAN, true)]);
    await store.setLike("user1", AVENGERS, true); // liking twice keeps one row
    expect((await store.listAll()).filter((row) => row.userId === "user1").map((row) => row.movieId)).toEqual([
      IRON_MAN,
      AVENGERS,
    ]);
    await store.setLike("user1", IRON_MAN, false);
    await store.clear("user3");
    const rows = await store.listAll();
    expect(rows.filter((row) => row.userId === "user1").map((row) => row.movieId)).toEqual([AVENGERS]);
    expect(rows.some((row) => row.userId === "user3")).toBe(false);
  });

  it("ignores bad rows and recovers from a corrupt file", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "reelmatch-")), "likes.json");
    await writeFile(path, JSON.stringify([{ userId: "user1", movieId: 1 }, { userId: 5 }, "x"]));
    expect(await new FileStore(path).listAll()).toEqual([{ userId: "user1", movieId: 1 }]);
    await writeFile(path, "{oops");
    expect((await new FileStore(path).listAll()).length).toBeGreaterThan(0); // falls back to seeds
    await writeFile(path, '{"not":"a list"}');
    expect(await new FileStore(path).listAll()).toEqual([]);
  });

  it("chooses Supabase when configured, refuses to run on Vercel without it", () => {
    const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;
    expect(() => getStore(env({ VERCEL: "1" }))).toThrow(ConfigError);
    expect(getStore(env({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }))).toBeInstanceOf(
      SupabaseStore,
    );
  });
});

describe("supabase setup hints", () => {
  it("names the likely mistake without echoing secrets", () => {
    expect(explainSupabaseError({ code: "PGRST205", message: "Could not find the table 'public.likes'" }, "read").message).toMatch(/schema.sql/);
    expect(explainSupabaseError({ message: "Invalid API key" }, "read").message).toMatch(/SERVICE_ROLE_KEY/);
    expect(explainSupabaseError({ code: "42501", message: "permission denied for table likes" }, "read").message).toMatch(/anon/);
    expect(explainSupabaseError({ message: "TypeError: fetch failed" }, "read").message).toMatch(/SUPABASE_URL/);
    expect(explainSupabaseError({ message: "boom" }, "read")).not.toBeInstanceOf(ConfigError);
  });

  it("accepts the project URL and rejects the dashboard link or junk", () => {
    expect(checkSupabaseUrl("https://abcd.supabase.co/rest/v1/")).toBe("https://abcd.supabase.co");
    expect(() => checkSupabaseUrl("https://supabase.com/dashboard/project/abcd")).toThrow(/dashboard/);
    expect(() => checkSupabaseUrl("abcd")).toThrow(ConfigError);
  });
});

describe("seed data", () => {
  it("supabase/schema.sql inserts exactly the seed likes", async () => {
    const sql = await readFile(join(process.cwd(), "supabase", "schema.sql"), "utf-8");
    const inserted = [...sql.matchAll(/\('(\w+)', (\d+)\)/g)].map(([, user, movie]) => `${user}:${movie}`);
    const expected = Object.entries(SEED_LIKES).flatMap(([user, ids]) => ids.map((id) => `${user}:${id}`));
    expect(inserted.sort()).toEqual(expected.sort());
    for (const id of Object.values(SEED_LIKES).flat()) expect(isKnownMovie(id)).toBe(true);
  });
});

describe("personal feed", () => {
  it("is empty until the user likes something", async () => {
    expect(await buildFeed(await tempStore(), "user1")).toEqual({ likes: [], recs: [], matched: 0, appMatches: [] });
  });

  it("matches a superhero fan with user3 and recommends user3's other likes", async () => {
    const store = await tempStore();
    await store.setLike("user1", AVENGERS, true);
    const feed = await buildFeed(store, "user1");
    expect(feed.likes).toEqual([AVENGERS]);
    expect(feed.matched).toBeGreaterThan(1);
    expect(feed.appMatches[0]).toMatchObject({ name: "user3", shared: [AVENGERS] });
    expect(feed.recs).toHaveLength(10);
    expect(feed.recs.map((rec) => rec.movieId)).not.toContain(AVENGERS);
    expect(feed.recs.some((rec) => rec.appUsers.some((friend) => friend.name === "user3"))).toBe(true);
  });

  it("lets one account's new like reach another account's feed", async () => {
    const store = await tempStore();
    const INTERSTELLAR_FREE = 1; // Toy Story: liked by user2 only among app users
    await store.setLike("user1", 2671, true); // Notting Hill
    await store.setLike("user2", 2671, true);
    await store.setLike("user2", INTERSTELLAR_FREE, true);
    const feed = await buildFeed(store, "user1");
    const toyStory = feed.recs.find((rec) => rec.movieId === INTERSTELLAR_FREE);
    expect(feed.appMatches.map((match) => match.name)).toEqual(["user2", "user4"]);
    expect(toyStory?.appUsers.map((friend) => friend.name)).toContain("user2");
    expect(feed.recs[0].movieId).toBe(INTERSTELLAR_FREE); // the matching account's like comes first
  });

  it("validates movie ids", () => {
    expect(isKnownMovie(AVENGERS)).toBe(true);
    expect(isKnownMovie(-1)).toBe(false);
    expect(isKnownMovie("89745")).toBe(false);
    expect(isKnownMovie(1.5)).toBe(false);
  });
});
