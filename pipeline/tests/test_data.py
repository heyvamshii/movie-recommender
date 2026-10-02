import numpy as np
import pandas as pd

from recsys.data import filter_ratings, split_per_user, split_title, training_tags, user_ratings
from recsys.evaluate import pick_featured_users


def test_split_title_moves_article_and_extracts_year():
    assert split_title("Matrix, The (1999)") == ("The Matrix", 1999)
    assert split_title("Toy Story (1995)") == ("Toy Story", 1995)
    assert split_title("Untitled") == ("Untitled", None)


def test_filter_ratings_drops_rare_movies_then_light_users():
    ratings = pd.DataFrame(
        {"userId": [1, 1, 2, 2, 3], "movieId": [10, 20, 10, 20, 30], "rating": [4, 3, 5, 2, 1]}
    )
    kept = filter_ratings(ratings, min_per_movie=2, min_per_user=2)
    assert set(kept["movieId"]) == {10, 20}
    assert set(kept["userId"]) == {1, 2}


def test_split_per_user_holds_out_about_20_percent_and_keeps_training_rows(toy_ratings):
    many = pd.concat([toy_ratings.assign(item=toy_ratings["item"] + 4 * k) for k in range(5)], ignore_index=True)
    many = many.sort_values(["user", "item"]).reset_index(drop=True)
    train, test = split_per_user(many, test_fraction=0.2, seed=1)
    assert len(train) + len(test) == len(many)
    for user in range(4):
        assert len(test[test.user == user]) == 3  # 15 ratings x 20%
        assert len(train[train.user == user]) == 12
    merged = train.merge(test, on=["user", "item"])
    assert merged.empty


def test_split_is_reproducible(toy_ratings):
    first = split_per_user(toy_ratings, 0.2, seed=3)[1]
    second = split_per_user(toy_ratings, 0.2, seed=3)[1]
    pd.testing.assert_frame_equal(first, second)


def test_user_ratings_builds_sorted_dicts(toy_ratings):
    profiles = user_ratings(toy_ratings.sort_values(["user", "item"]), 4)
    assert profiles[0] == {0: 5.0, 1: 5.0, 2: 2.0}
    assert list(profiles[2]) == [0, 2, 3]


def test_filter_ratings_repeats_until_stable():
    # user 3 (one rating) goes; movies 10 and 30 keep two ratings each
    ratings = pd.DataFrame(
        {"userId": [1, 1, 2, 2, 3], "movieId": [10, 30, 10, 30, 99], "rating": [4] * 5}
    )
    kept = filter_ratings(ratings, min_per_movie=2, min_per_user=2)
    assert set(kept["movieId"]) == {10, 30}
    # here each removal starves the next movie/user, until nothing is left
    thinner = pd.DataFrame({"userId": [1, 1, 2, 3, 3], "movieId": [10, 30, 30, 10, 20], "rating": [4] * 5})
    assert filter_ratings(thinner, min_per_movie=2, min_per_user=2).empty


def test_training_tags_drop_tags_on_held_out_ratings():
    tags = pd.DataFrame({"userId": [5, 6, 5], "movieId": [100, 100, 999], "tag": ["a", "b", "c"]})
    test = pd.DataFrame({"user": [0], "item": [0], "rating": [4.0]})  # user 5 rated movie 100 in test
    kept = training_tags(tags, test, movie_ids=np.array([100]), user_ids=np.array([5, 6]))
    assert kept["tag"].tolist() == ["b"]


def test_featured_users_spread_over_profile_sizes():
    profiles = [{i: 4.0 for i in range(size)} for size in [10, 60, 80, 100, 120, 140, 160, 180, 400]]
    featured = pick_featured_users(profiles, count=3)
    assert len(featured) == 3 and 0 not in featured and 8 not in featured
    assert pick_featured_users(profiles[:3], count=3) == [1, 2]
