# ReleaseControl

Deploy orchestration for services across environments: Express API, PostgreSQL, Redis/BullMQ worker. Production deploys can require approval; per-service locks prevent collisions.

## System

```mermaid
flowchart LR
  client[API_client]
  api[Express_4100]
  db[(PostgreSQL)]
  redis[(Redis)]
  worker[deployment_worker]

  client -->|HTTP| api
  api --> db
  api --> redis
  worker --> redis
  worker --> db
```

## Release flow

```mermaid
flowchart TD
  create[POST_releases]
  deploy[POST_deploy]
  approve{Production_needs_approval}
  queue[Enqueue_BullMQ_job]
  lock[Acquire_service_env_lock]
  adapt[Deploy_adapter]
  health[Health_checks]
  done[SUCCEEDED_or_FAILED]

  create --> deploy --> approve
  approve -->|awaiting| wait[AWAITING_PRODUCTION_APPROVAL]
  wait -->|approve-production| queue
  approve -->|allowed| queue
  queue --> lock --> adapt --> health --> done
```

## Collision lock

```mermaid
flowchart LR
  a[Deploy_A]
  b[Deploy_B]
  lock[(UNIQUE_service_env)]

  a --> lock
  b -.->|blocked_until_release| lock
```

Only one active deploy owns `(service_id, environment_id)` at a time.

## API

| Method | Path |
|--------|------|
| GET | `/health` |
| GET, POST | `/api/services` |
| GET, POST | `/api/releases` |
| GET | `/api/releases/:id` |
| POST | `/api/releases/:id/deploy` |
| POST | `/api/releases/:id/approve-production` |
| POST | `/api/releases/:id/rollback` |
| GET | `/api/metrics` |

## Run

```
docker compose up -d db redis
npm install
npm run migrate
npm run seed
npm run dev
```

Worker:

```
npm run worker
```

API: http://localhost:4100

## Stack

- Express
- PostgreSQL (services, releases, locks, events, approvals)
- Redis + BullMQ (`deployment-jobs`)
- Deploy/health adapters are simulated locally so the repo runs without cloud credentials
