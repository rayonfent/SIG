import os
from contextlib import contextmanager
from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sig:sig@localhost:5432/sig_tsunami")

pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=10, kwargs={"row_factory": dict_row})


@contextmanager
def get_conn():
    with pool.connection() as conn:
        yield conn


def fetch_all(query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return list(cur.fetchall())


def fetch_one(query: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchone()


def execute(query: str, params: tuple[Any, ...] = ()) -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
        conn.commit()
