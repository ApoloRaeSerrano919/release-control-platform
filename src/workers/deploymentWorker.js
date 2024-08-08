const { Worker } = require('bullmq');
const redis = require('../redis');
const pool = require('../db');
const logger = require('../logger');
const { acquireLock,releaseLock } = require('../services/lockService');
const { addEvent } = require('../services/eventService');
const { runHealthChecks } = require('../services/healthService');
const { deployArtifact,rollbackArtifact } = require('../services/deploymentAdapter');

async function loadContext(client,releaseId,environmentId) {
  const row = (await client.query(
    `SELECT
       r.*,
       s.name AS service_name,
       s.health_path,
       s.repository_url,
       e.name AS environment_name,
       e.base_url,
       e.current_version,
       e.last_known_good_version
     FROM releases r
     JOIN services s ON s.id=r.service_id
     JOIN environments e ON e.id=$2
     WHERE r.id=$1`,
    [releaseId,environmentId]
  )).rows[0];

  if (!row) throw new Error('deployment_context_not_found');

  return {
    release:row,
    service:{
      id:row.service_id,
      name:row.service_name,
      health_path:row.health_path,
      repository_url:row.repository_url
    },
    environment:{
      id:environmentId,
      name:row.environment_name,
      base_url:row.base_url,
      current_version:row.current_version,
      last_known_good_version:row.last_known_good_version
    }
  };
}

async function deploy(job) {
  const {releaseId,environmentId,attemptId} = job.data;
  const client = await pool.connect();
  let lock;

  try {
    await client.query('BEGIN');

    const ctx = await loadContext(client,releaseId,environmentId);

    lock = await acquireLock(client,{
      serviceId:ctx.service.id,
      environmentId,
      releaseId
    });

    const deployStatus =
      ctx.environment.name === 'production'
        ? 'DEPLOYING_PRODUCTION'
        : 'DEPLOYING_STAGING';

    await client.query(
      `UPDATE releases SET status=$2,updated_at=NOW() WHERE id=$1`,
      [releaseId,deployStatus]
    );

    await client.query(
      `UPDATE deployment_attempts
       SET status='RUNNING',started_at=NOW()
       WHERE id=$1`,
      [attemptId]
    );

    await addEvent(client,releaseId,environmentId,'DEPLOYMENT_STARTED',{
      attemptId,
      workerJobId:job.id,
      version:ctx.release.version
    });

    await client.query('COMMIT');

    await deployArtifact(ctx);

    const verification = await runHealthChecks(
      ctx.environment,
      ctx.service
    );

    if (!verification.ok) {
      throw new Error('health_check_failed');
    }

    await client.query('BEGIN');

    const previousVersion = ctx.environment.current_version;

    await client.query(
      `UPDATE environments
       SET last_known_good_version=COALESCE(current_version,last_known_good_version),
           current_version=$2
       WHERE id=$1`,
      [environmentId,ctx.release.version]
    );

    const finalStatus =
      ctx.environment.name === 'production'
        ? 'SUCCEEDED'
        : 'READY_FOR_PRODUCTION';

    await client.query(
      `UPDATE releases
       SET status=$2,updated_at=NOW()
       WHERE id=$1`,
      [releaseId,finalStatus]
    );

    await client.query(
      `UPDATE deployment_attempts
       SET status='SUCCEEDED',completed_at=NOW()
       WHERE id=$1`,
      [attemptId]
    );

    await addEvent(client,releaseId,environmentId,'DEPLOYMENT_SUCCEEDED',{
      attemptId,
      previousVersion,
      deployedVersion:ctx.release.version,
      checks:verification.checks
    });

    await releaseLock(client,lock.owner_token);

    await client.query('COMMIT');

    logger.info({
      releaseId,
      environment:ctx.environment.name,
      version:ctx.release.version
    },'deployment succeeded');

    return {ok:true};
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}

    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE releases SET status='FAILED',updated_at=NOW() WHERE id=$1`,
        [job.data.releaseId]
      );

      if (job.data.attemptId) {
        await client.query(
          `UPDATE deployment_attempts
           SET status='FAILED',failure_reason=$2,completed_at=NOW()
           WHERE id=$1`,
          [job.data.attemptId,error.message]
        );
      }

      await addEvent(
        client,
        job.data.releaseId,
        job.data.environmentId,
        'DEPLOYMENT_FAILED',
        {reason:error.message,workerJobId:job.id}
      );

      if (lock) {
        await releaseLock(client,lock.owner_token);
      }

      await client.query('COMMIT');
    } catch (inner) {
      await client.query('ROLLBACK').catch(()=>{});
      logger.error({err:inner},'failed to persist deployment failure');
    }

    throw error;
  } finally {
    client.release();
  }
}

async function rollback(job) {
  const {releaseId,environmentId,targetVersion,reason} = job.data;
  const client = await pool.connect();
  let lock;

  try {
    await client.query('BEGIN');

    const ctx = await loadContext(client,releaseId,environmentId);

    lock = await acquireLock(client,{
      serviceId:ctx.service.id,
      environmentId,
      releaseId
    });

    await client.query(
      `UPDATE releases SET status='ROLLING_BACK',updated_at=NOW() WHERE id=$1`,
      [releaseId]
    );

    await addEvent(client,releaseId,environmentId,'ROLLBACK_STARTED',{
      targetVersion,
      reason
    });

    await client.query('COMMIT');

    await rollbackArtifact({
      service:ctx.service,
      environment:ctx.environment,
      targetVersion
    });

    const verification = await runHealthChecks(
      ctx.environment,
      ctx.service
    );

    if (!verification.ok) throw new Error('rollback_health_check_failed');

    await client.query('BEGIN');

    await client.query(
      `UPDATE environments
       SET current_version=$2
       WHERE id=$1`,
      [environmentId,targetVersion]
    );

    await client.query(
      `UPDATE releases
       SET status='ROLLED_BACK',updated_at=NOW()
       WHERE id=$1`,
      [releaseId]
    );

    await addEvent(client,releaseId,environmentId,'ROLLBACK_SUCCEEDED',{
      targetVersion,
      reason,
      checks:verification.checks
    });

    await releaseLock(client,lock.owner_token);

    await client.query('COMMIT');

    return {ok:true,targetVersion};
  } catch (error) {
    await client.query('ROLLBACK').catch(()=>{});
    throw error;
  } finally {
    client.release();
  }
}

new Worker(
  'deployment-jobs',
  async job => {
    if (job.name === 'deploy') return deploy(job);
    if (job.name === 'rollback') return rollback(job);
    throw new Error(`unknown_job:${job.name}`);
  },
  {
    connection:redis,
    concurrency:4
  }
);

logger.info('ReleaseControl deployment worker started');
