import numpy as np
import pytest

from recsys import config
from recsys.collaborative import Neighbors
from recsys.evaluate import hits_at_n, relevant_items
from recsys.scoring import (
    hybrid_scores,
    hybrid_weight,
    like_counts,
    neighbor_scores,
    popularity_order,
    popularity_scores,
    rank_top_n,
    recommend_all,
)

# movie 0 -> similar to 1 (0.8) and 2 (0.4); movie 3 -> similar to 2 (0.5)
NEIGHBORS = Neighbors(
    idx=np.array([[1, 2], [0, -1], [3, 0], [2, -1]]),
    sim=np.array([[0.8, 0.4], [0.8, 0.0], [0.5, 0.4], [0.5, 0.0]]),
)


def test_neighbor_scores_weight_by_rating_above_neutral():
    scores = neighbor_scores({0: 5.0}, NEIGHBORS)
    assert scores == pytest.approx({1: 1.6, 2: 0.8})


def test_disliked_movies_push_neighbors_down_and_neutral_is_ignored():
    assert neighbor_scores({3: 1.0}, NEIGHBORS) == pytest.approx({2: -1.0})
    assert neighbor_scores({0: 3.0}, NEIGHBORS) == {}


def test_rated_movies_are_never_scored():
    assert 1 not in neighbor_scores({0: 5.0, 1: 4.0}, NEIGHBORS)


def test_rank_top_n_sorts_by_score_then_index_and_pads_with_popular():
    ranked = rank_top_n({4: 0.5, 2: 0.9, 3: 0.5, 5: -1.0}, exclude={9}, popular_order=[9, 3, 7, 8], n=5)
    assert ranked == [2, 3, 4, 7, 8]


def test_hybrid_weight_grows_with_ratings():
    assert hybrid_weight(0) == 0
    assert hybrid_weight(config.HYBRID_HALF_POINT) == 0.5
    assert hybrid_weight(1000) > 0.98


def test_hybrid_is_pure_popularity_for_a_new_user():
    popularity = [0.2, 1.0, 0.5]
    scores = hybrid_scores({}, {}, 0, popularity, prior=2.0)
    assert scores == pytest.approx({0: 0.4, 1: 2.0, 2: 1.0})
    assert hybrid_scores({}, {}, 0, popularity)[1] == config.POPULARITY_PRIOR


def test_hybrid_mixes_normalized_parts():
    scores = hybrid_scores({0: 2.0, 1: 1.0}, {1: 4.0}, n_ratings=10, popularity=[0.0, 0.0, 1.0], half_point=10, prior=2.0)
    # alpha = 0.5: movie 0 = 0.5*1, movie 1 = 0.5*0.5 + 0.5*1, movie 2 = 0.5*2*1
    assert scores == pytest.approx({0: 0.5, 1: 0.75, 2: 1.0})


def test_popularity_helpers():
    items = np.array([0, 0, 1, 2, 2, 2])
    ratings = np.array([5.0, 4.0, 2.0, 4.5, 1.0, 4.0])
    likes = like_counts(items, ratings, 3)
    assert likes == [2, 0, 2]
    assert popularity_scores(likes) == [1.0, 0.0, 1.0]
    assert popularity_order(items, ratings, 3) == [2, 0, 1]  # tie on likes -> more ratings first


def test_recommend_all_returns_four_lists_without_rated_movies():
    lists = recommend_all({0: 5.0}, NEIGHBORS, NEIGHBORS, popular=[0, 3, 2, 1], popularity=[1, 0.1, 0.3, 0.6], n=3)
    assert set(lists) == {"collaborative", "content", "hybrid", "popular"}
    for items in lists.values():
        assert 0 not in items and len(items) == 3
    assert lists["popular"] == [3, 2, 1]
    assert lists["collaborative"][:2] == [1, 2]


def test_metric_helpers():
    assert hits_at_n([1, 2, 3], {2, 3, 9}) == 2
    assert relevant_items([{1: 4.0, 2: 3.5}, {}]) == [{1}, set()]
