import { describe, expect, it } from "vitest";
import metricsJson from "../../public/data/metrics.json";
import type { Metrics } from "./types";
import { bestBy, bestRmse, niceTicks, percentChange, ratingsToBeatPopular } from "./verdict";

const metrics = metricsJson as Metrics;

function withColdStart(precision: Partial<Metrics["coldStart"]["precision"]>): Metrics {
  return { ...metrics, coldStart: { ...metrics.coldStart, precision: { ...metrics.coldStart.precision, ...precision } } };
}

describe("verdict helpers", () => {
  it("finds the best method for each ranking metric", () => {
    const best = bestBy(metrics, "precision");
    for (const value of Object.values(metrics.ranking)) {
      expect(metrics.ranking[best].precision).toBeGreaterThanOrEqual(value.precision);
    }
  });

  it("finds the lowest RMSE", () => {
    const winner = bestRmse(metrics);
    expect(Math.min(...Object.values(metrics.rmse))).toBe(metrics.rmse[winner]);
  });

  it("reports the first step where a method beats popularity, or null", () => {
    const flat = metrics.coldStart.steps.map(() => 0.1);
    const rising = metrics.coldStart.steps.map((_, i) => (i >= 2 ? 0.2 : 0.05));
    const fake = withColdStart({ popular: flat, collaborative: rising, content: flat });
    expect(ratingsToBeatPopular(fake, "collaborative")).toBe(metrics.coldStart.steps[2]);
    expect(ratingsToBeatPopular(fake, "content")).toBeNull();
  });

  it("computes percent change safely", () => {
    expect(percentChange(0.15, 0.1)).toBeCloseTo(50);
    expect(percentChange(1, 0)).toBe(0);
  });

  it("makes round percentage ticks", () => {
    expect(niceTicks(0.163)).toEqual([0, 0.05, 0.1, 0.15, 0.2]);
    expect(niceTicks(0.43)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
    expect(niceTicks(0.2)).toEqual([0, 0.05, 0.1, 0.15, 0.2]);
  });
});
