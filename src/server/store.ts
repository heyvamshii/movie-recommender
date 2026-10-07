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

export class SupabaseStore implements LikeStore {
  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<LikeRow[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("user_id, movie_id")
      .order("created_at", { ascending: true })
      .limit(10000);
    if (error) throw new Error(`Could not read likes: ${error.message}`);
    return (data ?? []).map((row) => ({ userId: String(row.user_id), movieId: Number(row.movie_id) }));
  }

  async setLike(userId: string, movieId: number, liked: boolean): Promise<void> {
    const { error } = liked
      ? await this.client.from(TABLE).upsert({ user_id: userId, movie_id: movieId }, { ignoreDuplicates: true })
      : await this.client.from(TABLE).delete().eq("user_id", userId).eq("movie_id", movieId);
    if (error) throw new Error(`Could not save like: ${error.message}`);
  }

  async clear(userId: string): Promise<void> {
    const { error } = await this.client.from(TABLE).delete().eq("user_id", userId);
    if (error) throw new Error(`Could not clear likes: ${error.message}`);
  }
}

let cached: LikeStore | null = null;

export function getStore(env: NodeJS.ProcessEnv = process.env): LikeStore {
  if (cached) return cached;
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) {
    cached = new SupabaseStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
  } else if (env.VERCEL) {
    throw new ConfigError("The likes database is not connected yet (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  } else {
    cached = new FileStore(join(process.cwd(), "data", "app-likes.json"));
  }
  return cached;
}
