# Architecture

## Why a queue

Deploy work is long-running. The API writes state and enqueues a job; the worker owns retries and lock lifecycle so an API restart does not drop in-flight deploys.

## Postgres vs Redis

PostgreSQL holds services, releases, attempts, approvals, locks, and events. Redis is the BullMQ queue only.

## Idempotency

Creating a release with the same idempotency key returns the existing row so CI retries do not duplicate releases.

## Adapters

`deploymentAdapter` and `healthService` are local stand-ins. Swap them for ECS/EKS/Helm/HTTP checks without changing the queue or lock flow.
