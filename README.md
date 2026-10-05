# ReelMatch: Movie Recommender Lab

Collaborative filtering vs content-based filtering vs a hybrid, on real MovieLens ratings, with
TMDB posters. The website looks like a streaming app, explains **why** every movie was
recommended, and recomputes recommendations **live in the browser** as you rate movies.

**Live demo:** _add your Vercel link here_

## What it shows

| Page | What you do | What it proves |
|---|---|---|
| **Browse** | Netflix-style rows for a MovieLens user or for you | Each method's picks, with a "why" on every card |
| **Try it yourself** | Start with 0 ratings, rate movies (or click a taste preset) | The cold-start problem, and how each method recovers |
| **Compare** | Pick any of 610 real users | Four methods side by side; ✓ marks movies the user really liked in their hidden ratings |
| **Results** | Read the charts | Precision@10, recall@10, coverage, RMSE and the cold-start curve |

## Results (held-out 20% of ratings)

| Method | Precision@10 | Recall@10 | Catalog coverage | RMSE |
|---|---|---|---|---|
| Popularity baseline | 0.123 | 0.104 | 2% | — |
| Collaborative (item-item) | 0.157 | 0.149 | 20% | **0.810** |
| SVD (matrix factorization, ALS) | 0.103 | 0.085 | 15% | 0.822 |
| Content-based (TF-IDF) | 0.065 | 0.056 | **43%** | 0.861 |
| **Hybrid** | **0.160** | **0.152** | 12% | — |

The simple bias baseline (mean + user bias + movie bias) has an RMSE of 0.840.

**Cold start** (precision@10 when a user has rated only *n* movies):

| n | 1 | 2 | 3 | 5 | 10 | 20 | 40 |
|---|---|---|---|---|---|---|---|
| Popular | 0.171 | 0.171 | 0.171 | 0.171 | 0.171 | 0.171 | 0.171 |
| Collaborative | 0.101 | 0.092 | 0.097 | 0.118 | 0.134 | 0.157 | 0.181 |
| Content | 0.072 | 0.045 | 0.038 | 0.041 | 0.042 | 0.055 | 0.069 |
| **Hybrid** | 0.171 | **0.175** | **0.176** | **0.185** | **0.193** | **0.192** | **0.203** |

What this means:
- Collaborative filtering needs about **40 ratings** before it beats "just show popular movies".
- The hybrid matches popularity for a user with 1 rating and beats every method from **2 ratings** on.
- Content-based filtering is the least accurate but recommends the widest range of movies, and it is
  the only method that could recommend a movie nobody has rated yet.

## How it works

```
[laptop, run once]  python pipeline/run_pipeline.py
  MovieLens small (GroupLens) → keep movies with ≥ 10 ratings → hide 20% of each user's ratings
  → TMDB: poster, director, cast, keywords (cached; uses TMDB_READ_TOKEN from .env)
  → item-item similarity · SVD (ALS) · TF-IDF content similarity · popularity
  → evaluate on the hidden 20% → public/data/*.json (~3.8 MB, ~1.4 MB gzipped)

[Vercel, live]  Next.js reads public/data/*.json
  → src/lib/recommend.ts scores every movie in the browser (a line-for-line port of scoring.py)
  → your ratings live in localStorage; nothing is sent to a server
```

**Hybrid formula:** `α × collaborative + (1 − α) × (content + 5 × popularity)`, where
`α = ratings / (ratings + 5)`. New users get content + popularity; regulars get mostly collaborative.
The SVD size and hybrid mix were tuned with `pipeline/tune.py` on a validation split carved out of the
training data; the test ratings were only used for the final numbers. Other settings (30 neighbors,
shrinkage 10, neutral rating 3) are standard defaults, not tuned.

**No secrets on the live site.** The TMDB token is used only by the Python script. Poster images
load from `image.tmdb.org`, which needs no key.

## Run it locally

Requirements: Node.js 20+, Python 3.11+.

```bash
npm install
npm run dev            # http://localhost:3000
```

To rebuild the data (optional, the JSON is already in `public/data/`):

```bash
python -m venv pipeline/.venv
pipeline/.venv/Scripts/pip install -r pipeline/requirements.txt   # macOS/Linux: pipeline/.venv/bin/pip
cp .env.example .env    # then paste your TMDB "API Read Access Token"
pipeline/.venv/Scripts/python pipeline/run_pipeline.py
```

## Tests

```bash
npm test                                        # TypeScript tests, incl. Python ↔ browser parity
npm run coverage                                # 100% line coverage of src/lib
cd pipeline && .venv/Scripts/python -m pytest --cov=recsys   # 36 Python tests, 95% coverage
```

## Project structure

```
pipeline/tune.py      validation-split tuning of SVD size and hybrid mix
pipeline/recsys/      data.py · tmdb.py · collaborative.py · content.py · scoring.py · evaluate.py · export.py
pipeline/tests/       pytest suite (unit + end-to-end on a generated mini MovieLens)
public/data/          movies.json · neighbors.json · users.json · metrics.json
src/lib/              recommend.ts (live scoring) · catalog.ts · explain.ts · storage.ts · verdict.ts
src/components/       Browse / Try / Compare views, movie cards, modal, charts
src/app/              routes: /, /try, /compare, /results
```

## Credits

- Ratings: [MovieLens](https://grouplens.org/datasets/movielens/) "ml-latest-small", F. Maxwell Harper and
  Joseph A. Konstan, 2015, *The MovieLens Datasets: History and Context*, ACM TiiS.
- Movie details and images: [TMDB](https://www.themoviedb.org/). This product uses the TMDB API but is not
  endorsed or certified by TMDB.
