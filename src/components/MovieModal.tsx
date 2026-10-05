"use client";

import { useEffect, useRef } from "react";
import { formatRuntime, reasonText } from "@/lib/explain";
import { backdropUrl } from "@/lib/poster";
import type { Recommendation } from "@/lib/types";
import { useCatalog } from "./CatalogProvider";
import { Poster } from "./ui";

export function MovieModal({ idx, rec, onClose }: { idx: number; rec?: Recommendation; onClose: () => void }) {
  const { catalog, picks, togglePick } = useCatalog();
  const loved = picks.has(idx);
  const dialog = useRef<HTMLDialogElement>(null);
  const movie = catalog.movies[idx];
  const why = rec ? reasonText(rec.reason, catalog) : null;
  const backdrop = backdropUrl(movie.backdrop, "w1280");

  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  const facts = [movie.year, formatRuntime(movie.runtime), movie.genres.join(", ")].filter(Boolean);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && dialog.current?.close()}
      aria-labelledby="movie-modal-title"
      className="m-auto max-h-[92vh] w-[min(920px,calc(100vw-24px))] overflow-y-auto rounded-2xl bg-surface-1 p-0 text-ink ring-1 ring-line-strong"
    >
      <div className="relative">
        <div className="relative h-44 sm:h-64">
          {backdrop ? (
            // eslint-disable-next-line @next/next/no-img-element -- TMDB serves sized images
            <img src={backdrop} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-surface-3" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-surface-1/40 to-transparent" />
        </div>
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          aria-label="Close"
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/60 text-lg text-white transition hover:bg-black/85"
        >
          ✕
        </button>
        <div className="relative -mt-24 flex flex-col gap-6 px-5 pb-7 sm:-mt-32 sm:flex-row sm:px-8">
          <div className="w-32 shrink-0 overflow-hidden rounded-lg shadow-2xl ring-1 ring-line-strong sm:w-48">
            <Poster movie={movie} size="w500" />
          </div>
          <div className="min-w-0 flex-1 sm:pt-28">
            <h2 id="movie-modal-title" className="font-display text-3xl leading-tight sm:text-4xl">
              {movie.title}
            </h2>
            <p className="mt-1 text-sm text-ink-3">{facts.join(" · ")}</p>

            {why && (
              <div className="mt-4 rounded-xl border border-hybrid/30 bg-hybrid/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-hybrid">Why it was recommended</p>
                <p className="mt-1 font-medium">{why.headline}</p>
                <p className="text-sm text-ink-2">{why.detail}</p>
                {rec?.mix && <MixBar mix={rec.mix} />}
              </div>
            )}

            {movie.overview && <p className="mt-4 leading-relaxed text-ink-2">{movie.overview}</p>}

            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {movie.directors.length > 0 && (
                <>
                  <dt className="text-ink-3">Director</dt>
                  <dd>{movie.directors.join(", ")}</dd>
                </>
              )}
              {movie.cast.length > 0 && (
                <>
                  <dt className="text-ink-3">Starring</dt>
                  <dd>{movie.cast.join(", ")}</dd>
                </>
              )}
              <dt className="text-ink-3">MovieLens</dt>
              <dd>
                {movie.avg !== null ? `★ ${movie.avg.toFixed(1)} average from ${movie.ratings} ratings` : "No ratings"}
              </dd>
              {movie.keywords.length > 0 && (
                <>
                  <dt className="text-ink-3">Keywords</dt>
                  <dd className="text-ink-2">{movie.keywords.slice(0, 6).join(", ")}</dd>
                </>
              )}
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-5">
              <button
                type="button"
                onClick={() => togglePick(idx)}
                aria-pressed={loved}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition active:scale-[0.97] ${
                  loved ? "bg-hybrid text-white hover:brightness-110" : "bg-ink text-bg hover:bg-white"
                }`}
              >
                {loved ? "♥ In your picks (click to remove)" : "♥ I love this movie"}
              </button>
              {movie.tmdb && (
                <a
                  href={`https://www.themoviedb.org/movie/${movie.tmdb}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-sm text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink"
                >
                  View on TMDB ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}

export function MixBar({ mix }: { mix: NonNullable<Recommendation["mix"]> }) {
  const parts = [
    { key: "collaborative", label: "Collaborative", value: mix.collaborative, color: "bg-collaborative" },
    { key: "content", label: "Content", value: mix.content, color: "bg-content" },
    { key: "popular", label: "Popularity", value: mix.popular, color: "bg-popular" },
  ];
  return (
    <div className="mt-3">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {parts.map((part) =>
          part.value > 0 ? (
            <div key={part.key} className={`${part.color} h-full`} style={{ width: `${part.value * 100}%` }} />
          ) : null,
        )}
      </div>
      <p className="mt-1.5 text-xs text-ink-2">
        Hybrid score made of{" "}
        {parts
          .filter((part) => part.value >= 0.005)
          .map((part) => `${part.label.toLowerCase()} ${Math.round(part.value * 100)}%`)
          .join(" · ")}
      </p>
    </div>
  );
}
