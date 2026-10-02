"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { HYBRID_HALF_POINT, hybridWeight, recommendAll } from "@/lib/recommend";
import { useCatalog } from "./CatalogProvider";
import { RecList } from "./RecList";
import { Poster, StarRating } from "./ui";

/** Quick tastes for a live demo, by MovieLens movieId (missing ids are skipped). */
const PRESETS: { label: string; movies: [number, number][] }[] = [
  { label: "Sci-fi fan", movies: [[2571, 5], [260, 5], [541, 5], [1214, 4], [589, 4]] },
  { label: "Rom-com fan", movies: [[2671, 5], [597, 5], [539, 4], [1307, 5], [1721, 4]] },
  { label: "Family & animation", movies: [[1, 5], [364, 5], [588, 4], [6377, 5], [4306, 4]] },
  { label: "Crime classics", movies: [[296, 5], [858, 5], [1213, 5], [608, 4], [50, 4]] },
];

const GRID_SIZE = 24;

export function TryView() {
  const { catalog, yourRatings, rate, setManyRatings, clearRatings, setActive } = useCatalog();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const lists = useMemo(() => recommendAll(yourRatings, catalog), [yourRatings, catalog]);

  const grid = useMemo(() => {
    if (!deferredQuery) return catalog.popular.slice(0, GRID_SIZE);
    return catalog.movies
      .map((movie, idx) => ({ movie, idx }))
      .filter(({ movie }) => movie.title.toLowerCase().includes(deferredQuery))
      .sort((a, b) => b.movie.likes - a.movie.likes)
      .slice(0, GRID_SIZE)
      .map(({ idx }) => idx);
  }, [catalog, deferredQuery]);

  const n = yourRatings.size;
  const alpha = hybridWeight(n);

  const applyPreset = (movies: [number, number][]) => {
    const pairs = movies.flatMap(([id, rating]): [number, number][] => {
      const idx = catalog.indexById.get(id);
      return idx === undefined ? [] : [[idx, rating]];
    });
    setManyRatings(pairs);
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-ink-3">Live demo</p>
        <h1 className="font-display text-4xl leading-tight sm:text-6xl">Start as a stranger. Rate five movies.</h1>
        <p className="mt-3 text-ink-2">
          Every list below is recomputed in your browser the moment you click a star. With no ratings, all three methods can
          only guess with popularity. That is the cold-start problem.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(340px,440px)_1fr]">
        {/* rating panel */}
        <section aria-label="Rate movies" className="xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
          <div className="rounded-2xl border border-line bg-surface-1 p-4">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.movies)}
                  className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink-2 transition hover:border-hybrid hover:text-ink"
                >
                  + {preset.label}
                </button>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="sr-only">Search movies</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search 2,269 movies…"
                className="w-full rounded-xl border border-line-strong bg-surface-2 px-4 py-2.5 text-sm outline-none transition placeholder:text-ink-3 focus:border-hybrid"
              />
            </label>
            <p className="mt-3 text-xs text-ink-3">
              {deferredQuery ? `${grid.length} matches` : "Most-liked movies. Search for anything else."}
            </p>
            <ul className="mt-3 grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 xl:grid-cols-3">
              {grid.map((idx) => {
                const movie = catalog.movies[idx];
                const rating = yourRatings.get(idx) ?? null;
                return (
                  <li key={idx} className="min-w-0">
                    <div
                      className={`overflow-hidden rounded-lg ring-1 transition ${rating ? "ring-2 ring-svd" : "ring-line"}`}
                    >
                      <Poster movie={movie} size="w185" />
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-xs font-medium" title={movie.title}>
                      {movie.title}
                    </p>
                    <StarRating
                      size="sm"
                      value={rating}
                      onChange={(value) => rate(idx, value)}
                      label={`Rate ${movie.title}`}
                    />
                  </li>
                );
              })}
            </ul>
            {grid.length === 0 && <p className="py-6 text-center text-sm text-ink-3">No movie title matches.</p>}
          </div>
        </section>

        {/* live results */}
        <section aria-label="Live recommendations" aria-live="polite">
          <div className="mb-5 rounded-2xl border border-line bg-surface-1 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                <span className="font-display text-3xl">{n}</span>{" "}
                <span className="text-ink-2">movie{n === 1 ? "" : "s"} rated</span>
              </p>
              <div className="flex gap-2">
                {n > 0 && (
                  <Link
                    href="/"
                    onClick={() => setActive({ kind: "you" })}
                    className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-bg transition hover:bg-white"
                  >
                    See your Browse page →
                  </Link>
                )}
                {n > 0 && (
                  <button
                    type="button"
                    onClick={clearRatings}
                    className="rounded-full border border-line-strong px-4 py-1.5 text-xs text-ink-2 transition hover:text-ink"
                  >
                    Reset to cold start
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4">
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full bg-collaborative transition-all duration-700" style={{ width: `${alpha * 100}%` }} />
                <div className="h-full flex-1 bg-gradient-to-r from-content to-popular" />
              </div>
              <p className="mt-2 text-xs text-ink-2">
                Hybrid mix: <span className="text-collaborative">■</span> {Math.round(alpha * 100)}% collaborative ·{" "}
                <span className="text-content">■</span>
                <span className="text-popular">■</span> {Math.round((1 - alpha) * 100)}% content + popularity.{" "}
                <span className="text-ink-3">It reaches 50/50 at {HYBRID_HALF_POINT} ratings.</span>
              </p>
            </div>
            {n === 0 && (
              <p className="mt-4 rounded-xl bg-popular/10 p-3 text-sm text-ink-2">
                <strong className="text-ink">Cold start.</strong> There is nothing to compare you with yet, so all three
                lists show the same popular movies. Rate one movie and they split apart.
              </p>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <RecList method="collaborative" recs={lists.collaborative} />
            <RecList method="content" recs={lists.content} />
            <RecList
              method="hybrid"
              recs={lists.hybrid}
              note={
                n < HYBRID_HALF_POINT
                  ? "While you are new it hedges with crowd favorites, which scored best in the cold-start test"
                  : undefined
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}
