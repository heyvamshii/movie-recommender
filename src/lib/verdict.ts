/** Headline findings derived from metrics.json, so the Results page text never goes stale. */
import type { EvalMethod, Metrics } from "./types";

export const EVAL_METHODS: EvalMethod[] = ["popular", "collaborative", "svd", "content", "hybrid"];

export function bestBy(metrics: Metrics, key: "precision" | "recall" | "coverage"): EvalMethod {
  return EVAL_METHODS.reduce((best, method) =>
    metrics.ranking[method][key] > metrics.ranking[best][key] ? method : best,
  );
}

export function bestRmse(metrics: Metrics): keyof Metrics["rmse"] {
  const entries = Object.entries(metrics.rmse) as [keyof Metrics["rmse"], number][];
  return entries.reduce((best, entry) => (entry[1] < best[1] ? entry : best))[0];
}

/** Fewest known ratings at which `method` beats the popularity baseline (null if never). */
export function ratingsToBeatPopular(metrics: Metrics, method: EvalMethod): number | null {
  const { steps, precision } = metrics.coldStart;
  const index = steps.findIndex((_, i) => precision[method][i] > precision.popular[i]);
  return index === -1 ? null : steps[index];
}

export function percentChange(value: number, baseline: number): number {
  return baseline === 0 ? 0 : ((value - baseline) / baseline) * 100;
}

/** Round percentage ticks: 5% steps for small values, 10% above 30%. */
export function niceTicks(maxValue: number): number[] {
  const step = maxValue > 0.3 ? 0.1 : 0.05;
  const top = Math.ceil(maxValue / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Number((i * step).toFixed(2)));
}
