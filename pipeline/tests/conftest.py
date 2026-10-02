import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture
def toy_ratings() -> pd.DataFrame:
    """4 users x 4 movies. Movies 0 and 1 are loved by the same people; 3 is loved by the others."""
    rows = [
        (0, 0, 5.0), (0, 1, 5.0), (0, 2, 2.0),
        (1, 0, 4.5), (1, 1, 4.0), (1, 3, 1.0),
        (2, 2, 5.0), (2, 3, 4.5), (2, 0, 1.0),
        (3, 2, 4.0), (3, 3, 5.0), (3, 1, 1.5),
    ]
    return pd.DataFrame(rows, columns=["user", "item", "rating"])
