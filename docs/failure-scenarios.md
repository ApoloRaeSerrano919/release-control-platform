# Failure scenarios

## Lock conflict

Two deploys target the same service and environment. The second attempt waits or fails until the lock is free.

## Worker crash

BullMQ retries the job. Attempt state in Postgres shows progress; retries use the same idempotency rules.

## Health failure

Adapter succeeds but health fails → release `FAILED`, event recorded, lock released.

