"""Top-N ranking from neighbor tables. Mirrored line-for-line in src/lib/recommend.ts.

Keep both files in step: the parity test in the dashboard checks that the browser
produces exactly the lists this module produces.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence

import numpy as np

from . import config
from .collaborative import Neighbors


def neighbor_scores(
    profile: Mapping[int, float], neighbors: Neighbors, neutral: float = config.NEUTRAL_RATING
) -> dict[int, float]:
    """score(movie) = sum over rated movies of similarity x (rating - neutral).

    Rated movies are visited in ascending index order so float sums match the browser.
    """
    scores: dict[int, float] = {}
    for rated in sorted(profile):
        weight = profile[rated] - neutral
        if weight == 0:
            continue
        for candidate, similarity in zip(neighbors.idx[rated], neighbors.sim[rated]):
            candidate = int(candidate)
            if candidate < 0 or candidate in profile:
                continue
            scores[candidate] = scores.get(candidate, 0.0) + float(similarity) * weight
    return scores


def hybrid_weight(n_ratings: int, half_point: float = config.HYBRID_HALF_POINT) -> float:
    """Share of the hybrid score taken from collaborative filtering.

    Few ratings -> lean on content + popularity (they work from day one).
    Many ratings -> lean on collaborative (it finds less obvious picks).
    """
    return n_ratings / (n_ratings + half_point)


def like_counts(train_items: np.ndarray, train_ratings: np.ndarray, n_items: int) -> list[int]:
    likes = np.bincount(train_items[train_ratings >= config.LIKE_THRESHOLD], minlength=n_items)
    return [int(count) for count in likes]


def popularity_scores(likes: Sequence[int]) -> list[float]:
    """Likes per movie divided by the most-liked movie's likes (0..1)."""
    most = max(likes)
    return [count / most for count in likes]


def _max_positive(scores: Mapping[int, float]) -> float:
    return max((value for value in scores.values() if value > 0), default=0.0)


def hybrid_scores(
    collab: Mapping[int, float],
    content: Mapping[int, float],
    n_ratings: int,
    popularity: Sequence[float],
    half_point: float = config.HYBRID_HALF_POINT,
    prior: float = config.POPULARITY_PRIOR,
) -> dict[int, float]:
    """alpha x collaborative + (1 - alpha) x (content + prior x popularity), parts scaled to 0..1."""
    alpha = hybrid_weight(n_ratings, half_point)
    cold = 1 - alpha
    collab_max, content_max = _max_positive(collab), _max_positive(content)
    combined: dict[int, float] = {}
    for item, popular_part in enumerate(popularity):
        collab_part = collab.get(item, 0.0) / collab_max if collab_max > 0 else 0.0
        content_part = content.get(item, 0.0) / content_max if content_max > 0 else 0.0
        combined[item] = alpha * collab_part + cold * (content_part + prior * popular_part)
    return combined


def rank_top_n(
    scores: Mapping[int, float],
    exclude: Iterable[int],
    popular_order: Iterable[int],
    n: int = config.TOP_N,
) -> list[int]:
    """Highest positive scores first (ties -> lower index); pad with popular movies."""
    excluded = set(exclude)
    ranked = sorted(
        ((item, value) for item, value in scores.items() if value > 0 and item not in excluded),
        key=lambda pair: (-pair[1], pair[0]),
    )
    chosen = [item for item, _ in ranked[:n]]
    taken = set(chosen)
    for item in popular_order:
        if len(chosen) >= n:
            break
        if item not in excluded and item not in taken:
            chosen.append(item)
            taken.add(item)
    return chosen


def popularity_order(train_items: np.ndarray, train_ratings: np.ndarray, n_items: int) -> list[int]:
    """Movies sorted by how many people liked them (rated >= 4), then by rating count."""
    likes = np.array(like_counts(train_items, train_ratings, n_items))
    counts = np.bincount(train_items, minlength=n_items)
    return [int(i) for i in np.lexsort((np.arange(n_items), -counts, -likes))]


def recommend_all(
    profile: Mapping[int, float],
    collab_neighbors: Neighbors,
    content_neighbors: Neighbors,
    popular: list[int],
    popularity: Sequence[float],
    exclude: Iterable[int] | None = None,
    n: int = config.TOP_N,
) -> dict[str, list[int]]:
    """The four lists the dashboard shows for one person."""
    excluded = set(profile) if exclude is None else set(exclude) | set(profile)
    collab = neighbor_scores(profile, collab_neighbors)
    content = neighbor_scores(profile, content_neighbors)
    return {
        "collaborative": rank_top_n(collab, excluded, popular, n),
        "content": rank_top_n(content, excluded, popular, n),
        "hybrid": rank_top_n(hybrid_scores(collab, content, len(profile), popularity), excluded, popular, n),
        "popular": rank_top_n({}, excluded, popular, n),
    }
