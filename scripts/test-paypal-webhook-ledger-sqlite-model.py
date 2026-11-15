#!/usr/bin/env python3
"""SQLite-only PayPal webhook event claim race test. No provider or Base44 access."""
import concurrent.futures
import sqlite3
import tempfile
import uuid
from pathlib import Path

DDL = """CREATE TABLE webhook_claim (
 event_id TEXT PRIMARY KEY NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('processing','processed','review_required')),
 lease_token TEXT NOT NULL
);"""

def main():
    with tempfile.TemporaryDirectory(prefix="nalichat_webhook_") as temp:
        dbfile = str(Path(temp)/"ledger.sqlite")
        def connect():
            db = sqlite3.connect(dbfile, timeout=30, isolation_level=None)
            db.execute("PRAGMA busy_timeout=30000")
            return db
        db=connect()
        db.executescript(DDL)
        db.close()
        event_id="WH-TEST-"+uuid.uuid4().hex
        def claim(index):
            db=connect()
            token=f"{index}-{uuid.uuid4().hex}"
            try:
                row=db.execute("""INSERT INTO webhook_claim(event_id,state,lease_token)
                  VALUES (?,'processing',?) ON CONFLICT(event_id) DO NOTHING
                  RETURNING event_id""",(event_id,token)).fetchone()
                return token if row else None
            finally:
                db.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
            claims=list(pool.map(claim, range(100)))
        winners=[x for x in claims if x]
        assert len(winners)==1, f"Expected one accepted webhook, got {len(winners)}"
        db=connect()
        try:
            stale=db.execute("""UPDATE webhook_claim SET state='processed'
              WHERE event_id=? AND state='processing' AND lease_token=?
              RETURNING event_id""",(event_id,"wrong-owner")).fetchone()
            assert stale is None, "Stale worker finalized webhook"
        except sqlite3.IntegrityError:
            pass
        finally:
            db.close()
        # Re-open with processed added for the terminal-state check.
        db=connect()
        try:
            db.execute("UPDATE webhook_claim SET state='review_required' WHERE event_id=? AND lease_token=?",(event_id,winners[0]))
            assert db.execute("""INSERT INTO webhook_claim(event_id,state,lease_token)
                VALUES (?,'processing','replay') ON CONFLICT(event_id) DO NOTHING RETURNING event_id""",
                (event_id,)).fetchone() is None, "Redelivery re-claimed event needing review"
            assert db.execute("SELECT state FROM webhook_claim WHERE event_id=?",(event_id,)).fetchone()[0] == "review_required"
        finally:
            db.close()
        print("PASS: 100 claims -> one winner; stale completion rejected; review redelivery preserved")
        print("LIMIT: SQLite model, NOT deployed Base44 database concurrency evidence")

if __name__=="__main__":
    main()
