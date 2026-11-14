#!/usr/bin/env python3
"""Standalone SQLite checkout uniqueness model, NOT a PostgreSQL or provider test.

Uses a temporary local SQLite database and multiple connections to exercise
the proposed partial unique index before running the Postgres staging test.
No production, customer, remote database, or payment access is needed.
"""
import concurrent.futures
from contextlib import closing
import os
import sqlite3
import tempfile
import uuid

DDL = """
create table checkout_intents (
 intent_id text primary key, account_id text not null, provider text not null,
 sku text not null, client_idempotency_key text not null,
 provider_request_id text not null, state text not null default 'reserved',
 provider_id text,
 fencing_version integer not null default 1,
 check (state not in ('reserved', 'provider_request_started', 'provider_outcome_unknown')
        or provider_id is null),
 check (state not in ('provider_created', 'local_record_failed', 'local_recorded', 'verified_terminal')
        or provider_id is not null),
 unique (provider, provider_request_id),
 unique (account_id, client_idempotency_key)
);
create unique index checkout_one_outstanding_per_account
 on checkout_intents(account_id) where state <> 'verified_terminal';
create unique index checkout_provider_agreement_unique
 on checkout_intents(provider,provider_id) where provider_id is not null;
"""

def main():
    with tempfile.TemporaryDirectory(prefix='nalichat_checkout_sqlite_') as temp:
        path = os.path.join(temp, 'checkout.sqlite3')
        def db():
            connection = sqlite3.connect(path, timeout=30, isolation_level=None)
            connection.execute('pragma busy_timeout=30000')
            return connection
        with closing(db()) as connection:
            connection.executescript(DDL)
        account = 'test_' + uuid.uuid4().hex
        def claim(index, user=account):
            with closing(db()) as connection:
                result = connection.execute("""
                  insert into checkout_intents
                    (intent_id,account_id,provider,sku,client_idempotency_key,provider_request_id)
                  values (?,?,?,?,?,?) on conflict do nothing returning intent_id
                """, (
                    str(uuid.uuid4()), user,
                    'paypal' if index % 2 else 'wix',
                    'premium_monthly' if index % 3 else 'premium_plus_yearly',
                    f'checkout_{index:04}_{uuid.uuid4().hex}',
                    f'provider_{index:04}_{uuid.uuid4().hex}',
                )).fetchone()
                return bool(result)
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
            result = list(pool.map(claim, range(100)))
        assert sum(result) == 1, f'Expected exactly one claim, got {sum(result)}'
        assert claim(100, 'other_account'), 'Unrelated account blocked'
        with closing(db()) as connection:
            intent_id, old_key = connection.execute(
                'select intent_id,client_idempotency_key from checkout_intents where account_id=?',
                (account,),
            ).fetchone()
            stale = connection.execute("""
                update checkout_intents set state='provider_request_started',
                  fencing_version=fencing_version+1
                where intent_id=? and fencing_version=99999 returning intent_id
            """, (intent_id,)).fetchone()
            assert stale is None, 'Stale worker advanced reservation'
            try:
                connection.execute("""
                    update checkout_intents set state='verified_terminal'
                    where intent_id=? and state='reserved'
                """, (intent_id,))
                raise AssertionError('Terminal reservation without provider ID accepted')
            except sqlite3.IntegrityError:
                pass
            synthetic_provider_id = 'I-SQLITE' + uuid.uuid4().hex[:20].upper()
            created = connection.execute("""
                update checkout_intents
                   set state='provider_created', provider_id=?,
                       fencing_version=fencing_version+1
                 where intent_id=? and state='reserved' and fencing_version=1
                returning intent_id
            """, (synthetic_provider_id, intent_id)).fetchone()
            assert created, 'Synthetic provider agreement could not be recorded'
            terminal = connection.execute("""
                update checkout_intents set state='verified_terminal',
                  fencing_version=fencing_version+1
                where intent_id=? and state='provider_created'
                  and provider_id=? and fencing_version=2
                returning intent_id
            """, (intent_id, synthetic_provider_id)).fetchone()
            assert terminal, 'Test-only terminal transition failed'
        assert claim(101), 'No new claim after simulated terminal transition'
        # A provider agreement remains unique across accounts, including
        # after the original checkout becomes terminal.
        assert claim(102, 'agreement_owner_b'), 'Second account could not reserve'
        with closing(db()) as connection:
            try:
                connection.execute("""
                    update checkout_intents set state='provider_created', provider_id=?
                    where account_id='agreement_owner_b' and state='reserved'
                """, (synthetic_provider_id,))
                raise AssertionError('Duplicate provider agreement accepted')
            except sqlite3.IntegrityError:
                pass
            assert connection.execute("""
                select state, provider_id from checkout_intents
                where account_id='agreement_owner_b'
            """).fetchone() == ('reserved', None), 'Rejected duplicate changed reservation'
        with closing(db()) as connection:
            replay = connection.execute("""
                insert into checkout_intents
                  (intent_id,account_id,provider,sku,client_idempotency_key,provider_request_id)
                values (?,?,?,?,?,?) on conflict do nothing returning intent_id
            """, (str(uuid.uuid4()), account, 'paypal', 'premium_monthly',
                  old_key, 'replay_'+uuid.uuid4().hex)).fetchone()
            assert replay is None, 'Previously used request key accepted'
        print('PASS: 100 concurrent claims => 1 accepted, 99 rejected')
        print('PASS: provider ID required before terminal; unique provider agreements; other account; stale fencing; terminal successor; request replay')
        print('NOTE: SQLite only. PostgreSQL isolation/reconciliation NOT tested.')

if __name__ == '__main__':
    main()
