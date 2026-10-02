"use client";

import Link from "next/link";
import { useMemo } from "react";
import { reasonText } from "@/lib/explain";
import { backdropUrl } from "@/lib/poster";
import { favoriteMovie, hybridWeight, recommendAll, similarTo } from "@/lib/recommend";
import type { Recommendation } from "@/lib/types";
import { useCatalog } from "./CatalogProvider";
import { MixBar } from "./MovieModal";
import { MovieRow } from "./MovieRow";
import { MethodBadge } from "./ui";

const ROW_LENGTH = 18;

export function BrowseView() {
  const { catalog, activeRatings, activeLabel, active, openMovie } = useCatalog();

  const rows = useMemo(() => {
    const lists = recommendAll(activeRatings, catalog, ROW_LENGTH);
    const exclude = new Set(activeRatings.keys());
    const favorite = favoriteMovie(activeRatings, catalog);
    const second = favorite === null ? null : favoriteMovie(activeRatings, catalog, new Set([favorite]));
    return {
      lists,
      favorite,
      second,
      becauseFavorite: favorite === null ? [] : similarTo(favorite, catalog, "collaborative", exclude, ROW_LENGTH),
      moreLikeSecond:
        (second ?? favorite) === null ? [] : similarTo((second ?? favorite)!, catalog, "content", exclude, ROW_LENGTH),
      rated: [...activeRatings.entries()]
        .sort((a, b) => b[1] - a[1] || catalog.movies[b[0]].likes - catalog.movies[a[0]].likes)
        .slice(0, 30)
        .map(([idx]) => ({ idx })),
    };
  }, [activeRatings, catalog]);

  const coldStart = activeRatings.size === 0;
  const hero = rows.lists.hybrid[0];
  const title = (idx: number | null) => (idx === null ? "" : catalog.movies[idx].title);
  const whose = active.kind === "you" ? "you" : `user ${catalog.users[active.user].id}`;

  return (
    <div className="pb-6">
      {hero && <Hero rec={hero} label={activeLabel} onOpen={() => openMovie(hero.idx, hero)} />}

      {coldStart && (
        <div className="mx-4 mb-10 rounded-2xl border border-popular/30 bg-popular/10 p-5 sm:mx-8">
          <p className="font-semibold">Cold start: no ratings yet</p>
          <p className="mt-1 max-w-3xl text-sm text-ink-2">
            Collaborative and content-based filtering both work from the movies you rated, so with zero ratings every
            list falls back to what is popular. Rate a few movies on{" "}
            <Link href="/try" className="text-ink underline underline-offset-4">
              Try it yourself
            </Link>{" "}
            and watch the rows change.
          </p>
        </div>
      )}

      <div className="mx-auto max-w-[1600px]">
        <MovieRow
          title={`Top picks for ${whose}`}
          subtitle={`Hybrid: ${Math.round(hybridWeight(activeRatings.size) * 100)}% collaborative, the rest content + popularity`}
          method="hybrid"
          recs={rows.lists.hybrid}
        />
        {rows.favorite !== null && (
          <MovieRow
            title={<>Because {active.kind === "you" ? "you" : "they"} liked <em className="font-display text-[1.15em] not-italic">{title(rows.favorite)}</em></>}
            subtitle="Collaborative: people who loved it also loved these"
            method="collaborative"
            recs={rows.becauseFavorite}
          />
        )}
        {!coldStart && (
          <MovieRow
            title="People with your taste also liked"
            subtitle="Collaborative filtering over everything you rated"
            method="collaborative"
            recs={rows.lists.collaborative}
          />
        )}
        {(rows.second ?? rows.favorite) !== null && (
          <MovieRow
            title={<>More like <em className="font-display text-[1.15em] not-italic">{title(rows.second ?? rows.favorite)}</em></>}
            subtitle="Content-based: same director, cast, keywords or genres"
            method="content"
            recs={rows.moreLikeSecond}
          />
        )}
        {!coldStart && (
          <MovieRow
            title="Matches your taste"
            subtitle="Content-based filtering over everything you rated"
            method="content"
            recs={rows.lists.content}
          />
        )}
        <MovieRow
          title="Popular on MovieLens"
          subtitle="Most liked overall, the same for everyone"
          method="popular"
          recs={rows.lists.popular}
        />
        {rows.rated.length > 0 && (
          <MovieRow
            title={active.kind === "you" ? "Your ratings" : `What user ${catalog.users[active.user].id} rated highest`}
            subtitle={`${activeRatings.size} ratings in total. These are what every recommendation above is built from.`}
            recs={rows.rated}
            ratings={activeRatings}
          />
        )}
      </div>
    </div>
  );
}

function Hero({ rec, label, onOpen }: { rec: Recommendation; label: string; onOpen: () => void }) {
  const { catalog } = useCatalog();
  const movie = catalog.movies[rec.idx];
  const backdrop = backdropUrl(movie.backdrop);
  const why = reasonText(rec.reason, catalog);
  return (
    <section className="relative mb-10 min-h-[440px] overflow-hidden sm:min-h-[560px]" aria-label="Top pick">
      {backdrop && (
        // eslint-disable-next-line @next/next/no-img-element -- TMDB serves sized images
        <img
          src={backdrop}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-[center_25%]"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent" />
      <div className="relative mx-auto flex min-h-[440px] max-w-[1600px] flex-col justify-end px-4 pb-10 pt-16 sm:min-h-[560px] sm:px-8 sm:pt-24">
        <div className="max-w-xl">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <MethodBadge method="hybrid" />
            <span className="text-xs uppercase tracking-[0.2em] text-ink-2">#1 pick for {label}</span>
          </div>
          <h1 className="font-display text-5xl leading-[0.95] sm:text-7xl">{movie.title}</h1>
          <p className="mt-3 text-sm text-ink-2">
            {[movie.year, movie.genres.slice(0, 3).join(" · "), movie.directors[0] && `Dir. ${movie.directors[0]}`]
              .filter(Boolean)
              .join("  ·  ")}
          </p>
          {movie.overview && <p className="mt-4 line-clamp-3 max-w-lg leading-relaxed text-ink-2">{movie.overview}</p>}
          <div className="mt-5 max-w-md rounded-xl border border-line bg-black/40 p-3 backdrop-blur">
            <p className="text-sm font-medium">{why.headline}</p>
            <p className="text-xs text-ink-2">{why.detail}</p>
            {rec.mix && <MixBar mix={rec.mix} />}
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="mt-6 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-bg transition hover:bg-white active:scale-[0.98]"
          >
            More info &amp; rate
          </button>
        </div>
      </div>
    </section>
  );
}
