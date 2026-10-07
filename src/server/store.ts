/**
 * Where likes are saved. Production: a Supabase Postgres table, reached only from the server
 * with the service-role key (row level security blocks everyone else). Local development
 * without Supabase: a JSON file in data/ (gitignored).
 */
import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SEED_LIKES } from "./seed";
import { ConfigError } from "./session";

export type LikeRow = { userId: string; movieId: number };

export interface LikeStore {
  /** Every like of every user, oldest first. */
  listAll(): Promise<LikeRow[]>;
  setLike(userId: string, movieId: number, liked: boolean): Promise<void>;
  clear(userId: string): Promise<void>;
}

export class FileStore implements LikeStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly path: string) {}

  private async read(): Promise<LikeRow[]> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.path, "utf-8"));
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (row): row is LikeRow => typeof row?.userId === "string" && Number.isInteger(row?.movieId),
      );
    } catch {
      return Object.entries(SEED_LIKES).flatMap(([userId, ids]) => ids.map((movieId) => ({ userId, movieId })));
    }
  }

  private async write(rows: LikeRow[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(rows, null, 1), "utf-8");
  }

  /** Serialize read-modify-write so two quick clicks cannot overwrite each other. */
  private update(change: (rows: LikeRow[]) => LikeRow[]): Promise<void> {
    const next = this.queue.then(async () => this.write(change(await this.read())));
    this.queue = next.catch(() => undefined);
    return next;
  }

  listAll(): Promise<LikeRow[]> {
    return this.queue.then(() => this.read());
  }

  setLike(userId: string, movieId: number, liked: boolean): Promise<void> {
    return this.update((rows) => {
      const others = rows.filter((row) => !(row.userId === userId && row.movieId === movieId));
      return liked ? [...others, { userId, movieId }] : others;
    });
  }

  clear(userId: string): Promise<void> {
    return this.update((rows) => rows.filter((row) => row.userId !== userId));
  }
}

const TABLE = "likes";

type SupabaseError = { message?: string; code?: string; details?: string | null; hint?: string | null };

/**
 * Turn a Supabase failure into a setup hint the owner can act on (never includes a key).
 * These become ConfigErrors, which the page shows in its banner.
 */
export function explainSupabaseError(error: SupabaseError, action: string): Error {
  const text = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  if (error.code === "PGRST205" || error.code === "42P01" || text.includes("could not find the table")) {
    return new ConfigError("Database setup: the 'likes' table does not exist. Run supabase/schema.sql in the Supabase SQL Editor.");
  }
  if (text.includes("invalid api key") || text.includes("jwt") || text.includes("unauthorized") || error.code === "401") {
    return new ConfigError("Database setup: SUPABASE_SERVICE_ROLE_KEY is not a valid secret / service_role key for this project.");
  }
  if (error.code === "42501" || text.includes("permission denied") || text.includes("row-level security")) {
    return new ConfigError("Database setup: access denied. Use the secret / service_role key, not the anon or publishable key.");
  }
  if (text.includes("fetch failed") || text.includes("enotfound") || text.includes("failed to fetch")) {
    return new ConfigError("Database setup: cannot reach SUPABASE_URL. It must look like https://<project-id>.supabase.co");
  }
  return new Error(`Could not ${action}: ${error.message ?? "unknown error"}`);
}

/** SUPABASE_URL must be the API address, e.g. https://abcd.supabase.co (not the dashboard link). */
export function checkSupabaseUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConfigError("Database setup: SUPABASE_URL is not a valid address. It must look like https://<project-id>.supabase.co");
  }
  if (parsed.hostname.endsWith("supabase.com")) {
    throw new ConfigError("Database setup: SUPABASE_URL is the dashboard link. Use the Project URL https://<project-id>.supabase.co");
  }
  return parsed.origin;
}

export class SupabaseStore implements LikeStore {
  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<LikeRow[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("user_id, movie_id")
      .order("created_at", { ascending: true })
      .limit(10000);
    if (error) throw explainSupabaseError(error, "read likes");
    return (data ?? []).map((row) => ({ userId: String(row.user_id), movieId: Number(row.movie_id) }));
  }

  async setLike(userId: string, movieId: number, liked: boolean): Promise<void> {
    const { error } = liked
      ? await this.client.from(TABLE).upsert({ user_id: userId, movie_id: movieId }, { ignoreDuplicates: true })
      : await this.client.from(TABLE).delete().eq("user_id", userId).eq("movie_id", movieId);
    if (error) throw explainSupabaseError(error, "save like");
  }

  async clear(userId: string): Promise<void> {
    const { error } = await this.client.from(TABLE).delete().eq("user_id", userId);
    if (error) throw explainSupabaseError(error, "clear likes");
  }
}

let cached: LikeStore | null = null;

export function getStore(env: NodeJS.ProcessEnv = process.env): LikeStore {
  if (cached) return cached;
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) {
    cached = new SupabaseStore(createClient(checkSupabaseUrl(url), key, { auth: { persistSession: false, autoRefreshToken: false } }));
  } else if (env.VERCEL) {
    throw new ConfigError("The likes database is not connected yet (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  } else {
    cached = new FileStore(join(process.cwd(), "data", "app-likes.json"));
  }
  return cached;
}
