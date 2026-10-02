/** TMDB image URLs need no API key, so the live site never holds a secret. */
const IMAGE_BASE = "https://image.tmdb.org/t/p";

export type PosterSize = "w185" | "w342" | "w500";
export type BackdropSize = "w780" | "w1280";

export function posterUrl(path: string | null, size: PosterSize = "w342"): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export function backdropUrl(path: string | null, size: BackdropSize = "w1280"): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

/** Fallback card colors per first genre, so posterless movies still look intentional. */
const GENRE_TINTS: Record<string, [string, string]> = {
  Action: ["#4a1d1d", "#a33a2c"],
  Adventure: ["#3b2a12", "#b0772a"],
  Animation: ["#16324a", "#2f86b8"],
  Children: ["#1d3a2a", "#3f9a63"],
  Comedy: ["#3d3512", "#c4a227"],
  Crime: ["#1e1e26", "#5a5a6e"],
  Documentary: ["#22302e", "#5f8a83"],
  Drama: ["#2b1f33", "#7b4f96"],
  Fantasy: ["#2a1f45", "#7a5cc9"],
  "Film-Noir": ["#111114", "#4a4a52"],
  Horror: ["#250d0d", "#7a1414"],
  Musical: ["#3b1530", "#b2457f"],
  Mystery: ["#16213a", "#3d5a9e"],
  Romance: ["#3b1621", "#c2485f"],
  "Sci-Fi": ["#0f2a33", "#2a9cb3"],
  Thriller: ["#1f1a14", "#7a6340"],
  War: ["#22261a", "#6b7550"],
  Western: ["#33220f", "#a0652a"],
};
const DEFAULT_TINT: [string, string] = ["#1f2127", "#4b4f5c"];

export function genreGradient(genres: string[]): string {
  const [dark, light] = GENRE_TINTS[genres[0]] ?? DEFAULT_TINT;
  return `linear-gradient(160deg, ${light} 0%, ${dark} 75%)`;
}
