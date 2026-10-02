"""Run the whole pipeline on a tiny generated MovieLens folder (no network)."""

import numpy as np
import pandas as pd
import pytest

from recsys import config
from recsys.collaborative import bias_baseline, item_similarity, top_k_neighbors, train_factor_model
from recsys.content import build_documents, content_similarity
from recsys.data import load_dataset, user_ratings
from recsys.evaluate import (
    Models,
    cold_start_curve,
    evaluate_ranking,
    evaluate_rmse,
    pick_featured_users,
    relevant_items,
)
from recsys.export import build_metrics, movie_records, parity_cases, user_records
from recsys.scoring import like_counts, popularity_order, popularity_scores

N_USERS, N_MOVIES = 40, 40


@pytest.fixture
def movielens_dir(tmp_path):
    """Two taste groups: even users love the first half (Action), odd users the second (Romance)."""
    rng = np.random.default_rng(0)
    rows = []
    for user in range(1, N_USERS + 1):
        for movie in range(1, N_MOVIES + 1):
            if rng.random() < 0.5:
                loves = (movie <= N_MOVIES // 2) == (user % 2 == 0)
                rating = rng.choice([4.0, 4.5, 5.0]) if loves else rng.choice([1.0, 2.0, 2.5])
                rows.append((user, movie, rating, 0))
    pd.DataFrame(rows, columns=["userId", "movieId", "rating", "timestamp"]).to_csv(tmp_path / "ratings.csv", index=False)
    genres = ["Action" if movie <= N_MOVIES // 2 else "Romance" for movie in range(1, N_MOVIES + 1)]
    pd.DataFrame(
        {"movieId": range(1, N_MOVIES + 1), "title": [f"Film {m}, The (2001)" for m in range(1, N_MOVIES + 1)], "genres": genres}
    ).to_csv(tmp_path / "movies.csv", index=False)
    pd.DataFrame({"movieId": range(1, N_MOVIES + 1), "imdbId": 0, "tmdbId": range(101, 101 + N_MOVIES)}).to_csv(
        tmp_path / "links.csv", index=False
    )
    pd.DataFrame({"userId": [1], "movieId": [1], "tag": ["explosions"], "timestamp": [0]}).to_csv(
        tmp_path / "tags.csv", index=False
    )
    return tmp_path


def test_pipeline_end_to_end(movielens_dir, monkeypatch):
    monkeypatch.setattr(config, "COLD_START_MIN_TRAIN", 5)
    dataset = load_dataset(movielens_dir)
    assert dataset.n_users == N_USERS and dataset.n_items == N_MOVIES
    assert dataset.movies.loc[0, "title"] == "The Film 1"

    metadata = {101: {"poster": "/a.jpg", "directors": ["X"], "cast": [], "keywords": [], "overview": "o"}}
    collab_sim, co = item_similarity(dataset.train, dataset.n_users, dataset.n_items, 10)
    content_sim = content_similarity(build_documents(dataset.movies, metadata, dataset.tags))
    items, values = dataset.train["item"].to_numpy(), dataset.train["rating"].to_numpy()
    likes = like_counts(items, values, dataset.n_items)
    model = train_factor_model(dataset.train, dataset.n_users, dataset.n_items, factors=4, reg=1, iterations=5)
    models = Models(
        top_k_neighbors(collab_sim, 5, co),
        top_k_neighbors(content_sim, 5),
        model,
        popularity_order(items, values, dataset.n_items),
        popularity_scores(likes),
    )
    train_profiles = user_ratings(dataset.train, dataset.n_users)
    test_profiles = user_ratings(dataset.test, dataset.n_users)
    relevant = relevant_items(test_profiles)

    ranking, per_user = evaluate_ranking(models, train_profiles, relevant, dataset.n_items)
    # the taste groups are perfectly separable, so collaborative filtering must beat popularity
    assert ranking["collaborative"]["precision"] > ranking["popular"]["precision"]
    rmse = evaluate_rmse(
        dataset.test, train_profiles, bias_baseline(dataset.train, dataset.n_users, dataset.n_items),
        model, collab_sim, content_sim,
    )
    assert rmse["collaborative"] < rmse["baseline"]
    curve = cold_start_curve(models, train_profiles, relevant, steps=(1, 3))
    assert curve["steps"] == [1, 3] and len(curve["precision"]["hybrid"]) == 2

    assert per_user["users"]  # every evaluated user is listed
    featured = pick_featured_users(train_profiles)
    assert featured == []  # nobody has 50+ ratings in this tiny set
    records = movie_records(dataset, metadata, likes)
    assert records[0]["poster"] == "/a.jpg" and records[1]["poster"] is None
    assert records[0]["tags"] == ["explosions"]
    users = user_records(dataset, train_profiles, test_profiles)
    assert len(users[0]["ratings"]) == 2 * len(train_profiles[0])
    cases = parity_cases(train_profiles, [0, 1], models.collab_neighbors, models.content_neighbors, models.popular, models.popularity)
    assert {case["name"] for case in cases} >= {"empty profile", "user index 0"}
    metrics = build_metrics(dataset, metadata, ranking, rmse, curve)
    assert metrics["dataset"]["moviesWithPosters"] == 1
