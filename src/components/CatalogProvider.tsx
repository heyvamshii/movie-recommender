"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchCatalog } from "@/lib/catalog";
import { loadRatings, saveRatings } from "@/lib/storage";
import type { Catalog, Profile, Recommendation } from "@/lib/types";
import { MovieModal } from "./MovieModal";

type CatalogState = {
  catalog: Catalog;
  /** movie idx -> rating; a "love" pick is a 5-star rating */
  picks: Profile;
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

/** Loads the data once and shows loading / error screens until it is ready. */
export function CatalogProvider({ children }: { children: ReactNode }) {
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
  return <ReadyProvider catalog={catalog}>{children}</ReadyProvider>;
}

function ReadyProvider({ catalog, children }: { catalog: Catalog; children: ReactNode }) {
  const [picks, setPicks] = useState<Profile>(() => loadRatings(catalog));
  const [open, setOpen] = useState<{ idx: number; rec?: Recommendation } | null>(null);

  // persist after every change; updaters below always build on the latest state
  useEffect(() => saveRatings(picks, catalog), [picks, catalog]);

  const togglePick = useCallback((idx: number) => {
    setPicks((previous) => {
      const next = new Map(previous);
      if (next.has(idx)) next.delete(idx);
      else next.set(idx, LOVE_RATING);
      return next;
    });
  }, []);

  const removeLastPick = useCallback(() => {
    setPicks((previous) => new Map([...previous].slice(0, -1)));
  }, []);

  const value = useMemo<CatalogState>(
    () => ({
      catalog,
      picks,
      togglePick,
      removeLastPick,
      clearPicks: () => setPicks(new Map()),
      openMovie: (idx, rec) => setOpen({ idx, rec }),
    }),
    [catalog, picks, togglePick, removeLastPick],
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
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((col) => (
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
