"use client";

import { useState } from "react";
import { genreGradient, posterUrl, type PosterSize } from "@/lib/poster";
import type { Method, Movie } from "@/lib/types";

const METHOD_DOT: Record<Method, string> = {
  collaborative: "bg-collaborative",
  content: "bg-content",
  hybrid: "bg-hybrid",
  popular: "bg-popular",
  userbased: "bg-userbased",
};

export function MethodDot({ method }: { method: Method }) {
  return <span className={`inline-block size-2.5 shrink-0 rounded-full ${METHOD_DOT[method]}`} aria-hidden />;
}

/** TMDB poster, or a genre-tinted title card when there is none (or it fails to load). */
export function Poster({ movie, size = "w342", className = "" }: { movie: Movie; size?: PosterSize; className?: string }) {
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
      className={`flex aspect-[2/3] w-full flex-col justify-end p-2 ${className}`}
      style={{ background: genreGradient(movie.genres) }}
      role="img"
      aria-label={`${movie.title} (no poster)`}
    >
      <span className="font-display text-sm leading-tight text-white/95">{movie.title}</span>
    </div>
  );
}
