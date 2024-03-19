CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  repository_url TEXT NOT NULL,
  owner_team VARCHAR(120) NOT NULL,
  deployment_strategy VARCHAR(40) NOT NULL DEFAULT 'rolling',
  health_path VARCHAR(255) NOT NULL DEFAULT '/health',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS environments (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name VARCHAR(40) NOT NULL,
  base_url TEXT,
  current_version VARCHAR(120),
  last_known_good_version VARCHAR(120),
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_id,name)
);

CREATE TABLE IF NOT EXISTS releases (
  id BIGSERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  version VARCHAR(120) NOT NULL,
  commit_sha VARCHAR(64) NOT NULL,
  branch VARCHAR(120),
  artifact_uri TEXT NOT NULL,
  status VARCHAR(60) NOT NULL DEFAULT 'CREATED',
  created_by VARCHAR(255) NOT NULL,
  release_notes TEXT,
  idempotency_key VARCHAR(120) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deployment_attempts (
  id BIGSERIAL PRIMARY KEY,
  release_id BIGINT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  environment_id INTEGER NOT NULL REFERENCES environments(id),
  status VARCHAR(60) NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
  id BIGSERIAL PRIMARY KEY,
  approver VARCHAR(255) NOT NULL,
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deployment_locks (
  id BIGSERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  environment_id INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  release_id BIGINT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  owner_token VARCHAR(120) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_id,environment_id)
);

CREATE TABLE IF NOT EXISTS release_events (
  id BIGSERIAL PRIMARY KEY,
  release_id BIGINT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  environment_id INTEGER REFERENCES environments(id),
  event_type VARCHAR(100) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_release_status ON releases(status);
CREATE INDEX IF NOT EXISTS idx_attempt_release ON deployment_attempts(release_id);
CREATE INDEX IF NOT EXISTS idx_event_release ON release_events(release_id,created_at);
