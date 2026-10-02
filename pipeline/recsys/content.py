"""Content-based filtering: movies are similar when their descriptions overlap.

Each movie becomes a bag of feature tokens (genres, director, cast, TMDB keywords,
MovieLens user tags, decade). TF-IDF makes rare shared features (same director) count
for more than common ones (both are Dramas).
"""

from __future__ import annotations

import re
from collections import defaultdict

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

MAX_TAGS_PER_MOVIE = 10
TOKEN_CLEANER = re.compile(r"[^a-z0-9]+")


def token(kind: str, value: str) -> str:
    cleaned = TOKEN_CLEANER.sub("_", value.lower()).strip("_")
    return f"{kind}:{cleaned}" if cleaned else ""


def movie_tags(tags: pd.DataFrame) -> dict[int, list[str]]:
    """Most frequent user tags per movieId."""
    counts: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for movie_id, tag in tags[["movieId", "tag"]].itertuples(index=False):
        if isinstance(tag, str) and tag.strip():
            counts[int(movie_id)][tag.strip().lower()] += 1
    return {
        movie_id: [tag for tag, _ in sorted(tag_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:MAX_TAGS_PER_MOVIE]]
        for movie_id, tag_counts in counts.items()
    }


def build_documents(movies: pd.DataFrame, metadata: dict[int, dict], tags: pd.DataFrame) -> list[list[str]]:
    """One token list per movie, in movie index order."""
    tags_by_movie = movie_tags(tags)
    documents = []
    for row in movies.itertuples(index=False):
        tokens = [token("genre", genre) for genre in row.genres]
        if row.year:
            tokens.append(token("decade", f"{int(row.year) // 10 * 10}s"))
        meta = metadata.get(row.tmdbId) if row.tmdbId is not None else None
        if meta:
            tokens += [token("director", name) for name in meta["directors"]]
            tokens += [token("cast", name) for name in meta["cast"]]
            tokens += [token("keyword", name) for name in meta["keywords"]]
            if meta.get("language") and meta["language"] != "en":
                tokens.append(token("language", meta["language"]))
        tokens += [token("tag", tag) for tag in tags_by_movie.get(int(row.movieId), [])]
        documents.append(sorted({t for t in tokens if t}))
    return documents


def content_similarity(documents: list[list[str]]) -> np.ndarray:
    """Cosine similarity between TF-IDF vectors (rows are L2-normalized)."""
    vectorizer = TfidfVectorizer(analyzer=lambda doc: doc, sublinear_tf=True)
    matrix = vectorizer.fit_transform(documents)
    return (matrix @ matrix.T).toarray()
