"""User-based collaborative filtering: "people whose likes overlap with yours also liked...".

Mirrored in src/lib/userBased.ts, which runs on the server for logged-in users.
A "like" is a rating >= LIKE_THRESHOLD. Similarity between two people is the cosine of
their like sets: shared likes / sqrt(my likes x their likes).
"""

from __future__ import annotations

import math
from collections.abc import Iterable, Sequence

import numpy as np

from . import config
from .scoring import rank_top_n


def neighbors(mine: set[int], others: Sequence[set[int]], k: int = config.USER_NEIGHBORS) -> list[tuple[int, float]]:
    """The k most similar people (index, similarity) who share at least one like."""
    scored = []
    for person, theirs in enumerate(others):
        shared = len(mine & theirs)
        if shared and theirs:
            scored.append((person, shared / math.sqrt(len(mine) * len(theirs))))
    scored.sort(key=lambda pair: (-pair[1], pair[0]))
    return scored[:k]


def user_based_scores(mine: set[int], others: Sequence[set[int]], k: int = config.USER_NEIGHBORS) -> dict[int, float]:
    """score(movie) = sum of similarities of the similar people who liked it."""
    scores: dict[int, float] = {}
    for person, similarity in neighbors(mine, others, k):
        for movie in others[person]:
            if movie not in mine:
                scores[movie] = scores.get(movie, 0.0) + similarity
    return scores


def evaluate_user_based(
    train_profiles: list[dict[int, float]],
    relevant: list[set[int]],
    popular: Iterable[int],
    n_items: int,
    n: int = config.TOP_N,
) -> dict[str, float]:
    """precision@n of user-based recommendations on the held-out likes (same protocol as the others)."""
    popular = list(popular)
    liked = [{item for item, rating in profile.items() if rating >= config.LIKE_THRESHOLD} for profile in train_profiles]
    hits, recall, seen = [], [], set()
    for user, profile in enumerate(train_profiles):
        if not relevant[user] or not profile:
            continue
        others = [theirs if other != user else set() for other, theirs in enumerate(liked)]
        scores = user_based_scores(liked[user], others) if liked[user] else {}
        items = rank_top_n(scores, set(profile), popular, n)
        user_hits = sum(1 for item in items if item in relevant[user])
        hits.append(user_hits)
        recall.append(user_hits / len(relevant[user]))
        seen.update(items)
    return {
        "precision": float(np.mean(hits) / n),
        "recall": float(np.mean(recall)),
        "coverage": len(seen) / n_items,
    }
