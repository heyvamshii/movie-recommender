# ReelMatch: Movie Recommender Lab

Sign in, like movies, and watch four recommendation methods react side by side. Each account
keeps its own likes, and **"People like you"** recommends what users with overlapping taste liked,
including the other accounts on the site. Built on real MovieLens ratings, with posters from TMDB.

**Live demo:** _add your Vercel link here_

## The three methods

| Method | Idea | Good at | Weak at |
|---|---|---|---|
| **People like you** (user-based) | Users whose likes overlap with yours also liked… | Most accurate here; other users shape your feed | Needs at least one like and many users |
| **Collaborative** | People who loved the same movies as you also loved… | Surprising, high-quality picks | Needs lots of ratings first |
| **Content-based** | Movies that look like your picks (director, actors, genre, keywords) | Works from your first pick, easy to explain | More of the same |
| **Hybrid** | Both mixed, leaning on popular movies until it knows you | Best overall, good for new users | Slightly harder to explain |

## Demo accounts

| Username | Starts with |
|---|---|
| `user1`, `user2` | no likes (use these for the live demo) |
| `user3` | superhero and sci-fi likes |
| `user4` | romantic comedy likes |

Password for all demo accounts: `reelmatch-demo`

## How to use the demo

1. Sign in as `user1`. With no likes, the columns can only show what is popular.
2. Like **The Avengers** (search for it). Every column updates instantly, and "People like you"
   now shows user3's movies: "Liked by user3, who also likes The Avengers".
3. Sign out, sign in as `user2`, like **The Avengers** and **Toy Story**. Sign back in as `user1`:
   Toy Story is now at the top of user1's feed, "Liked by user2, who also likes The Avengers".
4. In each column:
   - **NEW** marks movies that just appeared, **▲/▼** shows movies that moved.
   - Each column header counts how many are new.
   - Every movie says why it is there ("Because you liked The Matrix", "Similar to Toy Story").
5. **Which is best?** shows how the methods compare on real people.

## Which method is best?

We tested each method on 610 real MovieLens users: for every person we hid some of the movies
they loved and counted how many of each method's 10 suggestions were those hidden movies.

| Method | Correct guesses out of 10 |
|---|---|
| People like you (user-based) | 1.99 |
| Hybrid | 1.60 |
| Collaborative | 1.57 |
| Popular (same list for everyone) | 1.23 |
| Content-based | 0.65 |

Matching you with similar people beats matching movies with similar movies. Hybrid and
collaborative are almost tied; the hybrid is already good after a few picks, while collaborative
needs dozens of ratings before it beats "Popular".

## How it works

```
[laptop, run once]  python pipeline/run_pipeline.py
  MovieLens ratings → TMDB details (posters, director, cast, keywords)
  → build the three methods → test them → small JSON files in public/data/

[website]  Next.js on Vercel
  login        → signed, httpOnly session cookie (demo accounts, scrypt-hashed password)
  likes        → saved per account in Supabase Postgres (server-only access, row level security)
  people like you → computed on the server: your likes vs every account + 610 MovieLens users
  other 3 methods → computed in your browser from the precomputed JSON
```

The website's ranking code (`src/lib/recommend.ts`) is an exact copy of the Python version, and
an automated test checks that both pick the same movies.

<details>
<summary>Technical details</summary>

- **Collaborative:** item-item similarity (adjusted cosine, damped for few shared raters), 30 neighbors per movie.
- **Content-based:** TF-IDF over genres, director, cast, TMDB keywords and user tags; cosine similarity.
- **Hybrid:** `α × collaborative + (1 − α) × (content + 2 × popularity)`, with `α = picks / (picks + 5)`.
  Chosen by `pipeline/tune.py` on a validation split of the training data: the setting that relies least
  on popularity among those within 3% of the best score. The test data was only used for the final numbers.
- **People like you (user-based):** similarity between two people = shared likes ÷ √(my likes × their likes);
  the 40 most similar MovieLens users plus every overlapping account on the site vote for the movies they liked.
  Accounts on the site count 5× (they are the live community). Same formula in `pipeline/recsys/userbased.py`
  (offline score) and `src/lib/userBased.ts` (live feed).
- **Also evaluated offline** (in `public/data/metrics.json`): SVD matrix factorization, recall, catalog
  coverage, rating error (RMSE) and accuracy by number of ratings.

</details>

## Deploy (Vercel + Supabase)

1. Create a free project at [supabase.com](https://supabase.com). In **SQL Editor**, paste and run
   `supabase/schema.sql` (creates the `likes` table, locks it down, adds the demo likes).
2. In Vercel → **Settings → Environment Variables**, add (see `.env.example`):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SESSION_SECRET`, then redeploy.

## Run it locally

```bash
npm install
npm run dev            # http://localhost:3000
```

Without Supabase settings, local development saves likes to `data/app-likes.json`.

Rebuild the data (optional, the JSON is already in `public/data/`):

```bash
python -m venv pipeline/.venv
pipeline/.venv/Scripts/pip install -r pipeline/requirements.txt   # macOS/Linux: pipeline/.venv/bin/pip
cp .env.example .env    # then paste your TMDB "API Read Access Token"
pipeline/.venv/Scripts/python pipeline/run_pipeline.py
```

Tests: `npm test` (TypeScript) and `cd pipeline && .venv/Scripts/python -m pytest` (Python).

## Credits

- Ratings: [MovieLens](https://grouplens.org/datasets/movielens/) "ml-latest-small" (GroupLens Research,
  University of Minnesota). F. Maxwell Harper and Joseph A. Konstan, 2015, *The MovieLens Datasets: History and Context*.
- Movie details and images: [TMDB](https://www.themoviedb.org/). This product uses the TMDB API but is not
  endorsed or certified by TMDB.
