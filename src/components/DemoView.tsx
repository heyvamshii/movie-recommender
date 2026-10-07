"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { feedRecommendations, hybridMix, listChanges, peopleStory, pickerMovies, pickStory, type Change } from "@/lib/demo";
import { METHOD_LABEL, METHOD_TAGLINE, reasonText } from "@/lib/explain";
import { recommendAll } from "@/lib/recommend";
import type { Method, Recommendation, RecommendationSet } from "@/lib/types";
import { useCatalog } from "./CatalogProvider";
import { MethodDot, Poster } from "./ui";

const PICKER_SIZE = 30;
const COLUMNS: Method[] = ["userbased", "hybrid", "collaborative", "content"];

type LastAction = { kind: "added" | "removed"; idx: number } | { kind: "cleared" } | null;

export function DemoView() {
  const { catalog, user, picks, feed, saving, error, togglePick, removeLastPick, clearPicks, openMovie } = useCatalog();
  const [previous, setPrevious] = useState<RecommendationSet | null>(null);
  const [lastAction, setLastAction] = useState<LastAction>(null);
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query.trim().toLowerCase());

  const lists = useMemo<RecommendationSet>(
    () => ({ ...recommendAll(picks, catalog), userbased: feedRecommendations(feed, catalog) }),
    [picks, catalog, feed],
  );

  const picker = useMemo(() => {
    if (!search) return pickerMovies(catalog, PICKER_SIZE);
    return catalog.movies
      .map((movie, idx) => ({ movie, idx }))
      .filter(({ movie }) => movie.title.toLowerCase().includes(search))
      .sort((a, b) => b.movie.likes - a.movie.likes)
      .slice(0, PICKER_SIZE)
      .map(({ idx }) => idx);
  }, [catalog, search]);

  const handlePick = (idx: number) => {
    setPrevious(lists);
    setLastAction({ kind: picks.has(idx) ? "removed" : "added", idx });
    togglePick(idx);
  };
  const handleUndo = () => {
    const last = [...picks.keys()].at(-1);
    if (last === undefined) return;
    setPrevious(lists);
    setLastAction({ kind: "removed", idx: last });
    removeLastPick();
  };
  const handleStartOver = () => {
    setPrevious(lists);
    setLastAction({ kind: "cleared" });
    clearPicks();
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-8">
      <header className="mb-4 max-w-4xl">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">
          Hi {user.displayName}. <span className="text-ink-3">Like movies, and your feed learns.</span>
        </h1>
        <p className="mt-1.5 text-sm text-ink-2">
          Your likes are saved to your account. Four ways of recommending, side by side, and{" "}
          <span className="rounded bg-good/15 px-1.5 font-semibold text-good">NEW</span> marks what just changed.{" "}
          <span aria-live="polite" className="text-ink-3">
            {saving ? "Saving…" : picks.size > 0 ? `${picks.size} liked` : ""}
          </span>
        </p>
        {error && (
          <p role="alert" className="mt-2 rounded-lg bg-popular/15 px-3 py-2 text-sm text-ink">
            {error}
          </p>
        )}
      </header>

      {/* step 1: pick movies */}
      <section aria-label="Pick movies you love" className="mb-4 rounded-2xl border border-line bg-surface-1 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Like movies</h2>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search any movie…"
            aria-label="Search movies"
            className="min-w-0 flex-1 rounded-full border border-line-strong bg-surface-2 px-4 py-1.5 text-sm outline-none transition placeholder:text-ink-3 focus:border-hybrid sm:max-w-xs"
          />
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={picks.size === 0}
              className="rounded-full border border-line-strong px-4 py-1.5 text-sm text-ink-2 transition hover:text-ink disabled:opacity-40"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={handleStartOver}
              disabled={picks.size === 0}
              className="rounded-full border border-line-strong px-4 py-1.5 text-sm text-ink-2 transition hover:text-ink disabled:opacity-40"
            >
              Start over
            </button>
          </div>
        </div>
        <ul className="scroll-row flex scroll-px-1 gap-3 overflow-x-auto px-1 pb-2 pt-1">
          {picker.map((idx) => {
            const movie = catalog.movies[idx];
            const picked = picks.has(idx);
            return (
              <li key={idx} className="w-[76px] shrink-0 snap-start sm:w-[88px]">
                <button
                  type="button"
                  onClick={() => handlePick(idx)}
                  aria-pressed={picked}
                  aria-label={`${picked ? "Remove" : "Pick"} ${movie.title}`}
                  className="group block w-full text-left"
                >
                  <div
                    className={`relative overflow-hidden rounded-lg transition duration-200 group-hover:-translate-y-0.5 group-active:scale-95 ${
                      picked ? "ring-[3px] ring-hybrid" : "ring-1 ring-line group-hover:ring-line-strong"
                    }`}
                  >
                    <Poster movie={movie} size="w185" />
                    <span
                      className={`absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full text-sm transition ${
                        picked ? "bg-hybrid text-white" : "bg-black/60 text-white/70 opacity-0 group-hover:opacity-100"
                      }`}
                      aria-hidden
                    >
                      ♥
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-[11px] text-ink-2">{movie.title}</p>
                </button>
              </li>
            );
          })}
          {picker.length === 0 && <li className="py-8 text-sm text-ink-3">No movie title matches “{query}”.</li>}
        </ul>
      </section>

      <WhatHappened lastAction={lastAction} lists={lists} pickCount={picks.size} people={peopleStory(feed, catalog)} />

      {/* the three recommenders */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((method) => (
          <DemoColumn
            key={method}
            method={method}
            recs={lists[method]}
            previous={previous ? previous[method].map((rec) => rec.idx) : null}
            onOpen={openMovie}
          />
        ))}
      </div>
    </div>
  );
}

function WhatHappened({
  lastAction,
  lists,
  pickCount,
  people,
}: {
  lastAction: LastAction;
  lists: RecommendationSet;
  pickCount: number;
  people: string;
}) {
  const { catalog } = useCatalog();
  let content: React.ReactNode;
  if (pickCount === 0) {
    content = (
      <p>
        <strong className="text-ink">No likes yet.</strong> With nothing to go on, the recommenders can only show what is
        popular, and nobody can be matched with you. Click any movie above.
      </p>
    );
  } else if (lastAction?.kind === "added") {
    const story = { ...pickStory(lastAction.idx, lists, catalog), userbased: people };
    content = (
      <>
        <p className="mb-2">
          You liked <strong className="text-ink">{catalog.movies[lastAction.idx].title}</strong>. Here is what each method
          did with it:
        </p>
        <ul className="grid gap-1.5 md:grid-cols-2 md:gap-x-4 xl:grid-cols-4">
          {COLUMNS.map((method) => (
            <li key={method} className="flex gap-2">
              <span className="mt-1">
                <MethodDot method={method} />
              </span>
              <span>{story[method as keyof typeof story]}</span>
            </li>
          ))}
        </ul>
      </>
    );
  } else if (lastAction?.kind === "removed") {
    content = (
      <p>
        Removed <strong className="text-ink">{catalog.movies[lastAction.idx].title}</strong>. All columns updated without
        it. {people}
      </p>
    );
  } else {
    content = (
      <p>
        You have {pickCount} liked movie{pickCount === 1 ? "" : "s"}. {people} Like another movie and watch the columns
        change.
      </p>
    );
  }
  return (
    <div aria-live="polite" className="mb-4 rounded-2xl border border-hybrid/30 bg-hybrid/[0.07] px-4 py-3 text-sm text-ink-2">
      {content}
    </div>
  );
}

function ChangeBadge({ change }: { change: Change | undefined }) {
  if (!change || change.kind === "same") return null;
  if (change.kind === "new") {
    return <span className="rounded-full bg-good/20 px-2 py-0.5 text-[11px] font-bold tracking-wide text-good">NEW</span>;
  }
  return change.kind === "up" ? (
    <span className="text-xs font-semibold text-good" aria-label={`moved up ${change.by}`}>
      ▲{change.by}
    </span>
  ) : (
    <span className="text-xs text-ink-3" aria-label={`moved down ${change.by}`}>
      ▼{change.by}
    </span>
  );
}

function DemoColumn({
  method,
  recs,
  previous,
  onOpen,
}: {
  method: Method;
  recs: Recommendation[];
  previous: number[] | null;
  onOpen: (idx: number, rec: Recommendation) => void;
}) {
  const { catalog } = useCatalog();
  const { changes, changed } = listChanges(
    previous,
    recs.map((rec) => rec.idx),
  );
  const mix = method === "hybrid" ? hybridMix(recs) : null;

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface-1" aria-label={METHOD_LABEL[method]}>
      <header className="border-b border-line px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MethodDot method={method} />
            {METHOD_LABEL[method]}
          </h2>
          {previous !== null && (
            <span
              key={changed + recs.map((rec) => rec.idx).join()}
              className={`rise-in rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                changed > 0 ? "bg-good/15 text-good" : "bg-surface-3 text-ink-3"
              }`}
            >
              {changed} new
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-ink-3">{METHOD_TAGLINE[method]}</p>
        {mix && (
          <div className="mt-3">
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
              <div className="h-full bg-hybrid transition-all duration-700" style={{ width: `${mix.personal * 100}%` }} />
              <div className="h-full flex-1 bg-popular/70" />
            </div>
            <p className="mt-1.5 text-xs text-ink-2">
              <span className="text-hybrid">■</span> {Math.round(mix.personal * 100)}% your picks ·{" "}
              <span className="text-popular">■</span> {Math.round(mix.popular * 100)}% popular. Leans on your picks more as you add them.
            </p>
          </div>
        )}
      </header>
      {method === "userbased" && recs.length === 0 && (
        <p className="px-4 py-6 text-sm text-ink-3">Like a movie and we will find people whose taste overlaps with yours.</p>
      )}
      <ol className="flex flex-col p-2">
        {recs.map((rec, rank) => {
          const movie = catalog.movies[rec.idx];
          const change = changes.get(rec.idx);
          const isNew = change?.kind === "new";
          return (
            <li key={rec.idx} className={isNew ? "flash-new rounded-xl" : ""}>
              <button
                type="button"
                onClick={() => onOpen(rec.idx, rec)}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-surface-2"
              >
                <span className="w-4 shrink-0 text-right font-mono text-xs text-ink-3">{rank + 1}</span>
                <div className="w-10 shrink-0 overflow-hidden rounded-md ring-1 ring-line">
                  <Poster movie={movie} size="w185" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">
                    {movie.title} <span className="font-normal text-ink-3">{movie.year}</span>
                  </p>
                  <p className="line-clamp-1 text-xs text-ink-3">{reasonText(rec.reason, catalog).headline}</p>
                </div>
                <ChangeBadge change={change} />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
