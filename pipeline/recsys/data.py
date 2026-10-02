"""Download, load, filter and split the MovieLens 'small' dataset."""

from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import requests

from . import config

YEAR_PATTERN = re.compile(r"\s*\((\d{4})\)\s*$")


@dataclass(frozen=True)
class Dataset:
    """Ratings re-indexed to dense 0..n-1 ids, plus per-movie info in index order."""

    movies: pd.DataFrame  # index = movie idx; movieId, title, year, genres, tmdbId
    train: pd.DataFrame  # columns: user, item, rating
    test: pd.DataFrame
    user_ids: np.ndarray  # user idx -> original MovieLens userId
    tags: pd.DataFrame  # movieId, tag

    @property
    def n_users(self) -> int:
        return len(self.user_ids)

    @property
    def n_items(self) -> int:
        return len(self.movies)


def download_movielens(raw_dir: Path = config.RAW_DIR) -> Path:
    """Download and unzip MovieLens small once; later runs reuse the local copy."""
    target = raw_dir / config.MOVIELENS_DIRNAME
    if (target / "ratings.csv").exists():
        return target
    raw_dir.mkdir(parents=True, exist_ok=True)
    print(f"Downloading MovieLens small from {config.MOVIELENS_URL} ...")
    response = requests.get(config.MOVIELENS_URL, timeout=120)
    response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        archive.extractall(raw_dir)
    if not (target / "ratings.csv").exists():
        raise FileNotFoundError(f"ratings.csv missing after unzip in {target}")
    return target


def split_title(raw_title: str) -> tuple[str, int | None]:
    """'Matrix, The (1999)' -> ('The Matrix', 1999)."""
    title = raw_title.strip()
    year = None
    match = YEAR_PATTERN.search(title)
    if match:
        year = int(match.group(1))
        title = title[: match.start()].strip()
    # MovieLens stores leading articles at the end: "Matrix, The"
    article = re.match(r"^(.*), (The|A|An|Les|La|Le|Il|Das|Die|El)$", title)
    if article:
        title = f"{article.group(2)} {article.group(1)}"
    return title, year


def filter_ratings(ratings: pd.DataFrame, min_per_movie: int, min_per_user: int) -> pd.DataFrame:
    """Drop rare movies and light users, repeating until both limits hold at once."""
    kept = ratings
    while True:
        movie_counts = kept["movieId"].value_counts()
        user_counts = kept["userId"].value_counts()
        next_kept = kept[
            kept["movieId"].isin(movie_counts[movie_counts >= min_per_movie].index)
            & kept["userId"].isin(user_counts[user_counts >= min_per_user].index)
        ]
        if len(next_kept) == len(kept):
            return kept.copy()
        kept = next_kept


def split_per_user(ratings: pd.DataFrame, test_fraction: float, seed: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Hold back a random share of every user's ratings (at least one) as the test set."""
    rng = np.random.default_rng(seed)
    test_mask = np.zeros(len(ratings), dtype=bool)
    positions = np.arange(len(ratings))
    for _, rows in ratings.groupby("user", sort=True).indices.items():
        n_test = max(1, int(round(len(rows) * test_fraction)))
        if n_test >= len(rows):
            continue  # a user needs at least one training rating
        chosen = rng.choice(rows, size=n_test, replace=False)
        test_mask[positions[chosen]] = True
    return ratings[~test_mask].reset_index(drop=True), ratings[test_mask].reset_index(drop=True)


def load_dataset(source_dir: Path) -> Dataset:
    ratings = pd.read_csv(source_dir / "ratings.csv")
    movies = pd.read_csv(source_dir / "movies.csv")
    links = pd.read_csv(source_dir / "links.csv")
    tags = pd.read_csv(source_dir / "tags.csv")

    ratings = filter_ratings(ratings, config.MIN_RATINGS_PER_MOVIE, config.MIN_RATINGS_PER_USER)
    movie_ids = np.sort(ratings["movieId"].unique())
    user_ids = np.sort(ratings["userId"].unique())
    movie_index = {mid: idx for idx, mid in enumerate(movie_ids)}
    user_index = {uid: idx for idx, uid in enumerate(user_ids)}

    indexed = pd.DataFrame(
        {
            "user": ratings["userId"].map(user_index).astype(np.int32),
            "item": ratings["movieId"].map(movie_index).astype(np.int32),
            "rating": ratings["rating"].astype(float),
        }
    ).sort_values(["user", "item"], kind="stable").reset_index(drop=True)
    train, test = split_per_user(indexed, config.TEST_FRACTION, config.SEED)

    info = (
        pd.DataFrame({"movieId": movie_ids})
        .merge(movies, on="movieId", how="left")
        .merge(links[["movieId", "tmdbId"]], on="movieId", how="left")
    )
    parsed = info["title"].map(split_title)
    info["title"] = parsed.map(lambda pair: pair[0])
    info["year"] = parsed.map(lambda pair: pair[1])
    info["genres"] = info["genres"].map(
        lambda text: [] if text == "(no genres listed)" else str(text).split("|")
    )
    info["tmdbId"] = info["tmdbId"].map(lambda value: None if pd.isna(value) else int(value))

    return Dataset(
        movies=info,
        train=train,
        test=test,
        user_ids=user_ids,
        tags=training_tags(tags, test, movie_ids, user_ids),
    )


def training_tags(tags: pd.DataFrame, test: pd.DataFrame, movie_ids: np.ndarray, user_ids: np.ndarray) -> pd.DataFrame:
    """User tags for kept movies, minus tags on held-out ratings (a tag reveals the user saw it)."""
    held_out = set(zip(user_ids[test["user"].to_numpy()].tolist(), movie_ids[test["item"].to_numpy()].tolist()))
    kept = tags[tags["movieId"].isin(set(movie_ids.tolist()))]
    pairs = zip(kept["userId"].tolist(), kept["movieId"].tolist())
    mask = [pair not in held_out for pair in pairs]
    return kept[mask][["movieId", "tag"]].reset_index(drop=True)


def user_ratings(frame: pd.DataFrame, n_users: int) -> list[dict[int, float]]:
    """Per-user {item: rating} dicts, items in ascending order."""
    result: list[dict[int, float]] = [{} for _ in range(n_users)]
    for user, item, rating in frame[["user", "item", "rating"]].itertuples(index=False):
        result[int(user)][int(item)] = float(rating)
    return result
