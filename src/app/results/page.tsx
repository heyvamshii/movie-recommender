import type { Metadata } from "next";
import { ColdStartChart, RankingChart, RmseChart } from "@/components/ResultsCharts";
import { MethodBadge, SectionHeading } from "@/components/ui";
import { METHOD_LABEL } from "@/lib/explain";
import type { Metrics } from "@/lib/types";
import { bestBy, bestRmse, percentChange, ratingsToBeatPopular } from "@/lib/verdict";
import metricsJson from "../../../public/data/metrics.json";

export const metadata: Metadata = { title: "Results" };

const metrics = metricsJson as Metrics;
const fmt = new Intl.NumberFormat("en-US");

const METHODS = [
  {
    method: "collaborative" as const,
    idea: "People like you also liked this.",
    uses: "Only who rated what (a 610 × 2,269 ratings table).",
    how: "Two movies are similar when the same people rate them the same way (adjusted cosine, damped when few people rated both). Your score for a movie adds up its similarity to each movie you rated, weighted by how much you liked it.",
    strong: "Surprising, high-quality picks once it knows you.",
    weak: "Cold start: useless for new users and brand-new movies.",
  },
  {
    method: "svd" as const,
    idea: "Compress taste into a few hidden factors.",
    uses: "The same ratings table.",
    how: "Matrix factorization (trained with alternating least squares) learns 40 numbers per user and per movie; their dot product plus biases predicts a star rating.",
    strong: "Good at predicting exact star ratings.",
    weak: "Predicting stars is not the same as ranking a top 10, and the factors are hard to explain.",
  },
  {
    method: "content" as const,
    idea: "This is similar to what you already liked.",
    uses: "Movie details: genres, director, cast, TMDB keywords, user tags, decade.",
    how: "Each movie becomes a TF-IDF vector of those features (rare shared features like the same director count most). Cosine similarity finds look-alikes.",
    strong: "Works for brand-new movies, easy to explain, widest variety.",
    weak: "More of the same, and blind to quality: it does not know which look-alike is actually good.",
  },
  {
    method: "hybrid" as const,
    idea: "Blend them, and lean on what works for you right now.",
    uses: "Collaborative + content + popularity.",
    how: `score = α × collaborative + (1 − α) × (content + ${metrics.params.popularityPrior} × popularity), with α = ratings ÷ (ratings + ${metrics.params.hybridHalfPoint}). New users get content + popularity; regulars get mostly collaborative.`,
    strong: "Best overall, and safe in the cold start.",
    weak: "One more knob to tune (chosen on a validation split, never on the test set).",
  },
];

export default function ResultsPage() {
  const best = bestBy(metrics, "precision");
  const bestPrecision = metrics.ranking[best].precision;
  const lift = percentChange(bestPrecision, metrics.ranking.popular.precision);
  const widest = bestBy(metrics, "coverage");
  const rmseWinner = bestRmse(metrics);
  const collabBeatsAt = ratingsToBeatPopular(metrics, "collaborative");
  const hybridBeatsAt = ratingsToBeatPopular(metrics, "hybrid");
  const { dataset, params } = metrics;

  const findings = [
    {
      label: "Most accurate top 10",
      value: METHOD_LABEL[best],
      detail: `${(bestPrecision * 100).toFixed(1)}% precision@10, ${lift >= 0 ? "+" : ""}${lift.toFixed(0)}% vs the popularity baseline.`,
    },
    {
      label: "Cold start",
      value: collabBeatsAt ? `${collabBeatsAt} ratings` : "never",
      detail: `Collaborative filtering needs that many ratings to beat plain popularity. The hybrid ${
        hybridBeatsAt ? `ties it at first and beats it from ${hybridBeatsAt}` : "stays level with it"
      }.`,
    },
    {
      label: "Best star predictions",
      value: rmseWinner === "collaborative" ? "Item-item" : METHOD_LABEL[rmseWinner as "svd" | "content"] ?? rmseWinner,
      detail: `RMSE ${metrics.rmse[rmseWinner].toFixed(3)} vs ${metrics.rmse.baseline.toFixed(3)} for the simple baseline.`,
    },
    {
      label: "Most variety",
      value: METHOD_LABEL[widest],
      detail: `Recommends ${(metrics.ranking[widest].coverage * 100).toFixed(0)}% of the catalog to someone, vs ${(
        metrics.ranking.popular.coverage * 100
      ).toFixed(0)}% for popularity.`,
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8">
      <div className="mb-10 max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-ink-3">Offline evaluation</p>
        <h1 className="font-display text-4xl leading-tight sm:text-6xl">Which recommender actually wins?</h1>
        <p className="mt-3 text-ink-2">
          Every number below comes from ratings the models never saw. We hid {params.testFraction * 100}% of each
          user&apos;s ratings, trained on the rest, then checked how often each method found the movies people really rated{" "}
          {params.likeThreshold}★ or higher.
        </p>
      </div>

      <dl className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-5">
        {[
          ["Users", fmt.format(dataset.users)],
          ["Movies", fmt.format(dataset.movies)],
          ["Ratings", fmt.format(dataset.ratings)],
          ["Table filled", `${(dataset.density * 100).toFixed(1)}%`],
          ["Posters from TMDB", fmt.format(dataset.moviesWithPosters)],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface-1 px-4 py-4">
            <dd className="font-display text-3xl">{value}</dd>
            <dt className="text-xs text-ink-3">{label}</dt>
          </div>
        ))}
      </dl>

      <section className="mb-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Key findings">
        {findings.map((finding, i) => (
          <article
            key={finding.label}
            className={`rounded-2xl border p-5 ${i === 0 ? "border-hybrid/40 bg-hybrid/10" : "border-line bg-surface-1"}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-3">{finding.label}</p>
            <p className="mt-2 font-display text-3xl leading-tight">{finding.value}</p>
            <p className="mt-2 text-sm text-ink-2">{finding.detail}</p>
          </article>
        ))}
      </section>

      <div className="mb-12 grid gap-6 xl:grid-cols-2">
        <RankingChart metrics={metrics} />
        <ColdStartChart metrics={metrics} />
      </div>
      <div className="mb-16">
        <RmseChart metrics={metrics} />
      </div>

      <section className="mb-16">
        <SectionHeading eyebrow="How it works" title="Four ways to pick a movie">
          The popularity baseline (same top list for everyone) is the bar every method has to clear.
        </SectionHeading>
        <div className="grid gap-4 lg:grid-cols-2">
          {METHODS.map((item) => (
            <article key={item.method} className="rounded-2xl border border-line bg-surface-1 p-5">
              <MethodBadge method={item.method} />
              <h3 className="mt-3 font-display text-2xl">“{item.idea}”</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="inline text-ink-3">Uses: </dt>
                  <dd className="inline text-ink-2">{item.uses}</dd>
                </div>
                <div>
                  <dt className="inline text-ink-3">How: </dt>
                  <dd className="inline text-ink-2">{item.how}</dd>
                </div>
                <div>
                  <dt className="inline text-good">Strong: </dt>
                  <dd className="inline text-ink-2">{item.strong}</dd>
                </div>
                <div>
                  <dt className="inline text-popular">Weak: </dt>
                  <dd className="inline text-ink-2">{item.weak}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <SectionHeading eyebrow="Method" title="How we tested" />
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-2">
            <li>
              MovieLens “small” (GroupLens): kept movies with at least {params.minRatingsPerMovie} ratings so collaborative
              filtering has something to work with.
            </li>
            <li>
              For every user, {params.testFraction * 100}% of their ratings were hidden at random (fixed seed). Models only
              saw the other {100 - params.testFraction * 100}% ({fmt.format(dataset.trainRatings)} ratings).
            </li>
            <li>
              Each method ranked every movie the user had not rated and kept the top {params.topN}. A hit is a hidden
              rating of {params.likeThreshold}★ or more.
            </li>
            <li>
              Settings (SVD size, hybrid mix) were tuned on a validation split carved from the training data; the test
              ratings were used once, for these numbers.
            </li>
            <li>
              The browser runs a line-for-line TypeScript copy of the Python ranking code; an automated test checks that
              both produce identical top-10 lists.
            </li>
          </ol>
        </div>
        <div>
          <SectionHeading eyebrow="Honest caveats" title="What the numbers don’t say" />
          <ul className="list-disc space-y-2 pl-5 text-sm text-ink-2">
            <li>
              Precision looks low because a “miss” only means the user didn’t rate that movie, not that they’d dislike it.
              Compare methods with each other, not with 100%.
            </li>
            <li>
              Popular movies are over-represented in what people rate, which flatters the popularity baseline. That is why
              the hybrid leans on it while you are new.
            </li>
            <li>
              Content-based scores lowest on accuracy but recommends the widest range of the catalog, and it is the only
              method that could recommend a movie nobody has rated yet.
            </li>
          </ul>
          <p className="mt-4 text-xs text-ink-3">Generated {new Date(metrics.generatedAt).toUTCString()}.</p>
        </div>
      </section>
    </div>
  );
}
