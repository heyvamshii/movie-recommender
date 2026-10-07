import math

import pytest

from recsys.userbased import evaluate_user_based, neighbors, user_based_scores

# same case as src/lib/userBased.test.ts, so both implementations agree
PEOPLE = [{1, 2, 3}, {1, 4}, {5}, set()]
MINE = {1, 2}


def test_neighbors_use_cosine_of_like_sets_and_skip_strangers():
    found = neighbors(MINE, PEOPLE)
    assert [person for person, _ in found] == [0, 1]
    assert found[0][1] == pytest.approx(2 / math.sqrt(6))
    assert found[1][1] == pytest.approx(0.5)


def test_scores_sum_similarities_of_people_who_liked_the_movie():
    assert user_based_scores(MINE, PEOPLE) == pytest.approx({3: 2 / math.sqrt(6), 4: 0.5})
    assert user_based_scores({9}, PEOPLE) == {}
    assert neighbors({1}, [{1}, {1}], k=1) == [(0, 1.0)]


def test_evaluation_finds_hidden_likes_of_look_alike_users():
    train = [{0: 5.0, 1: 5.0}, {0: 5.0, 1: 4.0, 2: 5.0}, {3: 5.0}]
    relevant = [{2}, {3}, set()]
    result = evaluate_user_based(train, relevant, popular=[0, 1, 2, 3], n_items=4, n=1)
    # user 0 learns movie 2 from user 1; user 1 has no one to learn from and falls back to popular (movie 3)
    assert result["precision"] == pytest.approx(1.0)
    assert 0 < result["coverage"] <= 1
