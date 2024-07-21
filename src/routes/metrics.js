const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/', async (_req,res) => {
  const [successRate,durations,byEnvironment,locks] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='SUCCEEDED')::int AS succeeded,
        COUNT(*)::int AS total
      FROM deployment_attempts
    `),
    pool.query(`
      SELECT ROUND(
        AVG(EXTRACT(EPOCH FROM (completed_at-started_at)))::numeric,1
      ) AS avg_duration_seconds
      FROM deployment_attempts
      WHERE completed_at IS NOT NULL AND started_at IS NOT NULL
    `),
    pool.query(`
      SELECT e.name AS environment,
             COUNT(*)::int AS deployments
      FROM deployment_attempts a
      JOIN environments e ON e.id=a.environment_id
      GROUP BY e.name
      ORDER BY e.name
    `),
    pool.query(`
      SELECT COUNT(*)::int AS active_locks
      FROM deployment_locks
      WHERE expires_at > NOW()
    `)
  ]);

  const r = successRate.rows[0];
  const rate = r.total
    ? Math.round((r.succeeded/r.total)*100)
    : 100;

  res.json({
    successRate:rate,
    avgDurationSeconds:durations.rows[0].avg_duration_seconds,
    byEnvironment:byEnvironment.rows,
    activeLocks:locks.rows[0].active_locks
  });
});

module.exports = router;
