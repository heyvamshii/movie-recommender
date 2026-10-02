"""Collaborative filtering: item-item similarity and matrix factorization (SVD via ALS).

Both only look at who rated what. Neither knows anything about a movie's genre or cast.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy import sparse

from . import config


@dataclass(frozen=True)
class Neighbors:
    """Top-K similar movies for every movie. Rows are padded with -1 / 0.0."""

    idx: np.ndarray  # (n_items, K) int
    sim: np.ndarray  # (n_items, K) float, rounded to SIM_DECIMALS, descending
    support: np.ndarray | None = None  # (n_items, K) co-rater counts, collaborative only


def top_k_neighbors(similarity: np.ndarray, k: int, support: np.ndarray | None = None) -> Neighbors:
    """Keep each row's k most similar positive entries (never the movie itself)."""
    sim = similarity.copy()
    np.fill_diagonal(sim, 0.0)
    n_items = sim.shape[0]
    k = min(k, n_items - 1)
    # sort by (-similarity, index) so ties resolve the same way every run
    order = np.lexsort((np.broadcast_to(np.arange(n_items), sim.shape), -sim), axis=1)[:, :k]
    top_sim = np.round(np.take_along_axis(sim, order, axis=1), config.SIM_DECIMALS)
    keep = top_sim > 0
    idx = np.where(keep, order, -1).astype(np.int32)
    top_sim = np.where(keep, top_sim, 0.0)
    top_support = None
    if support is not None:
        top_support = np.where(keep, np.take_along_axis(support, order, axis=1), 0).astype(np.int32)
    return Neighbors(idx=idx, sim=top_sim, support=top_support)


def rating_matrix(train: pd.DataFrame, n_users: int, n_items: int) -> sparse.csr_matrix:
    return sparse.csr_matrix(
        (train["rating"].to_numpy(), (train["user"].to_numpy(), train["item"].to_numpy())),
        shape=(n_users, n_items),
    )


def item_similarity(train: pd.DataFrame, n_users: int, n_items: int, shrinkage: float) -> tuple[np.ndarray, np.ndarray]:
    """Adjusted cosine between movies, damped when few people rated both.

    Ratings are centered on each user's mean first, so a harsh critic's 3 and a generous
    rater's 4 can mean the same thing.
    """
    user_mean = train.groupby("user")["rating"].mean()
    centered = train["rating"].to_numpy() - user_mean.reindex(train["user"]).to_numpy()
    rows, cols = train["user"].to_numpy(), train["item"].to_numpy()
    centered_matrix = sparse.csr_matrix((centered, (rows, cols)), shape=(n_users, n_items))
    rated = sparse.csr_matrix((np.ones(len(train)), (rows, cols)), shape=(n_users, n_items))

    dot = (centered_matrix.T @ centered_matrix).toarray()
    norms = np.sqrt(np.diag(dot))
    with np.errstate(divide="ignore", invalid="ignore"):
        cosine = dot / np.outer(norms, norms)
    cosine = np.nan_to_num(cosine, nan=0.0, posinf=0.0, neginf=0.0)
    co_raters = (rated.T @ rated).toarray()
    damped = cosine * co_raters / (co_raters + shrinkage)
    return damped, co_raters.astype(np.int32)


@dataclass(frozen=True)
class FactorModel:
    """rating ~ mean + user_bias + item_bias + user_vector . item_vector"""

    mean: float
    user_vectors: np.ndarray
    user_bias: np.ndarray
    item_vectors: np.ndarray
    item_bias: np.ndarray
    reg: float

    def predict(self, users: np.ndarray, items: np.ndarray) -> np.ndarray:
        dots = np.sum(self.user_vectors[users] * self.item_vectors[items], axis=1)
        return self.mean + self.user_bias[users] + self.item_bias[items] + dots

    def fold_in(self, items: np.ndarray, ratings: np.ndarray) -> tuple[np.ndarray, float]:
        """Learn a vector for a new user from a few ratings, keeping movie vectors fixed."""
        target = ratings - self.mean - self.item_bias[items]
        solution = _ridge_solve(self.item_vectors[items], target, self.reg)
        return solution[:-1], float(solution[-1])

    def score_all(self, user_vector: np.ndarray, user_bias: float) -> np.ndarray:
        return self.mean + user_bias + self.item_bias + self.item_vectors @ user_vector


def _ridge_solve(features: np.ndarray, target: np.ndarray, reg: float) -> np.ndarray:
    """Least squares for [vector, bias] with an L2 penalty."""
    design = np.hstack([features, np.ones((len(features), 1))])
    gram = design.T @ design + reg * np.eye(design.shape[1])
    return np.linalg.solve(gram, design.T @ target)


def _group(keys: np.ndarray, n_groups: int) -> list[np.ndarray]:
    order = np.argsort(keys, kind="stable")
    bounds = np.searchsorted(keys[order], np.arange(n_groups + 1))
    return [order[bounds[g] : bounds[g + 1]] for g in range(n_groups)]


def train_factor_model(
    train: pd.DataFrame,
    n_users: int,
    n_items: int,
    factors: int = config.SVD_FACTORS,
    reg: float = config.SVD_REG,
    iterations: int = config.SVD_ITERATIONS,
    seed: int = config.SEED,
) -> FactorModel:
    """Alternating least squares: fix movies, solve users; fix users, solve movies; repeat."""
    users = train["user"].to_numpy()
    items = train["item"].to_numpy()
    ratings = train["rating"].to_numpy()
    mean = float(ratings.mean())
    rng = np.random.default_rng(seed)
    user_vectors = 0.1 * rng.standard_normal((n_users, factors))
    item_vectors = 0.1 * rng.standard_normal((n_items, factors))
    user_bias = np.zeros(n_users)
    item_bias = np.zeros(n_items)
    by_user, by_item = _group(users, n_users), _group(items, n_items)

    for _ in range(iterations):
        for user, rows in enumerate(by_user):
            if len(rows) == 0:
                continue
            target = ratings[rows] - mean - item_bias[items[rows]]
            solution = _ridge_solve(item_vectors[items[rows]], target, reg)
            user_vectors[user], user_bias[user] = solution[:-1], solution[-1]
        for item, rows in enumerate(by_item):
            if len(rows) == 0:
                continue
            target = ratings[rows] - mean - user_bias[users[rows]]
            solution = _ridge_solve(user_vectors[users[rows]], target, reg)
            item_vectors[item], item_bias[item] = solution[:-1], solution[-1]

    return FactorModel(mean, user_vectors, user_bias, item_vectors, item_bias, reg)


def bias_baseline(train: pd.DataFrame, n_users: int, n_items: int) -> tuple[float, np.ndarray, np.ndarray]:
    """mean + how generous the user is + how well-liked the movie is (regularized)."""
    mean = float(train["rating"].mean())
    item_dev = train.assign(dev=train["rating"] - mean).groupby("item")["dev"]
    item_bias = np.zeros(n_items)
    item_bias[item_dev.sum().index] = (item_dev.sum() / (item_dev.count() + 10)).to_numpy()
    residual = train["rating"] - mean - item_bias[train["item"].to_numpy()]
    user_dev = train.assign(dev=residual).groupby("user")["dev"]
    user_bias = np.zeros(n_users)
    user_bias[user_dev.sum().index] = (user_dev.sum() / (user_dev.count() + 15)).to_numpy()
    return mean, user_bias, item_bias
