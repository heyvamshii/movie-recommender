"use client";

import { useMemo, useState } from "react";
import { recommendAll } from "@/lib/recommend";
import type { Catalog, MovieLensUser } from "@/lib/types";
import { useCatalog } from "./CatalogProvider";
import { RecList } from "./RecList";
import { Poster } from "./ui";

const TOP_GENRES = 3;
const FAVORITES_SHOWN = 8;

function topGenres(user: MovieLensUser, catalog: Catalog): string[] {
  const counts = new Map<string, number>();
  for (const [idx, rating] of user.ratings) {
    if (rating < 4) continue;
    for (const genre of catalog.movies[idx].genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_GENRES)
    .map(([genre]) => genre);
}

export function CompareView() {
  const { catalog, active, openMovie } = useCatalog();
  const [userIdx, setUserIdx] = useState(() => (active.kind === "user" ? active.user : (catalog.featured[0] ?? 0)));
  const user = catalog.users[userIdx];

  const view = useMemo(() => {
    const ratings = [...user.ratings.values()];
    return {
      lists: recommendAll(user.ratings, catalog),
      average: ratings.reduce((sum, r) => sum + r, 0) / ratings.length,
      genres: topGenres(user, catalog),
      favorites: [...user.ratings.entries()]
        .sort((a, b) => b[1] - a[1] || catalog.movies[b[0]].likes - catalog.movies[a[0]].likes)
        .slice(0, FAVORITES_SHOWN),
    };
  }, [user, catalog]);

  const pickRandom = () => setUserIdx(Math.floor(Math.random() * catalog.users.length));

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-ink-3">Side by side</p>
        <h1 className="font-display text-4xl leading-tight sm:text-6xl">Same person, four answers.</h1>
        <p className="mt-3 text-ink-2">
          Pick a real MovieLens user. Each method only sees 80% of their ratings. The other 20% stayed hidden, and a{" "}
          <span className="font-semibold text-good">✓ hit</span> means the method recommended a movie this user really
          rated 4★ or higher in that hidden part.
        </p>
      </div>

      <section className="mb-6 grid gap-5 rounded-2xl border border-line bg-surface-1 p-5 lg:grid-cols-[minmax(260px,340px)_1fr]">
        <div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-ink-3">
              MovieLens user
              <select
                value={userIdx}
                onChange={(event) => setUserIdx(Number(event.target.value))}
                className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink"
              >
                <optgroup label="Featured">
                  {catalog.featured.map((idx) => (
                    <option key={`f${idx}`} value={idx}>
                      User {catalog.users[idx].id}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Everyone">
                  {catalog.users.map((u, idx) => (
                    <option key={idx} value={idx}>
                      User {u.id}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <button
              type="button"
              onClick={pickRandom}
              className="rounded-xl border border-line-strong px-3 py-2 text-sm text-ink-2 transition hover:border-white/30 hover:text-ink"
            >
              🎲 Random user
            </button>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              ["Ratings seen", user.ratings.size],
              ["Average", `★ ${view.average.toFixed(1)}`],
              ["Hidden likes", user.liked.size],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface-2 p-2">
                <dd className="font-display text-2xl">{value}</dd>
                <dt className="text-[11px] text-ink-3">{label}</dt>
              </div>
            ))}
          </dl>
          {view.genres.length > 0 && (
            <p className="mt-3 text-sm text-ink-2">
              Loves: <span className="text-ink">{view.genres.join(", ")}</span>
            </p>
          )}
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-3">Their highest ratings</p>
          <ul className="scroll-row flex gap-2 overflow-x-auto">
            {view.favorites.map(([idx, rating]) => (
              <li key={idx} className="w-20 shrink-0">
                <button type="button" onClick={() => openMovie(idx)} className="block w-full text-left">
                  <div className="overflow-hidden rounded-md ring-1 ring-line">
                    <Poster movie={catalog.movies[idx]} size="w185" />
                  </div>
                  <p className="mt-1 line-clamp-1 text-[11px] text-ink-2">{catalog.movies[idx].title}</p>
                  <p className="text-[11px] text-svd">★ {rating}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <RecList method="collaborative" recs={view.lists.collaborative} hits={user.liked} />
        <RecList method="content" recs={view.lists.content} hits={user.liked} />
        <RecList method="hybrid" recs={view.lists.hybrid} hits={user.liked} />
        <RecList
          method="popular"
          recs={view.lists.popular}
          hits={user.liked}
          note="Baseline: the same list for everyone"
        />
      </div>
    </div>
  );
}
