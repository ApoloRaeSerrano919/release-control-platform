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

