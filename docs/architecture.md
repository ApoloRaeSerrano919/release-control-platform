# Architecture

## Why a queue

Deploy work is long-running. The API writes state and enqueues a job; the worker owns retries and lock lifecycle so an API restart does not drop in-flight deploys.

## Postgres vs Redis

PostgreSQL holds services, releases, attempts, approvals, locks, and events. Redis is the BullMQ queue only.

## Locks

`deployment_locks` is unique on `(service_id, environment_id)`. The worker acquires the lock before calling the adapter and releases it when the attempt finishes.

## Idempotency

Creating a release with the same idempotency key returns the existing row so CI retries do not duplicate releases.

