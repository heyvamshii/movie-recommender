import numpy as np

from recsys.collaborative import bias_baseline, item_similarity, top_k_neighbors, train_factor_model
from recsys.content import build_documents, content_similarity, token
from recsys.data import user_ratings
from recsys.evaluate import neighborhood_predict, rmse


def test_item_similarity_groups_movies_liked_by_the_same_people(toy_ratings):
    sim, co_raters = item_similarity(toy_ratings, 4, 4, shrinkage=0)
    assert sim[0, 1] > 0  # same fans
    assert sim[2, 3] > 0
    assert sim[0, 3] < 0  # opposite fans
    assert co_raters[0, 1] == 2
    np.testing.assert_allclose(sim, sim.T)


def test_shrinkage_damps_similarity_with_few_co_raters(toy_ratings):
    plain, _ = item_similarity(toy_ratings, 4, 4, shrinkage=0)
    damped, _ = item_similarity(toy_ratings, 4, 4, shrinkage=10)
    assert 0 < damped[0, 1] < plain[0, 1]


def test_top_k_neighbors_keeps_positive_sorted_and_excludes_self():
    sim = np.array([[1.0, 0.2, 0.9, -0.5], [0.2, 1.0, 0.0, 0.3], [0.9, 0.0, 1.0, 0.1], [-0.5, 0.3, 0.1, 1.0]])
    neighbors = top_k_neighbors(sim, k=3, support=np.full((4, 4), 7))
    assert neighbors.idx[0].tolist() == [2, 1, -1]
    assert neighbors.sim[0].tolist() == [0.9, 0.2, 0.0]
    assert neighbors.support[0].tolist() == [7, 7, 0]
    assert 1 not in neighbors.idx[1]


def test_top_k_neighbors_breaks_ties_by_lower_index():
    sim = np.array([[1.0, 0.5, 0.5], [0.5, 1.0, 0.5], [0.5, 0.5, 1.0]])
    assert top_k_neighbors(sim, k=2).idx[2].tolist() == [0, 1]


def test_factor_model_learns_and_fold_in_matches_training_user(toy_ratings):
    model = train_factor_model(toy_ratings, 4, 4, factors=2, reg=0.1, iterations=30, seed=0)
    users, items = toy_ratings["user"].to_numpy(), toy_ratings["item"].to_numpy()
    assert rmse(model.predict(users, items), toy_ratings["rating"].to_numpy()) < 0.5
    rows = toy_ratings[toy_ratings.user == 0]
    vector, bias = model.fold_in(rows["item"].to_numpy(), rows["rating"].to_numpy())
    scores = model.score_all(vector, bias)
    assert scores[1] > scores[3]  # user 0 loves movie 1's fans' taste, not movie 3's


def test_bias_baseline_captures_generous_users(toy_ratings):
    mean, user_bias, item_bias = bias_baseline(toy_ratings, 4, 4)
    assert 3.0 < mean < 3.6
    assert user_bias.shape == (4,) and item_bias.shape == (4,)


def test_neighborhood_predict_uses_similar_rated_movies(toy_ratings):
    sim, _ = item_similarity(toy_ratings, 4, 4, shrinkage=0)
    profiles = user_ratings(toy_ratings[~((toy_ratings.user == 0) & (toy_ratings.item == 1))], 4)
    test = toy_ratings[(toy_ratings.user == 0) & (toy_ratings.item == 1)].reset_index(drop=True)
    predicted = neighborhood_predict(sim, profiles, test, k=5)
    assert predicted[0] > 4  # movie 0 (rated 5) is its closest neighbor


def test_token_normalizes_names():
    assert token("director", "Christopher Nolan") == "director:christopher_nolan"
    assert token("genre", "Sci-Fi") == "genre:sci_fi"
    assert token("tag", "!!!") == ""


def test_content_documents_and_similarity():
    import pandas as pd

    movies = pd.DataFrame(
        {
            "movieId": [1, 2, 3],
            "title": ["A", "B", "C"],
            "year": [1999, 2001, 1975],
            "genres": [["Sci-Fi"], ["Sci-Fi"], ["Romance"]],
            "tmdbId": [11, 22, None],
        }
    )
    metadata = {
        11: {"directors": ["Ann Lee"], "cast": [], "keywords": ["robot"], "language": "en"},
        22: {"directors": ["Ann Lee"], "cast": [], "keywords": ["robot"], "language": "fr"},
    }
    tags = pd.DataFrame({"movieId": [3, 3], "tag": ["sweet", "Sweet"]})
    docs = build_documents(movies, metadata, tags)
    assert "director:ann_lee" in docs[0] and "language:fr" in docs[1]
    assert docs[2] == ["decade:1970s", "genre:romance", "tag:sweet"]
    sim = content_similarity(docs)
    assert sim[0, 1] > 0.5
    assert sim[0, 2] == 0
