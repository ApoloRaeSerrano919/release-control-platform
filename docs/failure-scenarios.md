# Failure scenarios

## Lock conflict

Two deploys target the same service and environment. The second attempt waits or fails until the lock is free.

## Worker crash

BullMQ retries the job. Attempt state in Postgres shows progress; retries use the same idempotency rules.

## Health failure

Adapter succeeds but health fails → release `FAILED`, event recorded, lock released.

## Duplicate create

Same idempotency key on `POST /api/releases` → existing release returned, no second row.

## Production without approval

`POST .../deploy` to production with `requires_approval` → status `AWAITING_PRODUCTION_APPROVAL`, nothing queued until `approve-production`.

## Rollback

`POST .../rollback` queues a job that restores last-known-good version, re-checks health, and writes events.
