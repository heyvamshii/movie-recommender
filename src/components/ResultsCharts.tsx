"use client";

import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { METHOD_LABEL } from "@/lib/explain";
import type { EvalMethod, Metrics } from "@/lib/types";
import { EVAL_METHODS, niceTicks } from "@/lib/verdict";

const COLOR: Record<EvalMethod, string> = {
  collaborative: "var(--m-collaborative)",
  content: "var(--m-content)",
  hybrid: "var(--m-hybrid)",
  popular: "var(--m-popular)",
  svd: "var(--m-svd)",
};
const SHORT: Record<EvalMethod, string> = {
  collaborative: "Collaborative",
  content: "Content",
  hybrid: "Hybrid",
  popular: "Popular",
  svd: "SVD",
};
const AXIS = { stroke: "var(--text-muted)", fontSize: 12 };
const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;


function ChartCard({
  title,
  caption,
  controls,
  table,
  children,
}: {
  title: string;
  caption: string;
  controls?: ReactNode;
  table: ReactNode;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className="rounded-2xl border border-line bg-surface-1 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h3 className="text-lg font-semibold">{title}</h3>
          <figcaption className="mt-1 text-sm text-ink-3">{caption}</figcaption>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          <button
            type="button"
            onClick={() => setShowTable((value) => !value)}
            aria-pressed={showTable}
            className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink-2 transition hover:text-ink"
          >
            {showTable ? "Show chart" : "Show numbers"}
          </button>
        </div>
      </div>
      {showTable ? <div className="overflow-x-auto">{table}</div> : children}
    </figure>
  );
}

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color: string }[] }) {
  return (
    <div className="rounded-lg border border-line-strong bg-surface-3 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-ink">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center gap-2 text-ink-2">
          <span className="size-2 rounded-full" style={{ background: row.color }} />
          {row.label}
          <span className="ml-auto pl-4 font-mono text-ink">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

const tableClass = "w-full text-left text-sm [&_td]:py-1.5 [&_td]:pr-4 [&_th]:pb-2 [&_th]:pr-4 [&_th]:font-medium [&_th]:text-ink-3";

type RankingKey = "precision" | "recall" | "coverage";
const RANKING_LABEL: Record<RankingKey, string> = {
  precision: "Precision@10",
  recall: "Recall@10",
  coverage: "Catalog coverage",
};

export function RankingChart({ metrics }: { metrics: Metrics }) {
  const [metric, setMetric] = useState<RankingKey>("precision");
  const data = EVAL_METHODS.map((method) => ({ method, name: SHORT[method], value: metrics.ranking[method][metric] }));
  const ticks = niceTicks(Math.max(...data.map((row) => row.value)));
  const caption = {
    precision: "Of the 10 movies recommended, the share the user really liked in the hidden 20%. Higher is better.",
    recall: "Of all the movies a user liked in the hidden 20%, the share that made the top 10. Higher is better.",
    coverage: "Share of all 2,269 movies that got recommended to at least one user. Higher means more variety.",
  }[metric];
  return (
    <ChartCard
      title="Who recommends best?"
      caption={caption}
      controls={
        <div role="group" aria-label="Metric" className="flex rounded-full border border-line-strong p-0.5">
          {(Object.keys(RANKING_LABEL) as RankingKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                metric === key ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink"
              }`}
            >
              {RANKING_LABEL[key]}
            </button>
          ))}
        </div>
      }
      table={
        <table className={tableClass}>
          <thead>
            <tr>
              <th>Method</th>
              <th>Precision@10</th>
              <th>Recall@10</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {EVAL_METHODS.map((method) => (
              <tr key={method} className="border-t border-line">
                <td>{METHOD_LABEL[method]}</td>
                <td className="font-mono">{metrics.ranking[method].precision.toFixed(3)}</td>
                <td className="font-mono">{metrics.ranking[method].recall.toFixed(3)}</td>
                <td className="font-mono">{pct(metrics.ranking[method].coverage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }} barCategoryGap={10}>
            <CartesianGrid horizontal={false} stroke="var(--line)" />
            <XAxis
              type="number"
              ticks={ticks}
              domain={[0, ticks[ticks.length - 1]]}
              tickFormatter={(value: number) => pct(value, 0)}
              {...AXIS}
              tickLine={false}
              axisLine={false}
            />
            <YAxis type="category" dataKey="name" width={96} {...AXIS} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <TooltipBox
                    title={METHOD_LABEL[payload[0].payload.method as EvalMethod]}
                    rows={[
                      {
                        label: RANKING_LABEL[metric],
                        value: pct(payload[0].payload.value as number),
                        color: COLOR[payload[0].payload.method as EvalMethod],
                      },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive>
              {data.map((row) => (
                <Cell key={row.method} fill={COLOR[row.method]} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(value: unknown) => pct(Number(value))}
                fill="var(--text-secondary)"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function ColdStartChart({ metrics }: { metrics: Metrics }) {
  const { steps, precision, users } = metrics.coldStart;
  const ticks = niceTicks(Math.max(...EVAL_METHODS.flatMap((method) => precision[method])));
  const data = steps.map((step, i) => ({
    step,
    ...Object.fromEntries(EVAL_METHODS.map((method) => [method, precision[method][i]])),
  }));
  return (
    <ChartCard
      title="The cold-start test"
      caption={`We pretended ${users} experienced users had rated only 1, 2, 3… movies and measured precision@10 each time. Popularity ignores you, so it stays flat.`}
      table={
        <table className={tableClass}>
          <thead>
            <tr>
              <th>Ratings known</th>
              {EVAL_METHODS.map((method) => (
                <th key={method}>{SHORT[method]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {steps.map((step, i) => (
              <tr key={step} className="border-t border-line">
                <td>{step}</td>
                {EVAL_METHODS.map((method) => (
                  <td key={method} className="font-mono">
                    {precision[method][i].toFixed(3)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="step"
              {...AXIS}
              tickLine={false}
              label={{ value: "movies rated so far", position: "insideBottom", offset: -4, fill: "var(--text-muted)", fontSize: 12 }}
            />
            <YAxis
              ticks={ticks}
              domain={[0, ticks[ticks.length - 1]]}
              tickFormatter={(value: number) => pct(value, 0)}
              {...AXIS}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              cursor={{ stroke: "var(--line-strong)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={`${label} rating${label === 1 ? "" : "s"} known`}
                    rows={[...payload]
                      .sort((a, b) => Number(b.value) - Number(a.value))
                      .map((entry) => ({
                        label: SHORT[entry.dataKey as EvalMethod],
                        value: pct(Number(entry.value)),
                        color: COLOR[entry.dataKey as EvalMethod],
                      }))}
                  />
                ) : null
              }
            />
            <Legend
              verticalAlign="top"
              height={32}
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => <span className="text-xs text-ink-2">{SHORT[value as EvalMethod]}</span>}
            />
            {EVAL_METHODS.map((method) => (
              <Line
                key={method}
                type="monotone"
                dataKey={method}
                stroke={COLOR[method]}
                strokeWidth={method === "hybrid" ? 3 : 2}
                strokeDasharray={method === "popular" ? "5 4" : undefined}
                dot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-1)", fill: COLOR[method] }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--surface-1)" }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

const RMSE_ROWS: { key: keyof Metrics["rmse"]; label: string; color: string; note: string }[] = [
  { key: "baseline", label: "Baseline", color: "var(--text-muted)", note: "average + user & movie bias" },
  { key: "collaborative", label: "Collaborative (item-item)", color: COLOR.collaborative, note: "30 most similar rated movies" },
  { key: "svd", label: "SVD", color: COLOR.svd, note: "40 hidden taste factors" },
  { key: "content", label: "Content-based", color: COLOR.content, note: "30 most similar by description" },
];

/** Dot plot: RMSE values are close together, and a dot (unlike a bar) may use a zoomed axis honestly. */
export function RmseChart({ metrics }: { metrics: Metrics }) {
  const values = RMSE_ROWS.map((row) => metrics.rmse[row.key]);
  const min = Math.floor(Math.min(...values) * 50) / 50 - 0.01;
  const max = Math.ceil(Math.max(...values) * 50) / 50 + 0.01;
  const ticks = Array.from({ length: Math.round((max - min) / 0.02) + 1 }, (_, i) => min + i * 0.02);
  const x = (value: number) => ((value - min) / (max - min)) * 100;
  return (
    <ChartCard
      title="How close are the predicted stars?"
      caption="RMSE: typical size of the error when predicting a hidden star rating. Lower is better. Note the zoomed axis."
      table={
        <table className={tableClass}>
          <thead>
            <tr>
              <th>Method</th>
              <th>RMSE (stars)</th>
              <th>How it predicts</th>
            </tr>
          </thead>
          <tbody>
            {RMSE_ROWS.map((row) => (
              <tr key={row.key} className="border-t border-line">
                <td>{row.label}</td>
                <td className="font-mono">{metrics.rmse[row.key].toFixed(4)}</td>
                <td className="text-ink-3">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="space-y-4 pr-2">
        {RMSE_ROWS.map((row) => {
          const value = metrics.rmse[row.key];
          return (
            <div key={row.key} className="grid grid-cols-[minmax(0,150px)_1fr] items-center gap-3 sm:grid-cols-[200px_1fr]">
              <div>
                <p className="text-sm">{row.label}</p>
                <p className="hidden text-[11px] text-ink-3 sm:block">{row.note}</p>
              </div>
              <div className="group relative h-8">
                <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
                <div
                  className="absolute top-1/2 h-px"
                  style={{ left: 0, width: `${x(value)}%`, background: row.color, opacity: 0.5 }}
                />
                <div
                  className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface-1 transition group-hover:scale-125"
                  style={{ left: `${x(value)}%`, background: row.color }}
                  title={`${row.label}: ${value.toFixed(4)}`}
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 pl-3 font-mono text-xs text-ink-2"
                  style={{ left: `${x(value)}%` }}
                >
                  {value.toFixed(3)}
                </span>
              </div>
            </div>
          );
        })}
        <div className="grid grid-cols-[minmax(0,150px)_1fr] gap-3 sm:grid-cols-[200px_1fr]">
          <span />
          <div className="relative h-4 text-[11px] text-ink-3">
            {ticks.map((tick) => (
              <span key={tick} className="absolute -translate-x-1/2 font-mono" style={{ left: `${x(tick)}%` }}>
                {tick.toFixed(2)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
