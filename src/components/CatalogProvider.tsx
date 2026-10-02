"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchCatalog } from "@/lib/catalog";
import {
  loadActiveProfile,
  loadRatings,
  saveActiveProfile,
  saveRatings,
  type ActiveProfile,
} from "@/lib/storage";
import type { Catalog, Profile, Recommendation } from "@/lib/types";
import { MovieModal } from "./MovieModal";

type OpenMovie = { idx: number; rec?: Recommendation };

type CatalogState = {
  catalog: Catalog;
  yourRatings: Profile;
  rate: (idx: number, rating: number | null) => void;
  setManyRatings: (ratings: [number, number][]) => void;
  clearRatings: () => void;
  active: ActiveProfile;
  setActive: (profile: ActiveProfile) => void;
  /** ratings of whoever is selected in the header */
  activeRatings: Profile;
  activeLabel: string;
  openMovie: (idx: number, rec?: Recommendation) => void;
};

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
  const [yourRatings, setYourRatings] = useState<Profile>(() => loadRatings(catalog));
  const [active, setActiveState] = useState<ActiveProfile>(
    () => loadActiveProfile(catalog) ?? { kind: "user", user: catalog.featured[0] ?? 0 },
  );
  const [open, setOpen] = useState<OpenMovie | null>(null);

  // persist after every change; updaters below always build on the latest state
  useEffect(() => saveRatings(yourRatings, catalog), [yourRatings, catalog]);

  const rate = useCallback((idx: number, rating: number | null) => {
    setYourRatings((previous) => {
      const next = new Map(previous);
      if (rating === null) next.delete(idx);
      else next.set(idx, rating);
      return next;
    });
  }, []);

  const setManyRatings = useCallback((ratings: [number, number][]) => {
    setYourRatings((previous) => new Map([...previous, ...ratings]));
  }, []);

  const setActive = useCallback((profile: ActiveProfile) => {
    setActiveState(profile);
    saveActiveProfile(profile);
  }, []);

  const value = useMemo<CatalogState>(() => {
    const activeRatings = active.kind === "you" ? yourRatings : catalog.users[active.user].ratings;
    const activeLabel = active.kind === "you" ? "You" : `MovieLens user ${catalog.users[active.user].id}`;
    return {
      catalog,
      yourRatings,
      rate,
      setManyRatings,
      clearRatings: () => setYourRatings(new Map()),
      active,
      setActive,
      activeRatings,
      activeLabel,
      openMovie: (idx, rec) => setOpen({ idx, rec }),
    };
  }, [catalog, yourRatings, rate, setManyRatings, active, setActive]);

  return (
    <CatalogContext.Provider value={value}>
      {children}
      {open && <MovieModal idx={open.idx} rec={open.rec} onClose={() => setOpen(null)} />}
    </CatalogContext.Provider>
  );
}

function LoadingScreen() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-8" aria-busy="true" aria-live="polite">
      <p className="mb-6 text-sm text-ink-3">Loading 2,269 movies and their similarity tables…</p>
      <div className="skeleton mb-10 h-[46vh] rounded-2xl" />
      {[0, 1].map((row) => (
        <div key={row} className="mb-8">
          <div className="skeleton mb-4 h-5 w-56 rounded" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="skeleton aspect-[2/3] w-40 shrink-0 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center" role="alert">
      <p className="font-display text-4xl">The projector jammed.</p>
      <p className="mt-4 text-ink-2">The recommendation data could not be loaded.</p>
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
