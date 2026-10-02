"""Paths and tuning constants shared by every pipeline step.

The scoring constants (NEUTRAL_RATING, HYBRID_HALF_POINT, TOP_N) are mirrored in
src/lib/recommend.ts so the live dashboard ranks movies exactly like the evaluation did.
"""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = PROJECT_ROOT / "data" / "raw"
TMDB_CACHE_FILE = RAW_DIR / "tmdb_cache.json"
OUT_DIR = PROJECT_ROOT / "public" / "data"
FIXTURE_FILE = PROJECT_ROOT / "src" / "lib" / "__fixtures__" / "parity.json"
ENV_FILE = PROJECT_ROOT / ".env"

MOVIELENS_URL = "https://files.grouplens.org/datasets/movielens/ml-latest-small.zip"
MOVIELENS_DIRNAME = "ml-latest-small"

SEED = 42
MIN_RATINGS_PER_MOVIE = 10  # rarer movies have too little signal for collaborative filtering
MIN_RATINGS_PER_USER = 5
TEST_FRACTION = 0.2

LIKE_THRESHOLD = 4.0  # a held-out rating >= 4 counts as "the user liked it"
NEUTRAL_RATING = 3.0  # ratings above this push similar movies up, below push them down
TOP_N = 10
NEIGHBORS_K = 30  # similar movies kept per movie in the exported tables
SIM_DECIMALS = 4  # similarities are rounded so Python and the browser use identical numbers
CO_RATER_SHRINKAGE = 10  # damp similarities that rest on only a few shared raters
HYBRID_HALF_POINT = 5  # with this many ratings the hybrid is 50% collaborative (tuned: pipeline/tune.py)
POPULARITY_PRIOR = 5.0  # how strongly the hybrid leans on popular movies while you are new (tuned)
PREDICTION_NEIGHBORS = 30  # neighbors used when predicting a single rating (RMSE)

# chosen on a validation split carved out of the training data (test set untouched)
SVD_FACTORS = 40
SVD_REG = 8.0
SVD_ITERATIONS = 15

COLD_START_STEPS = (1, 2, 3, 5, 10, 20, 40)
COLD_START_MIN_TRAIN = 40

OVERVIEW_MAX_CHARS = 300
KEYWORDS_PER_MOVIE = 8
CAST_PER_MOVIE = 3
