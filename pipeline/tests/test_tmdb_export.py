import json

import numpy as np
import pytest

from recsys import tmdb
from recsys.collaborative import Neighbors
from recsys.export import _rating, neighbor_rows, write_json

PAYLOAD = {
    "poster_path": "/p.jpg",
    "backdrop_path": "/b.jpg",
    "overview": " A heist. ",
    "runtime": 120,
    "original_language": "en",
    "credits": {
        "crew": [{"name": "Ann Lee", "job": "Director"}, {"name": "Bo", "job": "Writer"}],
        "cast": [{"name": "C", "order": 1}, {"name": "A", "order": 0}, {"name": "D", "order": 2}, {"name": "E", "order": 3}],
    },
    "keywords": {"keywords": [{"name": "heist"}]},
}


class FakeResponse:
    def __init__(self, status, payload=None):
        self.status_code = status
        self.ok = 200 <= status < 300
        self._payload = payload or {}
        self.headers = {"Retry-After": "0"}

    def json(self):
        return self._payload


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.headers = {}

    def get(self, *args, **kwargs):
        return self.responses.pop(0)


def test_summarize_keeps_needed_fields():
    summary = tmdb.summarize(PAYLOAD)
    assert summary["directors"] == ["Ann Lee"]
    assert summary["cast"] == ["A", "C", "D"]
    assert summary["overview"] == "A heist."
    assert summary["keywords"] == ["heist"]


def test_fetch_one_handles_404_401_and_rate_limit(monkeypatch):
    monkeypatch.setattr(tmdb.time, "sleep", lambda _: None)
    assert tmdb.fetch_one(FakeSession([FakeResponse(404)]), 1) is None
    with pytest.raises(PermissionError):
        tmdb.fetch_one(FakeSession([FakeResponse(401)]), 1)
    result = tmdb.fetch_one(FakeSession([FakeResponse(429), FakeResponse(200, PAYLOAD)]), 1)
    assert result["poster"] == "/p.jpg"
    with pytest.raises(RuntimeError):
        tmdb.fetch_one(FakeSession([FakeResponse(500)] * tmdb.MAX_RETRIES), 1)


def test_fetch_metadata_uses_cache_without_token(tmp_path):
    cache = tmp_path / "cache.json"
    cache.write_text(json.dumps({"5": {"poster": "/x.jpg"}, "6": None}))
    assert tmdb.fetch_metadata([5, 6, 7], token=None, cache_file=cache) == {5: {"poster": "/x.jpg"}}


def test_fetch_metadata_caches_new_results(tmp_path, monkeypatch):
    cache = tmp_path / "cache.json"
    monkeypatch.setattr(tmdb, "fetch_one", lambda session, tmdb_id: {"poster": f"/{tmdb_id}.jpg"})
    result = tmdb.fetch_metadata([1, 2], token="t", cache_file=cache)
    assert result[2] == {"poster": "/2.jpg"}
    assert json.loads(cache.read_text())["1"] == {"poster": "/1.jpg"}


def test_load_token_reads_env_file(tmp_path, monkeypatch):
    monkeypatch.delenv("TMDB_READ_TOKEN", raising=False)
    env = tmp_path / ".env"
    env.write_text("TMDB_READ_TOKEN=abc\n")
    assert tmdb.load_token(env) == "abc"


def test_neighbor_rows_flatten_and_drop_padding():
    neighbors = Neighbors(
        idx=np.array([[1, -1], [0, 2]]), sim=np.array([[0.5, 0.0], [0.5, 0.25]]), support=np.array([[3, 0], [3, 9]])
    )
    assert neighbor_rows(neighbors) == [[1, 0.5, 3], [0, 0.5, 3, 2, 0.25, 9]]


def test_write_json_is_compact(tmp_path):
    size = write_json(tmp_path / "a" / "b.json", {"x": [1, 2]})
    assert (tmp_path / "a" / "b.json").read_text() == '{"x":[1,2]}'
    assert size == 11


def test_rating_shortens_whole_numbers():
    assert _rating(4.0) == 4 and isinstance(_rating(4.0), int)
    assert _rating(3.5) == 3.5
