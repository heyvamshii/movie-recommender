"use client";

import { reasonText } from "@/lib/explain";
import type { Method, Recommendation } from "@/lib/types";
import { useCatalog } from "./CatalogProvider";
import { MethodBadge, Poster } from "./ui";

/** Poster card for the horizontal rows: badge says which method, caption says why. */
export function MovieCard({
  idx,
  rec,
  method,
  ratingShown,
}: {
  idx: number;
  rec?: Recommendation;
  method?: Method;
  ratingShown?: number;
}) {
  const { catalog, openMovie } = useCatalog();
  const movie = catalog.movies[idx];
  const why = rec ? reasonText(rec.reason, catalog) : null;
  return (
    <button
      type="button"
      onClick={() => openMovie(idx, rec)}
      className="group relative w-[42vw] max-w-44 shrink-0 snap-start text-left sm:w-44"
      aria-label={`${movie.title}${why ? `. ${why.headline}` : ""}`}
    >
      <div className="relative overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line transition duration-300 ease-[var(--ease-out-expo)] group-hover:-translate-y-1 group-hover:ring-line-strong group-hover:shadow-[0_18px_40px_-12px_rgb(0_0_0/0.8)]">
        <Poster movie={movie} className="transition duration-500 group-hover:scale-[1.03]" />
        {method && (
          <div className="absolute left-2 top-2">
            <MethodBadge method={method} />
          </div>
        )}
        {ratingShown !== undefined && (
          <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-svd">
            ★ {ratingShown}
          </div>
        )}
        {why && (
          <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-3 pt-10 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
            <p className="text-[11px] leading-snug text-ink-2">{why.detail}</p>
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-medium text-ink">{movie.title}</p>
      <p className="line-clamp-2 text-xs leading-snug text-ink-3">
        {why ? why.headline : [movie.year, movie.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
      </p>
    </button>
  );
}
