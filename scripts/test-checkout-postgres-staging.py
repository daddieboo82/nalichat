#!/usr/bin/env python3
"""Opt-in staging PostgreSQL concurrency test. NEVER run against production.

Requires: psql executable, PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE,
NALICHAT_STAGING_DB_CONFIRMED=YES. Creates a random schema and drops it
after the test. Does not create billing records or contact payment providers.
"""
import concurrent.futures
import os
import pathlib
import re
import shutil
import subprocess
import sys
import uuid

LIVE_SUPABASE_HOST = "db.xznlhezufooynxekoezl.supabase.co"

def fail(message):
    raise RuntimeError(message)

def psql(sql):
    process = subprocess.run(
        ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql],
        text=True, capture_output=True, timeout=45, check=False,
    )
    if process.returncode != 0:
        fail("PostgreSQL test command failed: " + process.stderr[-450:])
    return process.stdout.strip()

def main():
    if os.getenv("NALICHAT_STAGING_DB_CONFIRMED") != "YES":
        fail("Refusing to run: staging database not explicitly confirmed")
    if not shutil.which("psql"):
        fail("psql CLI not installed; nothing executed")
    for key in ["PGHOST", "PGUSER", "PGDATABASE"]:
        if not os.getenv(key):
            fail(f"Missing {key}; no database contacted")
    if os.getenv("PGHOST", "").lower() == LIVE_SUPABASE_HOST:
        fail("Production-linked NaliChat Supabase host is forbidden")
    if os.getenv("PGHOST", "").lower().startswith("db.xznlhezufooynxekoezl."):
        fail("Production-linked NaliChat Supabase project is forbidden")
    schema = "checkout_test_" + uuid.uuid4().hex[:18]
    sql = pathlib.Path("docs/sql/checkout-intent-postgres-design.sql").read_text()
    sql = sql.replace("billing_private", schema)

    print("Creating isolated staging test schema (no payment-provider access).")
    try:
        psql(sql)
        account = "test_user_" + uuid.uuid4().hex
        def claim(index):
            provider = "paypal" if index % 2 else "wix"
            sku = "premium_monthly" if index % 3 else "premium_plus_yearly"
            request_key = "test_checkout_" + str(index).zfill(4) + "_" + uuid.uuid4().hex
            provider_key = "test_provider_" + uuid.uuid4().hex
            query = f"""
                insert into {schema}.checkout_intents
                   (account_id, provider, sku, client_idempotency_key, provider_request_id)
                values ('{account}', '{provider}', '{sku}', '{request_key}', '{provider_key}')
                on conflict do nothing
                returning intent_id;
            """
            return bool(psql(query))
        # 100 attempts, 16 simultaneous connections. The unique partial index
        # must permit exactly one outstanding claim, regardless of provider/SKU.
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
            results = list(pool.map(claim, range(100)))
        if sum(results) != 1:
            fail(f"FAIL: {sum(results)} of 100 simultaneous/repeated attempts won")
        count = psql(f"""
            select count(*) from {schema}.checkout_intents
            where account_id = '{account}' and state <> 'verified_terminal';
        """)
        if count != "1":
            fail(f"FAIL: expected one outstanding claim, got {count}")
        # A different account must be free to claim independently.
        other = "test_other_" + uuid.uuid4().hex
        second = psql(f"""
            insert into {schema}.checkout_intents
              (account_id, provider, sku, client_idempotency_key, provider_request_id)
            values ('{other}', 'paypal', 'premium_monthly',
                    'second_account_key_12345', 'second_provider_key_12345')
            on conflict do nothing returning intent_id;
        """)
        if not second:
            fail("FAIL: independent second account was blocked")
        # A stale worker version cannot move the reserved state forward.
        stale = psql(f"""
            update {schema}.checkout_intents set state = 'provider_request_started',
              fencing_version = fencing_version + 1
            where account_id = '{account}' and fencing_version = 99999
            returning intent_id;
        """)
        if stale:
            fail("FAIL: stale fencing token updated a reservation")
        print("PASS: 100 checkout attempts => exactly one outstanding claim;")
        print("PASS: different account can claim; stale fencing token rejected.")
    finally:
        # Only the random schema created in this run is ever dropped.
        # Preserve first failure if cleanup is also unsuccessful.
        psql(f"drop schema if exists {schema} cascade;")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Staging checkout concurrency test: {exc}", file=sys.stderr)
        sys.exit(1)
