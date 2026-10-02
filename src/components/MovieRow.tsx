"use client";

import { useRef, type ReactNode } from "react";
import type { Method, Recommendation } from "@/lib/types";
import { MovieCard } from "./MovieCard";
import { MethodDot } from "./ui";

export function MovieRow({
  title,
  subtitle,
  method,
  recs,
  ratings,
}: {
  title: ReactNode;
  subtitle?: string;
  method?: Method;
  recs: Recommendation[] | { idx: number }[];
  /** show the profile's own star rating on each card instead of a method badge */
  ratings?: Map<number, number>;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  if (recs.length === 0) return null;

  const scroll = (direction: 1 | -1) => {
    const el = scroller.current;
    el?.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="rise-in mb-10">
      <div className="mb-3 flex items-end justify-between gap-4 px-4 sm:px-8">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
            {method && <MethodDot method={method} />}
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          {([-1, 1] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => scroll(direction)}
              aria-label={direction < 0 ? "Scroll left" : "Scroll right"}
              className="grid size-8 place-items-center rounded-full border border-line text-ink-2 transition hover:border-line-strong hover:bg-surface-2 hover:text-ink"
            >
              {direction < 0 ? "‹" : "›"}
            </button>
          ))}
        </div>
      </div>
      <div ref={scroller} className="scroll-row flex scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:scroll-px-8 sm:gap-4 sm:px-8">
        {recs.map((rec) => (
          <MovieCard
            key={rec.idx}
            idx={rec.idx}
            rec={"reason" in rec ? rec : undefined}
            method={ratings ? undefined : method}
            ratingShown={ratings?.get(rec.idx)}
          />
        ))}
      </div>
    </section>
  );
}
