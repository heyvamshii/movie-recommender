"""Run every offline step: python pipeline/run_pipeline.py

Downloads MovieLens, fetches TMDB details (cached), builds the recommenders,
evaluates them and writes JSON into public/data/ for the dashboard.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from recsys import config  # noqa: E402
from recsys.collaborative import (  # noqa: E402
    bias_baseline,
    item_similarity,
    top_k_neighbors,
    train_factor_model,
)
from recsys.content import build_documents, content_similarity  # noqa: E402
from recsys.data import download_movielens, load_dataset, user_ratings  # noqa: E402
from recsys.evaluate import (  # noqa: E402
    Models,
    cold_start_curve,
    evaluate_ranking,
    evaluate_rmse,
    pick_featured_users,
    relevant_items,
)
from recsys.export import (  # noqa: E402
    build_metrics,
    movielens_likes,
    movie_records,
    neighbor_rows,
    parity_cases,
    write_json,
)
from recsys.userbased import evaluate_user_based  # noqa: E402
from recsys.scoring import like_counts, popularity_order, popularity_scores  # noqa: E402
from recsys.tmdb import fetch_metadata, load_token  # noqa: E402


def step(message: str, started: float) -> None:
    print(f"[{time.perf_counter() - started:6.1f}s] {message}")


def main() -> None:
    started = time.perf_counter()
    dataset = load_dataset(download_movielens())
    step(
        f"Data: {dataset.n_users} users, {dataset.n_items} movies, "
        f"{len(dataset.train)} train / {len(dataset.test)} test ratings",
        started,
    )

    tmdb_ids = [int(t) for t in dataset.movies["tmdbId"] if t is not None]
    metadata = fetch_metadata(tmdb_ids, load_token())
    step(f"TMDB: details for {len(metadata)} of {dataset.n_items} movies", started)

    collab_sim, co_raters = item_similarity(dataset.train, dataset.n_users, dataset.n_items, config.CO_RATER_SHRINKAGE)
    collab_neighbors = top_k_neighbors(collab_sim, config.NEIGHBORS_K, co_raters)
    content_sim = content_similarity(build_documents(dataset.movies, metadata, dataset.tags))
    content_neighbors = top_k_neighbors(content_sim, config.NEIGHBORS_K)
    factor_model = train_factor_model(dataset.train, dataset.n_users, dataset.n_items)
    train_items, train_values = dataset.train["item"].to_numpy(), dataset.train["rating"].to_numpy()
    likes = like_counts(train_items, train_values, dataset.n_items)
    popular = popularity_order(train_items, train_values, dataset.n_items)
    models = Models(collab_neighbors, content_neighbors, factor_model, popular, popularity_scores(likes))
    step("Models: item-item, content TF-IDF, SVD (ALS) and popularity built", started)

    train_profiles = user_ratings(dataset.train, dataset.n_users)
    test_profiles = user_ratings(dataset.test, dataset.n_users)
    relevant = relevant_items(test_profiles)
    ranking, _ = evaluate_ranking(models, train_profiles, relevant, dataset.n_items)
    ranking["userbased"] = evaluate_user_based(train_profiles, relevant, popular, dataset.n_items)
    baseline = bias_baseline(dataset.train, dataset.n_users, dataset.n_items)
    rmse = evaluate_rmse(dataset.test, train_profiles, baseline, factor_model, collab_sim, content_sim)
    cold_start = cold_start_curve(models, train_profiles, relevant)
    step("Evaluation done", started)
    for method, scores in ranking.items():
        print(
            f"    {method:13s} precision@10={scores['precision']:.3f} recall@10={scores['recall']:.3f} "
            f"coverage={scores['coverage']:.1%}"
        )
    for method, value in rmse.items():
        print(f"    RMSE {method:13s} {value:.4f}")
    for method, values in cold_start["precision"].items():
        print(f"    cold start {method:13s} " + " ".join(f"{v:.3f}" for v in values))

    typical_users = pick_featured_users(train_profiles)  # real profiles for the parity fixture
    sizes = {
        "movies.json": write_json(
            config.OUT_DIR / "movies.json", {"movies": movie_records(dataset, metadata, likes), "popular": popular}
        ),
        "neighbors.json": write_json(
            config.OUT_DIR / "neighbors.json",
            {"collaborative": neighbor_rows(collab_neighbors), "content": neighbor_rows(content_neighbors)},
        ),
        "metrics.json": write_json(
            config.OUT_DIR / "metrics.json", build_metrics(dataset, metadata, ranking, rmse, cold_start)
        ),
    }
    write_json(
        config.SERVER_DATA_FILE,
        {"movieIds": [int(m) for m in dataset.movies["movieId"]], "users": movielens_likes(dataset)},
    )
    write_json(
        config.FIXTURE_FILE, parity_cases(train_profiles, typical_users, collab_neighbors, content_neighbors, popular, models.popularity)
    )
    for name, size in sizes.items():
        print(f"    public/data/{name}: {size / 1024:.0f} KB")
    step("Export done", started)


if __name__ == "__main__":
    main()
