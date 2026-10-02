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

export type MovieLensUser = {
  id: number; // MovieLens userId
  ratings: Map<number, number>; // movie idx -> rating (training data)
  liked: Map<number, number>; // hidden test ratings >= 4, used to mark "hits"
};

export type Catalog = {
  movies: Movie[];
  popular: number[]; // movie idx, most liked first
  popularity: number[]; // likes / most likes, 0..1
  collaborative: NeighborList[];
  content: NeighborList[];
  users: MovieLensUser[];
  featured: number[]; // user idx
  indexById: Map<number, number>; // movieId -> idx
};

/** movie idx -> star rating (0.5..5) */
export type Profile = Map<number, number>;

export type Method = "collaborative" | "content" | "hybrid" | "popular";
export type EvalMethod = Method | "svd";

export type Reason =
  | { kind: "collaborative"; from: number; support: number }
  | { kind: "content"; from: number; shared: string[] }
  | { kind: "popular"; likes: number };

export type Recommendation = {
  idx: number;
  score: number;
  reason: Reason;
  /** hybrid only: how much each signal contributed (shares sum to 1) */
  mix?: { collaborative: number; content: number; popular: number };
};

export type RecommendationSet = Record<Method, Recommendation[]>;

export type Metrics = {
  generatedAt: string;
  dataset: {
    users: number;
    movies: number;
    ratings: number;
    trainRatings: number;
    testRatings: number;
    density: number;
    moviesWithPosters: number;
  };
  params: {
    topN: number;
    likeThreshold: number;
    neutralRating: number;
    neighborsK: number;
    hybridHalfPoint: number;
    popularityPrior: number;
    svdFactors: number;
    minRatingsPerMovie: number;
    testFraction: number;
  };
  ranking: Record<EvalMethod, { precision: number; recall: number; coverage: number }>;
  rmse: { baseline: number; collaborative: number; svd: number; content: number };
  coldStart: { steps: number[]; users: number; precision: Record<EvalMethod, number[]> };
};
