"use client";

import { useState } from "react";
import { METHOD_LABEL } from "@/lib/explain";
import { genreGradient, posterUrl, type PosterSize } from "@/lib/poster";
import type { EvalMethod, Movie } from "@/lib/types";

const METHOD_DOT: Record<EvalMethod, string> = {
  collaborative: "bg-collaborative",
  content: "bg-content",
  hybrid: "bg-hybrid",
  popular: "bg-popular",
  svd: "bg-svd",
};

/** Method identity = colored dot + text label, never color alone. */
export function MethodBadge({ method, short = false }: { method: EvalMethod; short?: boolean }) {
  const label = short && method === "svd" ? "SVD" : METHOD_LABEL[method];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/80 px-2 py-0.5 text-[11px] font-medium tracking-wide text-ink-2 backdrop-blur">
      <span className={`size-1.5 rounded-full ${METHOD_DOT[method]}`} aria-hidden />
      {label}
    </span>
  );
}

export function MethodDot({ method }: { method: EvalMethod }) {
  return <span className={`inline-block size-2 shrink-0 rounded-full ${METHOD_DOT[method]}`} aria-hidden />;
}

/** TMDB poster, or a genre-tinted title card when there is none (or it fails to load). */
export function Poster({
  movie,
  size = "w342",
  className = "",
}: {
  movie: Movie;
  size?: PosterSize;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = posterUrl(movie.poster, size);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- TMDB already serves sized images
      <img
        src={src}
        alt={`${movie.title} poster`}
        loading="lazy"
        decoding="async"
        width={342}
        height={513}
        onError={() => setFailed(true)}
        className={`aspect-[2/3] w-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex aspect-[2/3] w-full flex-col justify-end p-3 ${className}`}
      style={{ background: genreGradient(movie.genres) }}
      role="img"
      aria-label={`${movie.title} (no poster)`}
    >
      <span className="font-display text-lg leading-tight text-white/95">{movie.title}</span>
      <span className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/60">{movie.genres[0] ?? "Film"}</span>
    </div>
  );
}

const STARS = [1, 2, 3, 4, 5];

/**
 * Click a star to rate; click the same star again to clear. Arrow keys move the rating.
 */
export function StarRating({
  value,
  onChange,
  size = "md",
  label,
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
  size?: "sm" | "md";
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const box = size === "sm" ? "size-6 text-base" : "size-9 text-2xl";
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center"
      onMouseLeave={() => setHover(null)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          onChange(Math.min(5, Math.floor(value ?? 0) + 1));
        } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          const next = Math.ceil(value ?? 0) - 1;
          onChange(next >= 1 ? next : null);
        }
      }}
    >
      {STARS.map((star) => {
        const filled = shown >= star;
        const half = !filled && shown >= star - 0.5;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value !== null && Math.ceil(value) === star}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            tabIndex={(value === null && star === 1) || (value !== null && Math.ceil(value) === star) ? 0 : -1}
            onMouseEnter={() => setHover(star)}
            onClick={(event) => {
              event.stopPropagation();
              onChange(value === star ? null : star);
            }}
            className={`${box} grid place-items-center leading-none transition-transform duration-150 hover:scale-115 active:scale-95`}
          >
            <span
              className={filled ? "text-svd" : half ? "text-svd/60" : "text-white/20"}
              aria-hidden
            >
              ★
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 max-w-3xl">
      {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-ink-3">{eyebrow}</p>}
      <h2 className="font-display text-3xl leading-tight sm:text-4xl">{title}</h2>
      {children && <div className="mt-3 text-ink-2">{children}</div>}
    </div>
  );
}
