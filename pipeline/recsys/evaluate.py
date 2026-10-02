"""Offline evaluation on the held-back 20% of ratings.

- precision@10 / recall@10: of the 10 movies we recommend, how many did the user
  actually rate >= 4 in the hidden test set?
- RMSE: how far off are predicted star ratings (lower is better)?
- coverage: what share of the catalog ever gets recommended to anyone?
- cold-start curve: precision@10 when a user has rated only 1, 2, 3, 5 ... movies.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import config
from .collaborative import FactorModel, Neighbors
from .scoring import hybrid_scores, neighbor_scores, rank_top_n

METHODS = ("popular", "collaborative", "svd", "content", "hybrid")


@dataclass(frozen=True)
class Models:
    collab_neighbors: Neighbors
    content_neighbors: Neighbors
    factor_model: FactorModel
    popular: list[int]
    popularity: list[float]


def hits_at_n(recommended: list[int], relevant: set[int]) -> int:
    return sum(1 for item in recommended if item in relevant)


def svd_top_n(model: FactorModel, vector: np.ndarray, bias: float, exclude: set[int], n: int) -> list[int]:
    scores = model.score_all(vector, bias)
    if exclude:
        scores[list(exclude)] = -np.inf
    order = np.lexsort((np.arange(len(scores)), -scores))
    return [int(i) for i in order[:n]]


def lists_for_profile(
    models: Models,
    profile: Mapping[int, float],
    exclude: set[int],
    svd_vector: tuple[np.ndarray, float],
    n: int = config.TOP_N,
) -> dict[str, list[int]]:
    collab = neighbor_scores(profile, models.collab_neighbors)
    content = neighbor_scores(profile, models.content_neighbors)
    return {
        "popular": rank_top_n({}, exclude, models.popular, n),
        "collaborative": rank_top_n(collab, exclude, models.popular, n),
        "svd": svd_top_n(models.factor_model, svd_vector[0], svd_vector[1], exclude, n),
        "content": rank_top_n(content, exclude, models.popular, n),
        "hybrid": rank_top_n(
            hybrid_scores(collab, content, len(profile), models.popularity), exclude, models.popular, n
        ),
    }


def relevant_items(test_profiles: list[dict[int, float]]) -> list[set[int]]:
    return [{item for item, rating in ratings.items() if rating >= config.LIKE_THRESHOLD} for ratings in test_profiles]


def evaluate_ranking(
    models: Models, train_profiles: list[dict[int, float]], relevant: list[set[int]], n_items: int
) -> tuple[dict[str, dict[str, float]], dict[str, list[int]]]:
    """Average precision/recall over users who liked at least one hidden movie."""
    hits: dict[str, list[int]] = {method: [] for method in METHODS}
    recall: dict[str, list[float]] = {method: [] for method in METHODS}
    seen: dict[str, set[int]] = {method: set() for method in METHODS}
    evaluated_users = []
    model = models.factor_model
    for user, profile in enumerate(train_profiles):
        if not relevant[user] or not profile:
            continue
        evaluated_users.append(user)
        vector = (model.user_vectors[user], float(model.user_bias[user]))
        for method, items in lists_for_profile(models, profile, set(profile), vector).items():
            user_hits = hits_at_n(items, relevant[user])
            hits[method].append(user_hits)
            recall[method].append(user_hits / len(relevant[user]))
            seen[method].update(items)
    summary = {
        method: {
            "precision": float(np.mean(hits[method]) / config.TOP_N),
            "recall": float(np.mean(recall[method])),
            "coverage": len(seen[method]) / n_items,
        }
        for method in METHODS
    }
    per_user_hits = {method: hits[method] for method in METHODS}
    per_user_hits["users"] = evaluated_users
    return summary, per_user_hits


def neighborhood_predict(
    similarity: np.ndarray, train_profiles: list[dict[int, float]], test: pd.DataFrame, k: int
) -> np.ndarray:
    """Predict each test rating from the user's k most similar rated movies."""
    predictions = np.empty(len(test))
    for user, rows in test.groupby("user").indices.items():
        profile = train_profiles[user]
        rated = np.fromiter(profile.keys(), dtype=np.int64)
        ratings = np.fromiter(profile.values(), dtype=float)
        mean = ratings.mean()
        sims = similarity[np.ix_(test["item"].to_numpy()[rows], rated)]
        sims = np.where(sims > 0, sims, 0.0)
        if sims.shape[1] > k:
            cutoff = np.partition(sims, -k, axis=1)[:, -k][:, None]
            sims = np.where(sims >= cutoff, sims, 0.0)
        weight = sims.sum(axis=1)
        with np.errstate(divide="ignore", invalid="ignore"):
            estimate = mean + (sims @ (ratings - mean)) / weight
        predictions[rows] = np.where(weight > 0, estimate, mean)
    return np.clip(predictions, 0.5, 5.0)


def rmse(predicted: np.ndarray, actual: np.ndarray) -> float:
    return float(np.sqrt(np.mean((np.clip(predicted, 0.5, 5.0) - actual) ** 2)))


def evaluate_rmse(
    test: pd.DataFrame,
    train_profiles: list[dict[int, float]],
    baseline: tuple[float, np.ndarray, np.ndarray],
    model: FactorModel,
    collab_similarity: np.ndarray,
    content_similarity: np.ndarray,
) -> dict[str, float]:
    users, items, actual = test["user"].to_numpy(), test["item"].to_numpy(), test["rating"].to_numpy()
    mean, user_bias, item_bias = baseline
    k = config.PREDICTION_NEIGHBORS
    return {
        "baseline": rmse(mean + user_bias[users] + item_bias[items], actual),
        "collaborative": rmse(neighborhood_predict(collab_similarity, train_profiles, test, k), actual),
        "svd": rmse(model.predict(users, items), actual),
        "content": rmse(neighborhood_predict(content_similarity, train_profiles, test, k), actual),
    }


def cold_start_curve(
    models: Models,
    train_profiles: list[dict[int, float]],
    relevant: list[set[int]],
    steps: tuple[int, ...] = config.COLD_START_STEPS,
    seed: int = config.SEED,
) -> dict[str, object]:
    """Pretend each experienced user has only rated n movies, and measure precision@10."""
    users = [
        user
        for user, profile in enumerate(train_profiles)
        if len(profile) >= config.COLD_START_MIN_TRAIN and relevant[user]
    ]
    rng = np.random.default_rng(seed)
    # one shuffled rating history per user; the first n items are "what they rated so far"
    histories = {user: rng.permutation(np.fromiter(train_profiles[user].keys(), dtype=np.int64)) for user in users}
    curve: dict[str, list[float]] = {method: [] for method in METHODS}
    for n in steps:
        totals = dict.fromkeys(METHODS, 0)
        for user in users:
            known = histories[user][:n]
            profile = {int(item): train_profiles[user][int(item)] for item in sorted(known)}
            ratings = np.array([profile[item] for item in profile])
            vector = models.factor_model.fold_in(np.array(list(profile)), ratings)
            lists = lists_for_profile(models, profile, set(train_profiles[user]), vector)
            for method, items in lists.items():
                totals[method] += hits_at_n(items, relevant[user])
        for method in METHODS:
            curve[method].append(totals[method] / (len(users) * config.TOP_N))
    return {"steps": list(steps), "users": len(users), "precision": curve}


def pick_featured_users(train_profiles: list[dict[int, float]], count: int = 6) -> list[int]:
    """Demo profiles spread evenly over users with 50-300 ratings.

    Chosen from profile size only (never from test results), so they are typical users,
    not the ones where some method happened to shine.
    """
    candidates = sorted((len(profile), user) for user, profile in enumerate(train_profiles) if 50 <= len(profile) <= 300)
    if len(candidates) <= count:
        return [user for _, user in candidates]
    step = len(candidates) / count
    return [candidates[int(i * step + step / 2)][1] for i in range(count)]
