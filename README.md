# ReelMatch: Movie Recommender Lab

Click a movie you love and watch three recommendation methods react side by side, live in
your browser. Built on real MovieLens ratings, with posters from TMDB.

**Live demo:** _add your Vercel link here_

## The three methods

| Method | Idea | Good at | Weak at |
|---|---|---|---|
| **Collaborative** | People who loved the same movies as you also loved… | Surprising, high-quality picks | Needs lots of ratings first |
| **Content-based** | Movies that look like your picks (director, actors, genre, keywords) | Works from your first pick, easy to explain | More of the same |
| **Hybrid** | Both mixed, leaning on popular movies until it knows you | Best overall, good for new users | Slightly harder to explain |

## How to use the demo

1. Open the site. With no picks, all three columns show the same popular movies.
2. Click a movie you love. All three columns update instantly:
   - **NEW** marks movies that just appeared, **▲/▼** shows movies that moved.
   - Each column header counts how many are new.
   - Every movie says why it is there ("Because you liked The Matrix", "Similar to Toy Story").
3. Click more movies and watch the hybrid's bar shift from "popular" toward "your picks".
4. **Which is best?** shows how the methods compare on real people.

## Which method is best?

We tested each method on 610 real MovieLens users: for every person we hid some of the movies
they loved and counted how many of each method's 10 suggestions were those hidden movies.

| Method | Correct guesses out of 10 |
|---|---|
| Hybrid | 1.60 |
| Collaborative | 1.57 |
| Popular (same list for everyone) | 1.23 |
| Content-based | 0.65 |

Hybrid and collaborative are almost tied overall; the hybrid is the one that is already good
after a few picks, while collaborative needs dozens of ratings before it beats "Popular".

## How it works

```
[laptop, run once]  python pipeline/run_pipeline.py
  MovieLens ratings → TMDB details (posters, director, cast, keywords)
  → build the three methods → test them → small JSON files in public/data/

[website]  Next.js loads the JSON and computes recommendations in your browser.
  Your picks stay in your browser; nothing is sent to a server, and no API key is needed.
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
- **Also evaluated offline** (in `public/data/metrics.json`): SVD matrix factorization, recall, catalog
  coverage, rating error (RMSE) and accuracy by number of ratings.

</details>

## Run it locally

```bash
npm install
npm run dev            # http://localhost:3000
```

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
