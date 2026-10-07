import type { Metadata } from "next";
import { MethodDot } from "@/components/ui";
import { METHOD_LABEL } from "@/lib/explain";
import type { Method, Metrics } from "@/lib/types";
import metricsJson from "../../../public/data/metrics.json";

export const metadata: Metadata = { title: "Which is best?" };

const metrics = metricsJson as Metrics;
const fmt = new Intl.NumberFormat("en-US");
const SHOWN: Method[] = ["userbased", "hybrid", "collaborative", "popular", "content"];
const BAR_COLOR: Record<Method, string> = {
  collaborative: "bg-collaborative",
  content: "bg-content",
  hybrid: "bg-hybrid",
  popular: "bg-popular",
  userbased: "bg-userbased",
};

const HOW_IT_WORKS: { method: Method; idea: string; good: string; bad: string }[] = [
  {
    method: "userbased",
    idea: "Finds the people whose likes overlap most with yours (other users of this site and 610 MovieLens users) and suggests what they liked.",
    good: "Most accurate here, and other users' likes shape your feed.",
    bad: "Needs at least one like, and works best with many users.",
  },
  {
    method: "collaborative",
    idea: "Finds people who loved the same movies as you, and suggests what else they loved.",
    good: "Finds great picks you would not think of.",
    bad: "Needs lots of ratings before it gets good.",
  },
  {
    method: "content",
    idea: "Suggests movies that look like your picks: same director, actors, genre or story keywords.",
    good: "Works from your very first pick, and can explain itself.",
    bad: "Keeps suggesting more of the same, good or not.",
  },
  {
    method: "hybrid",
    idea: "Mixes both, and leans on popular movies until it knows you better.",
    good: "Best overall, and good for new users.",
    bad: "Slightly harder to explain.",
  },
];

export default function ResultsPage() {
  const scores = SHOWN.map((method) => ({ method, perTen: metrics.ranking[method].precision * 10 })).sort(
    (a, b) => b.perTen - a.perTen,
  );
  const max = scores[0].perTen;
  const { dataset } = metrics;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
      <h1 className="font-display text-4xl leading-tight sm:text-5xl">Which method recommends best?</h1>
      <p className="mt-4 text-lg text-ink-2">
        We tested each method on {fmt.format(dataset.users)} real people. For every person we hid some of the movies
        they loved, then counted how many of each method&apos;s 10 suggestions were those hidden movies.
      </p>

      <section aria-label="Results" className="mt-8 rounded-2xl border border-line bg-surface-1 p-6">
        <h2 className="text-lg font-semibold">Correct guesses out of 10 suggestions</h2>
        <ul className="mt-5 space-y-4">
          {scores.map(({ method, perTen }) => (
            <li key={method} className="grid grid-cols-[120px_1fr] items-center gap-4 sm:grid-cols-[150px_1fr]">
              <span className="flex items-center gap-2 font-medium">
                <MethodDot method={method} />
                {METHOD_LABEL[method]}
              </span>
              <div className="flex items-center gap-3">
                <div className="h-7 flex-1 overflow-hidden rounded-r-md bg-surface-3/50">
                  <div className={`h-full rounded-r-md ${BAR_COLOR[method]}`} style={{ width: `${(perTen / max) * 100}%` }} />
                </div>
                <span className="w-12 text-right font-mono text-sm tabular-nums">{perTen.toFixed(2)}</span>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-ink-3">
          <strong className="text-ink-2">“People like you” guesses best</strong>: matching you with similar people
          beats matching movies with similar movies. Hybrid and collaborative are almost tied; the hybrid is already
          good after a few likes. Why not 10 out of 10? People only rate a small share of all movies, so a suggestion
          counts only if they happened to rate it. “Popular” is the same list for everyone, the bar to beat.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-3xl">How each one works</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {HOW_IT_WORKS.map((item) => (
            <article key={item.method} className="rounded-2xl border border-line bg-surface-1 p-5">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <MethodDot method={item.method} />
                {METHOD_LABEL[item.method]}
              </h3>
              <p className="mt-2 text-sm text-ink-2">{item.idea}</p>
              <p className="mt-3 text-sm">
                <span className="text-good">+</span> <span className="text-ink-2">{item.good}</span>
              </p>
              <p className="mt-1 text-sm">
                <span className="text-popular">−</span> <span className="text-ink-2">{item.bad}</span>
              </p>
            </article>
          ))}
        </div>
      </section>

      <p className="mt-10 text-sm text-ink-3">
        Data: MovieLens, a free research dataset from the University of Minnesota ({fmt.format(dataset.users)} people,{" "}
        {fmt.format(dataset.movies)} movies, {fmt.format(dataset.ratings)} ratings). Posters and movie details: TMDB.
      </p>
    </div>
  );
}
