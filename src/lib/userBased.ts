/**
 * User-based collaborative filtering, mirrored from pipeline/recsys/userbased.py:
 * similarity = shared likes / sqrt(my likes x their likes); a movie's score is the sum of
 * similarities of the most similar people who liked it.
 */
export const USER_NEIGHBORS = 40;

/** weight scales a person's influence (default 1); the site's own accounts count more than dataset users. */
export type Person = { id: string; name: string | null; likes: ReadonlySet<number>; weight?: number };
export type Match = { person: Person; similarity: number; shared: number[] };

export function similarPeople(mine: ReadonlySet<number>, people: Person[], k = USER_NEIGHBORS): Match[] {
  const matches: Match[] = [];
  for (const person of people) {
    if (person.likes.size === 0) continue;
    const shared = [...mine].filter((movie) => person.likes.has(movie));
    if (shared.length === 0) continue;
    matches.push({ person, similarity: shared.length / Math.sqrt(mine.size * person.likes.size), shared });
  }
  return matches.sort((a, b) => b.similarity - a.similarity || (a.person.id < b.person.id ? -1 : 1)).slice(0, k);
}

export type UserBasedRec = {
  movieId: number;
  score: number;
  /** how many of the similar people liked it */
  supporters: number;
  /** named app users among them, most similar first */
  appUsers: { name: string; shared: number[] }[];
};

export function userBasedRecs(mine: ReadonlySet<number>, matches: Match[], n = 10): UserBasedRec[] {
  const recs = new Map<number, UserBasedRec>();
  for (const { person, similarity, shared } of matches) {
    for (const movie of person.likes) {
      if (mine.has(movie)) continue;
      const rec = recs.get(movie) ?? { movieId: movie, score: 0, supporters: 0, appUsers: [] };
      rec.score += similarity * (person.weight ?? 1);
      rec.supporters += 1;
      if (person.name) rec.appUsers.push({ name: person.name, shared });
      recs.set(movie, rec);
    }
  }
  return [...recs.values()].sort((a, b) => b.score - a.score || a.movieId - b.movieId).slice(0, n);
}
