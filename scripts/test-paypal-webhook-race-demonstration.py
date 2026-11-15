#!/usr/bin/env python3
"""Deterministic SQLite illustration of PayPal webhook claim races.

This models the non-atomic find-then-create pattern separately from the
required atomic unique-claim pattern. Neither case connects to Base44 or PayPal.
"""
import concurrent.futures
import sqlite3
import tempfile
import threading
from pathlib import Path

WORKERS = 20


def run_race(db_path: str, atomic: bool) -> tuple[int, int]:
    barrier = threading.Barrier(WORKERS)
    def claim(worker: int) -> bool:
        with sqlite3.connect(db_path, timeout=30, isolation_level=None) as conn:
            conn.execute("PRAGMA busy_timeout=30000")
            if not atomic:
                # All workers read an empty ledger before any write, which is
                # a valid and dangerous interleaving of separated SDK calls.
                found = conn.execute("SELECT id FROM events WHERE event_id=?", ("EVT-1",)).fetchone()
                barrier.wait(timeout=10)
                if found:
                    return False
                conn.execute("INSERT INTO events(event_id, owner) VALUES (?,?)", ("EVT-1", str(worker)))
                return True
            # Simultaneous inserts use one unique constraint as the arbiter.
            barrier.wait(timeout=10)
            created = conn.execute("INSERT INTO events(event_id, owner) VALUES (?,?) "
                                   "ON CONFLICT(event_id) DO NOTHING RETURNING id",
                                   ("EVT-1", str(worker))).fetchone()
            return bool(created)
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        accepted = list(pool.map(claim, range(WORKERS)))
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute("SELECT count(*) FROM events WHERE event_id=?", ("EVT-1",)).fetchone()[0]
    return sum(accepted), rows


def main():
    with tempfile.TemporaryDirectory(prefix="nalichat_paypal_ledger_race_") as folder:
        old_path = str(Path(folder) / "old.sqlite")
        with sqlite3.connect(old_path) as conn:
            conn.execute("CREATE TABLE events (id INTEGER PRIMARY KEY, event_id TEXT NOT NULL, owner TEXT NOT NULL)")
        old_claims, old_rows = run_race(old_path, atomic=False)
        assert (old_claims, old_rows) == (WORKERS, WORKERS), (old_claims, old_rows)
        print(f"PASS: read-then-create race demonstrated ({old_claims} claims, {old_rows} duplicate event rows)")

        safe_path = str(Path(folder) / "atomic.sqlite")
        with sqlite3.connect(safe_path) as conn:
            conn.execute("CREATE TABLE events (id INTEGER PRIMARY KEY, event_id TEXT NOT NULL UNIQUE, owner TEXT NOT NULL)")
        safe_claims, safe_rows = run_race(safe_path, atomic=True)
        assert (safe_claims, safe_rows) == (1, 1), (safe_claims, safe_rows)
        print(f"PASS: atomic claim requires uniqueness ({safe_claims} claim, {safe_rows} event row)")
        print("LIMIT: This validates SQLite race behavior, not deployed Base44 event uniqueness.")


if __name__ == "__main__":
    main()
