"use client";

import { METHOD_LABEL, METHOD_TAGLINE, reasonText } from "@/lib/explain";
import type { Method, Recommendation } from "@/lib/types";
import { useCatalog } from "./CatalogProvider";
import { MethodDot, Poster } from "./ui";

/**
 * One method's top-10 as a ranked column. When `hits` is given (a MovieLens user's hidden
 * test ratings), movies the user really liked are marked, like a live precision@10.
 */
export function RecList({
  method,
  recs,
  hits,
  note,
}: {
  method: Method;
  recs: Recommendation[];
  hits?: Map<number, number>;
  note?: string;
}) {
  const { catalog, openMovie } = useCatalog();
  const hitCount = hits ? recs.filter((rec) => hits.has(rec.idx)).length : null;
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface-1" aria-label={METHOD_LABEL[method]}>
      <header className="border-b border-line px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-semibold">
            <MethodDot method={method} />
            {METHOD_LABEL[method]}
          </h3>
          {hitCount !== null && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                hitCount > 0 ? "bg-good/15 text-good" : "bg-surface-3 text-ink-3"
              }`}
            >
              {hitCount}/{recs.length} hits
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-ink-3">{note ?? METHOD_TAGLINE[method]}</p>
      </header>
      <ol className="flex flex-col p-2">
        {recs.map((rec, rank) => {
          const movie = catalog.movies[rec.idx];
          const why = reasonText(rec.reason, catalog);
          const hit = hits?.get(rec.idx);
          return (
            <li key={rec.idx} className="rise-in" style={{ animationDelay: `${rank * 25}ms` }}>
              <button
                type="button"
                onClick={() => openMovie(rec.idx, rec)}
                className="flex w-full items-start gap-3 rounded-xl p-2 text-left transition hover:bg-surface-2"
              >
                <span className="w-4 shrink-0 pt-1 text-right font-mono text-xs text-ink-3">{rank + 1}</span>
                <div className="w-11 shrink-0 overflow-hidden rounded-md ring-1 ring-line">
                  <Poster movie={movie} size="w185" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">
                    {movie.title} <span className="font-normal text-ink-3">{movie.year}</span>
                  </p>
                  <p className="line-clamp-1 text-xs text-ink-2">{why.headline}</p>
                  <p className="line-clamp-1 text-xs text-ink-3">{why.detail}</p>
                  {hit !== undefined && (
                    <p className="mt-1 inline-flex items-center gap-1 rounded bg-good/15 px-1.5 py-0.5 text-[11px] font-semibold text-good">
                      ✓ Hidden rating: ★ {hit}
                    </p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
