export type Movie = {
  id: number; // MovieLens movieId
  title: string;
  year: number | null;
  genres: string[];
  poster: string | null;
  backdrop: string | null;
  overview: string;
  runtime: number | null;
  directors: string[];
  cast: string[];
  keywords: string[];
  tags: string[];
  ratings: number; // training ratings
  likes: number; // training ratings >= 4
  avg: number | null;
  tmdb: number | null;
};

/** Similar movies for one movie, most similar first. `support` = people who rated both. */
export type NeighborList = { ids: number[]; sims: number[]; support: number[] | null };

export type Catalog = {
  movies: Movie[];
  popular: number[]; // movie idx, most liked first
  popularity: number[]; // likes / most likes, 0..1
  collaborative: NeighborList[];
  content: NeighborList[];
  indexById: Map<number, number>; // movieId -> idx
};

/** movie idx -> star rating (0.5..5) */
export type Profile = Map<number, number>;

/** Methods computed in the browser from the precomputed tables. */
export type BaseMethod = "collaborative" | "content" | "hybrid" | "popular";
/** "userbased" is computed on the server, because it needs every account's likes. */
export type Method = BaseMethod | "userbased";
export type EvalMethod = Method | "svd";

export type Reason =
  | { kind: "collaborative"; from: number; support: number }
  | { kind: "content"; from: number; shared: string[] }
  | { kind: "popular"; likes: number }
  | { kind: "userbased"; supporters: number; friend: { name: string; shared: number[] } | null };

export type Recommendation = {
  idx: number;
  score: number;
  reason: Reason;
  /** hybrid only: how much each signal contributed (shares sum to 1) */
  mix?: { collaborative: number; content: number; popular: number };
};

export type BaseRecommendationSet = Record<BaseMethod, Recommendation[]>;
export type RecommendationSet = Record<Method, Recommendation[]>;

/** The parts of metrics.json the "Which is best?" page shows. */
export type Metrics = {
  generatedAt: string;
  dataset: { users: number; movies: number; ratings: number; moviesWithPosters: number };
  ranking: Record<EvalMethod, { precision: number }>;
};
