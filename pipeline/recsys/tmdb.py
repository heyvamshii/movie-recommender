"""Fetch poster paths and movie details from TMDB once, with a local cache.

The token is only used here, on the laptop. The dashboard loads poster images straight
from image.tmdb.org, which needs no key, so the token never reaches GitHub or Vercel.
"""

from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

from . import config

API_URL = "https://api.themoviedb.org/3/movie/{tmdb_id}"
MAX_WORKERS = 8
MAX_RETRIES = 6
REQUEST_TIMEOUT = 20


def load_token(env_file: Path = config.ENV_FILE) -> str | None:
    load_dotenv(env_file)
    token = os.environ.get("TMDB_READ_TOKEN", "").strip()
    return token or None


def summarize(payload: dict[str, Any]) -> dict[str, Any]:
    """Keep only the fields the dashboard and the content model use."""
    crew = payload.get("credits", {}).get("crew", [])
    cast = sorted(payload.get("credits", {}).get("cast", []), key=lambda person: person.get("order", 999))
    keywords = payload.get("keywords", {}).get("keywords", [])
    return {
        "poster": payload.get("poster_path"),
        "backdrop": payload.get("backdrop_path"),
        "overview": (payload.get("overview") or "").strip(),
        "runtime": payload.get("runtime") or None,
        "directors": [person["name"] for person in crew if person.get("job") == "Director"],
        "cast": [person["name"] for person in cast[: config.CAST_PER_MOVIE]],
        "keywords": [keyword["name"] for keyword in keywords[: config.KEYWORDS_PER_MOVIE]],
        "language": payload.get("original_language"),
    }


def fetch_one(session: requests.Session, tmdb_id: int) -> dict[str, Any] | None:
    """Return a summary, or None when TMDB has no such movie."""
    url = API_URL.format(tmdb_id=tmdb_id)
    params = {"append_to_response": "keywords,credits", "language": "en-US"}
    for attempt in range(MAX_RETRIES):
        try:
            response = session.get(url, params=params, timeout=REQUEST_TIMEOUT)
        except requests.RequestException:
            time.sleep(2**attempt)
            continue
        if response.status_code == 404:
            return None
        if response.status_code == 401:
            raise PermissionError("TMDB rejected the token (401). Check TMDB_READ_TOKEN in .env.")
        if response.status_code == 429:
            time.sleep(float(response.headers.get("Retry-After", 2**attempt)))
            continue
        if response.ok:
            return summarize(response.json())
        time.sleep(2**attempt)
    raise RuntimeError(f"TMDB request for movie {tmdb_id} kept failing")


def read_cache(cache_file: Path) -> dict[str, Any]:
    if not cache_file.exists():
        return {}
    return json.loads(cache_file.read_text(encoding="utf-8"))


def fetch_metadata(tmdb_ids: list[int], token: str | None, cache_file: Path = config.TMDB_CACHE_FILE) -> dict[int, dict]:
    """Metadata for every id we can get. Cached ids are never requested again."""
    cache = read_cache(cache_file)
    missing = [tmdb_id for tmdb_id in tmdb_ids if str(tmdb_id) not in cache]
    if missing and token is None:
        print(f"No TMDB_READ_TOKEN in .env: {len(missing)} movies will use genre cards instead of posters.")
    elif missing:
        print(f"Fetching {len(missing)} movies from TMDB ({len(tmdb_ids) - len(missing)} cached) ...")
        session = requests.Session()
        session.headers.update({"Authorization": f"Bearer {token}", "accept": "application/json"})
        failed = []
        try:
            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
                futures = {pool.submit(fetch_one, session, tmdb_id): tmdb_id for tmdb_id in missing}
                for done, future in enumerate(as_completed(futures), start=1):
                    try:
                        cache[str(futures[future])] = future.result()
                    except RuntimeError:
                        failed.append(futures[future])  # not cached, so the next run retries it
                    if done % 250 == 0:
                        print(f"  {done}/{len(missing)}")
            if failed:
                print(f"  {len(failed)} movies failed (network); run the pipeline again to retry them.")
        finally:
            # keep whatever was fetched so a re-run continues where this one stopped
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(json.dumps(cache), encoding="utf-8")
    return {int(key): value for key, value in cache.items() if value is not None}
