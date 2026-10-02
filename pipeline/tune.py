"""Choose the SVD size and hybrid mix WITHOUT touching the test set: python pipeline/tune.py

The training ratings are split again (80/20) into a smaller train set and a validation set.
Every setting is scored on validation only. The winners are what config.py uses; the real
test set is then used once, by run_pipeline.py, for the published numbers.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from recsys import config  # noqa: E402
from recsys.collaborative import item_similarity, top_k_neighbors, train_factor_model  # noqa: E402
from recsys.content import build_documents, content_similarity  # noqa: E402
from recsys.data import download_movielens, load_dataset, split_per_user, user_ratings  # noqa: E402
from recsys.evaluate import hits_at_n, relevant_items, rmse  # noqa: E402
from recsys.scoring import (  # noqa: E402
    hybrid_scores,
    like_counts,
    neighbor_scores,
    popularity_order,
    popularity_scores,
    rank_top_n,
)
from recsys.tmdb import fetch_metadata  # noqa: E402

VALIDATION_SEED = 7
SVD_GRID = [(factors, reg) for factors in (10, 20, 40) for reg in (2.0, 5.0, 8.0, 15.0, 25.0)]
HYBRID_GRID = [(half, prior) for half in (5, 10, 20) for prior in (0.0, 1.0, 2.0, 3.0, 5.0)]
COLD_STEPS = (1, 3, 5, 10, 20, 40)


def main() -> None:
    dataset = load_dataset(download_movielens())
    train, validation = split_per_user(dataset.train, config.TEST_FRACTION, VALIDATION_SEED)
    n_users, n_items = dataset.n_users, dataset.n_items
    print(f"Tuning on {len(train)} train / {len(validation)} validation ratings (test set untouched)\n")

    print("SVD: validation RMSE (lower is better)")
    users, items, actual = validation["user"].to_numpy(), validation["item"].to_numpy(), validation["rating"].to_numpy()
    svd_results = []
    for factors, reg in SVD_GRID:
        model = train_factor_model(train, n_users, n_items, factors=factors, reg=reg)
        svd_results.append((rmse(model.predict(users, items), actual), factors, reg))
        print(f"  factors={factors:<3} reg={reg:<5} RMSE={svd_results[-1][0]:.4f}")
    best_rmse, best_factors, best_reg = min(svd_results)
    print(f"  -> best: factors={best_factors}, reg={best_reg} (RMSE {best_rmse:.4f})\n")

    metadata = fetch_metadata([int(t) for t in dataset.movies["tmdbId"] if t is not None], token=None)
    collab_sim, co_raters = item_similarity(train, n_users, n_items, config.CO_RATER_SHRINKAGE)
    collab = top_k_neighbors(collab_sim, config.NEIGHBORS_K, co_raters)
    content = top_k_neighbors(content_similarity(build_documents(dataset.movies, metadata, dataset.tags)), config.NEIGHBORS_K)
    train_items, train_values = train["item"].to_numpy(), train["rating"].to_numpy()
    popular = popularity_order(train_items, train_values, n_items)
    popularity = popularity_scores(like_counts(train_items, train_values, n_items))
    profiles = user_ratings(train, n_users)
    relevant = relevant_items(user_ratings(validation, n_users))

    rng = np.random.default_rng(1)
    cold_users = [u for u in range(n_users) if len(profiles[u]) >= max(COLD_STEPS) and relevant[u]]
    histories = {u: rng.permutation(list(profiles[u])) for u in cold_users}
    all_users = [u for u in range(n_users) if relevant[u] and profiles[u]]

    def precision(half: float, prior: float, n: int | None) -> float:
        hits = 0
        group = all_users if n is None else cold_users
        for user in group:
            profile = profiles[user] if n is None else {int(i): profiles[user][int(i)] for i in histories[user][:n]}
            scores = hybrid_scores(
                neighbor_scores(profile, collab), neighbor_scores(profile, content), len(profile), popularity, half, prior
            )
            hits += hits_at_n(rank_top_n(scores, set(profiles[user]), popular), relevant[user])
        return hits / (len(group) * config.TOP_N)

    print("Hybrid: validation precision@10 (higher is better)")
    print("  half  prior  " + "  ".join(f"n={n:<3}" for n in COLD_STEPS) + "  all    mean")
    hybrid_results = []
    for half, prior in HYBRID_GRID:
        row = [precision(half, prior, n) for n in COLD_STEPS] + [precision(half, prior, None)]
        hybrid_results.append((float(np.mean(row)), half, prior))
        print(f"  {half:<5} {prior:<5}  " + "  ".join(f"{value:.3f}" for value in row) + f"  {np.mean(row):.3f}")
    best_mean, best_half, best_prior = max(hybrid_results)
    print(f"  -> best: HYBRID_HALF_POINT={best_half}, POPULARITY_PRIOR={best_prior} (mean {best_mean:.3f})")
    print(
        f"\nconfig.py currently uses SVD_FACTORS={config.SVD_FACTORS}, SVD_REG={config.SVD_REG}, "
        f"HYBRID_HALF_POINT={config.HYBRID_HALF_POINT}, POPULARITY_PRIOR={config.POPULARITY_PRIOR}"
    )


if __name__ == "__main__":
    main()
