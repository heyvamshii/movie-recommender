"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { fetchCatalog } from "@/lib/catalog";
import type { Catalog, Profile, Recommendation } from "@/lib/types";
import type { Feed } from "@/server/feed";
import { MovieModal } from "./MovieModal";

export type SessionInfo = { user: { id: string; displayName: string }; feed: Feed };

type CatalogState = {
  catalog: Catalog;
  user: SessionInfo["user"];
  /** movie idx -> rating; a "love" pick is a 5-star rating. Order = order liked. */
  picks: Profile;
  /** server-computed "people like you" feed for the signed-in user */
  feed: Feed;
  saving: boolean;
  error: string | null;
  togglePick: (idx: number) => void;
  removeLastPick: () => void;
  clearPicks: () => void;
  openMovie: (idx: number, rec?: Recommendation) => void;
};

export const LOVE_RATING = 5;

const CatalogContext = createContext<CatalogState | null>(null);

export function useCatalog(): CatalogState {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("useCatalog must be used inside CatalogProvider");
  return value;
}

/** Loads the movie data once, then hands the signed-in user's likes and feed to the page. */
export function CatalogProvider({ session, children }: { session: SessionInfo; children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCatalog()
      .then((loaded) => !cancelled && setCatalog(loaded))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <LoadError message={error} />;
  if (!catalog) return <LoadingScreen />;
  return (
    <ReadyProvider catalog={catalog} session={session}>
      {children}
    </ReadyProvider>
  );
}

function picksFrom(movieIds: number[], catalog: Catalog): Profile {
  const picks: Profile = new Map();
  for (const id of movieIds) {
    const idx = catalog.indexById.get(id);
    if (idx !== undefined) picks.set(idx, LOVE_RATING);
  }
  return picks;
}

class SignedOutError extends Error {}

async function send(method: "POST" | "DELETE", body?: unknown): Promise<Feed> {
  const response = await fetch("/api/likes", {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as Feed & { error?: string };
  if (response.status === 401) throw new SignedOutError(data.error ?? "Please sign in again.");
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}

function ReadyProvider({ catalog, session, children }: { catalog: Catalog; session: SessionInfo; children: ReactNode }) {
  const [picks, setPicks] = useState<Profile>(() => picksFrom(session.feed.likes, catalog));
  const [feed, setFeed] = useState<Feed>(session.feed);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ idx: number; rec?: Recommendation } | null>(null);
  const latestRequest = useRef(0);
  const router = useRouter();

  /** Optimistic update, then trust the server's answer (only the newest request wins). */
  const sync = useCallback(
    (optimistic: (previous: Profile) => Profile, request: () => Promise<Feed>) => {
      const id = ++latestRequest.current;
      let before: Profile | null = null;
      setPicks((previous) => {
        before = previous;
        return optimistic(previous);
      });
      setSaving(true);
      setError(null);
      request()
        .then((next) => {
          if (id !== latestRequest.current) return;
          setFeed(next);
          setPicks(picksFrom(next.likes, catalog));
        })
        .catch((err: unknown) => {
          if (id !== latestRequest.current) return;
          if (err instanceof SignedOutError) {
            router.push("/login");
            router.refresh(); // re-render the layout so the signed-out header shows
          }
          if (before) setPicks(before);
          setError(err instanceof Error ? err.message : "Could not save. Please try again.");
        })
        .finally(() => id === latestRequest.current && setSaving(false));
    },
    [catalog, router],
  );

  const togglePick = useCallback(
    (idx: number) => {
      const liked = !picks.has(idx);
      sync(
        (previous) => {
          const next = new Map(previous);
          if (liked) next.set(idx, LOVE_RATING);
          else next.delete(idx);
          return next;
        },
        () => send("POST", { movieId: catalog.movies[idx].id, liked }),
      );
    },
    [picks, sync, catalog],
  );

  const removeLastPick = useCallback(() => {
    const last = [...picks.keys()].at(-1);
    if (last !== undefined) togglePick(last);
  }, [picks, togglePick]);

  const clearPicks = useCallback(() => sync(() => new Map(), () => send("DELETE")), [sync]);

  const value = useMemo<CatalogState>(
    () => ({
      catalog,
      user: session.user,
      picks,
      feed,
      saving,
      error,
      togglePick,
      removeLastPick,
      clearPicks,
      openMovie: (idx, rec) => setOpen({ idx, rec }),
    }),
    [catalog, session.user, picks, feed, saving, error, togglePick, removeLastPick, clearPicks],
  );

  return (
    <CatalogContext.Provider value={value}>
      {children}
      {open && <MovieModal key={open.idx} idx={open.idx} rec={open.rec} onClose={() => setOpen(null)} />}
    </CatalogContext.Provider>
  );
}

function LoadingScreen() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-8" aria-busy="true" aria-live="polite">
      <p className="mb-6 text-sm text-ink-3">Loading 2,269 movies…</p>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="skeleton aspect-[2/3] w-28 shrink-0 rounded-lg" />
        ))}
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((col) => (
          <div key={col} className="skeleton h-96 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center" role="alert">
      <p className="font-display text-4xl">The projector jammed.</p>
      <p className="mt-4 text-ink-2">The movie data could not be loaded.</p>
      <p className="mt-2 font-mono text-xs text-ink-3">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-8 rounded-full bg-hybrid px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
      >
        Try again
      </button>
    </div>
  );
}
