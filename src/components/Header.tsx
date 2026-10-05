"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Live demo" },
  { href: "/results", label: "Which is best?" },
];

export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-8">
        <Link href="/" className="flex items-baseline gap-2" aria-label="ReelMatch home">
          <span className="font-display text-2xl leading-none tracking-tight">
            Reel<span className="text-hybrid">Match</span>
          </span>
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.25em] text-ink-3 md:inline">
            Recommender lab
          </span>
        </Link>
        <nav aria-label="Main" className="ml-auto flex gap-1">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${
                  active ? "bg-surface-3 font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}


export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-8 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="max-w-2xl leading-relaxed">
          Ratings from{" "}
          <a href="https://grouplens.org/datasets/movielens/" className="underline underline-offset-2 hover:text-ink-2">
            MovieLens
          </a>{" "}
          (GroupLens Research, University of Minnesota). Movie details and images from TMDB. This product uses the TMDB
          API but is not endorsed or certified by TMDB.
        </p>
        <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- official TMDB attribution logo */}
          <img
            src="https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
            alt="TMDB"
            width={120}
            height={10}
            className="h-3 w-auto"
          />
        </a>
      </div>
    </footer>
  );
}
