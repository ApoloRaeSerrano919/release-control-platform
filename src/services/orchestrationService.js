const pool = require('../db');
const { getDeploymentQueue } = require('../queues/deploymentQueue');
const { addEvent } = require('./eventService');
const { ReleaseStatus } = require('../domain/releaseStatus');

async function queueDeployment({releaseId,environmentName,actor}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const release = (await client.query(
      `SELECT r.*,s.name AS service_name
       FROM releases r
       JOIN services s ON s.id=r.service_id
       WHERE r.id=$1 FOR UPDATE`,
      [releaseId]
    )).rows[0];

    if (!release) throw new Error('release_not_found');

    const env = (await client.query(
      `SELECT * FROM environments
       WHERE service_id=$1 AND name=$2`,
      [release.service_id,environmentName]
    )).rows[0];

    if (!env) throw new Error('environment_not_found');

    if (environmentName === 'production' && env.requires_approval) {
      const approval = (await client.query(
        `SELECT * FROM approvals
         WHERE release_id=$1 AND environment_id=$2 AND decision='APPROVED'
         ORDER BY created_at DESC LIMIT 1`,
        [releaseId,env.id]
      )).rows[0];

      if (!approval) {
        await client.query(
          `UPDATE releases SET status=$2,updated_at=NOW() WHERE id=$1`,
          [releaseId,ReleaseStatus.AWAITING_PRODUCTION_APPROVAL]
        );

        await addEvent(client,releaseId,env.id,'PRODUCTION_APPROVAL_REQUIRED',{actor});
        await client.query('COMMIT');

        return {queued:false,approvalRequired:true};
      }
    }

    const attempt = (await client.query(
      `INSERT INTO deployment_attempts
       (release_id,environment_id,status,attempt_number)
       VALUES(
         $1,$2,'QUEUED',
         COALESCE((SELECT MAX(attempt_number)+1 FROM deployment_attempts
                   WHERE release_id=$1 AND environment_id=$2),1)
       )
       RETURNING *`,
      [releaseId,env.id]
    )).rows[0];

    await addEvent(client,releaseId,env.id,'DEPLOYMENT_QUEUED',{
      actor,
      attemptId:attempt.id
    });

    await client.query('COMMIT');

    await getDeploymentQueue().add(
      'deploy',
      {
        releaseId,
        environmentId:env.id,
        attemptId:attempt.id
      },
      {
        attempts:3,
        backoff:{type:'exponential',delay:2000},
        removeOnComplete:100,
        removeOnFail:200
      }
    );

    return {queued:true,attemptId:attempt.id};
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function approveProduction({releaseId,environmentId,approver,comment}) {
  const result = await pool.query(
    `INSERT INTO approvals
     (release_id,environment_id,approver,decision,comment)
     VALUES($1,$2,$3,'APPROVED',$4)
     RETURNING *`,
    [releaseId,environmentId,approver,comment || null]
  );

  return result.rows[0];
}

async function queueRollback({releaseId,environmentName,reason}) {
  const release = (await pool.query(
    `SELECT * FROM releases WHERE id=$1`,
    [releaseId]
  )).rows[0];

  if (!release) throw new Error('release_not_found');

  const env = (await pool.query(
    `SELECT * FROM environments
     WHERE service_id=$1 AND name=$2`,
    [release.service_id,environmentName]
  )).rows[0];

  if (!env) throw new Error('environment_not_found');
  if (!env.last_known_good_version) throw new Error('no_last_known_good_version');

  await pool.query(
    `UPDATE releases SET status='ROLLBACK_QUEUED',updated_at=NOW() WHERE id=$1`,
    [releaseId]
  );

  await getDeploymentQueue().add(
    'rollback',
    {
      releaseId,
      environmentId:env.id,
      targetVersion:env.last_known_good_version,
      reason
    },
    {
      attempts:2,
      backoff:{type:'fixed',delay:2000}
    }
  );

  return {
    queued:true,
    targetVersion:env.last_known_good_version
  };
}

