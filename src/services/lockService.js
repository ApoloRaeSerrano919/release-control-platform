const crypto = require('crypto');

async function acquireLock(client, {serviceId,environmentId,releaseId,ttlMinutes=15}) {
  const token = crypto.randomUUID();

  try {
    const result = await client.query(
      `INSERT INTO deployment_locks
       (service_id,environment_id,release_id,owner_token,expires_at)
       VALUES($1,$2,$3,$4,NOW()+($5 || ' minutes')::interval)
       RETURNING *`,
      [serviceId,environmentId,releaseId,token,String(ttlMinutes)]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      throw new Error('deployment_already_in_progress');
    }
    throw error;
  }
}

async function releaseLock(client, ownerToken) {
  await client.query(
    `DELETE FROM deployment_locks WHERE owner_token=$1`,
    [ownerToken]
  );
}

