"""Write the small JSON files the dashboard loads from public/data/."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from . import config
from .collaborative import Neighbors
from .content import movie_tags
from .data import Dataset
from .scoring import recommend_all

MOVIE_TAGS_EXPORTED = 5


def write_json(path: Path, payload: Any) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def _rating(value: float) -> float | int:
    """4.0 -> 4, 3.5 -> 3.5 (shorter JSON, same number)."""
    return int(value) if float(value).is_integer() else float(value)


def movie_records(dataset: Dataset, metadata: dict[int, dict], likes: list[int]) -> list[dict[str, Any]]:
    counts = np.bincount(dataset.train["item"], minlength=dataset.n_items)
    sums = np.bincount(dataset.train["item"], weights=dataset.train["rating"], minlength=dataset.n_items)
    tags_by_movie = movie_tags(dataset.tags)
    records = []
    for idx, row in enumerate(dataset.movies.itertuples(index=False)):
        meta = metadata.get(row.tmdbId, {}) if row.tmdbId is not None else {}
        overview = meta.get("overview", "")
        if len(overview) > config.OVERVIEW_MAX_CHARS:
            overview = overview[: config.OVERVIEW_MAX_CHARS].rsplit(" ", 1)[0] + "…"
        records.append(
            {
                "id": int(row.movieId),
                "title": row.title,
                "year": None if pd.isna(row.year) else int(row.year),
                "genres": list(row.genres),
                "poster": meta.get("poster"),
                "backdrop": meta.get("backdrop"),
                "overview": overview,
                "runtime": meta.get("runtime"),
                "directors": meta.get("directors", []),
                "cast": meta.get("cast", []),
                "keywords": meta.get("keywords", []),
                "tags": tags_by_movie.get(int(row.movieId), [])[:MOVIE_TAGS_EXPORTED],
                "ratings": int(counts[idx]),
                "likes": likes[idx],
                "avg": round(float(sums[idx] / counts[idx]), 2) if counts[idx] else None,
                "tmdb": row.tmdbId,
            }
        )
    return records


def neighbor_rows(neighbors: Neighbors) -> list[list[float | int]]:
    """Each movie -> flat [idx, sim, (support,) idx, sim, ...] without padding."""
    rows = []
    for movie in range(len(neighbors.idx)):
        flat: list[float | int] = []
        for slot, neighbor in enumerate(neighbors.idx[movie]):
            if neighbor < 0:
                break
            flat += [int(neighbor), float(neighbors.sim[movie, slot])]
            if neighbors.support is not None:
                flat.append(int(neighbors.support[movie, slot]))
        rows.append(flat)
    return rows


def parity_cases(
    train_profiles: list[dict[int, float]],
    featured: list[int],
    collab: Neighbors,
    content: Neighbors,
    popular: list[int],
    popularity: list[float],
) -> list[dict[str, Any]]:
    """Inputs and expected lists the TypeScript port must reproduce exactly."""
    new_user = {popular[0]: 5.0, popular[7]: 4.5, popular[25]: 1.0}
    profiles = {"empty profile": {}, "new user, 3 ratings": new_user}
    for user in featured[:3]:
        profiles[f"user index {user}"] = train_profiles[user]
    profiles["one disliked movie"] = {popular[3]: 0.5}
    profiles["neutral and half stars"] = {popular[1]: 3.0, popular[2]: 3.5, popular[4]: 2.5, popular[9]: 4.5}
    rng = np.random.default_rng(config.SEED)
    for case in range(4):
        size = int(rng.integers(2, 40))
        items = rng.choice(len(popularity), size=size, replace=False)
        stars = rng.integers(1, 11, size=size) / 2
        profiles[f"random profile {case + 1} ({size} ratings)"] = {
            int(item): float(star) for item, star in zip(items, stars)
        }
    return [
        {
            "name": name,
            "profile": [[item, rating] for item, rating in sorted(profile.items())],
            "expected": recommend_all(profile, collab, content, popular, popularity),
        }
        for name, profile in profiles.items()
    ]


def build_metrics(
    dataset: Dataset,
    metadata: dict[int, dict],
    ranking: dict[str, dict[str, float]],
    rmse: dict[str, float],
    cold_start: dict[str, Any],
) -> dict[str, Any]:
    n_ratings = len(dataset.train) + len(dataset.test)
    posters = sum(
        1 for tmdb_id in dataset.movies["tmdbId"] if tmdb_id is not None and metadata.get(tmdb_id, {}).get("poster")
    )
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataset": {
            "users": dataset.n_users,
            "movies": dataset.n_items,
            "ratings": n_ratings,
            "trainRatings": len(dataset.train),
            "testRatings": len(dataset.test),
            "density": n_ratings / (dataset.n_users * dataset.n_items),
            "moviesWithPosters": posters,
        },
        "params": {
            "topN": config.TOP_N,
            "likeThreshold": config.LIKE_THRESHOLD,
            "neutralRating": config.NEUTRAL_RATING,
            "neighborsK": config.NEIGHBORS_K,
            "hybridHalfPoint": config.HYBRID_HALF_POINT,
            "popularityPrior": config.POPULARITY_PRIOR,
            "svdFactors": config.SVD_FACTORS,
            "minRatingsPerMovie": config.MIN_RATINGS_PER_MOVIE,
            "testFraction": config.TEST_FRACTION,
        },
        "ranking": ranking,
        "rmse": rmse,
        "coldStart": cold_start,
    }
