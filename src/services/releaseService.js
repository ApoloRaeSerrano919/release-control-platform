const pool = require('../db');
const { addEvent } = require('./eventService');

async function createRelease(input) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (input.idempotencyKey) {
      const existing = (await client.query(
        `SELECT * FROM releases WHERE idempotency_key=$1`,
        [input.idempotencyKey]
      )).rows[0];

      if (existing) {
        await client.query('ROLLBACK');
        return existing;
      }
    }

    const service = (await client.query(
      `SELECT * FROM services WHERE id=$1`,
      [input.serviceId]
    )).rows[0];

    if (!service) throw new Error('service_not_found');

    const release = (await client.query(
      `INSERT INTO releases
       (service_id,version,commit_sha,branch,artifact_uri,status,created_by,
        release_notes,idempotency_key)
       VALUES($1,$2,$3,$4,$5,'READY_FOR_STAGING',$6,$7,$8)
       RETURNING *`,
      [
        input.serviceId,
        input.version,
        input.commitSha,
        input.branch || null,
        input.artifactUri,
        input.createdBy,
        input.releaseNotes || null,
        input.idempotencyKey || null
      ]
    )).rows[0];

    await addEvent(client,release.id,null,'RELEASE_CREATED',{
      version:release.version,
      commitSha:release.commit_sha,
      artifactUri:release.artifact_uri
    });

    await client.query('COMMIT');
    return release;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

