async function addEvent(client, releaseId, environmentId, eventType, metadata={}) {
  await client.query(
    `INSERT INTO release_events(release_id,environment_id,event_type,metadata)
     VALUES($1,$2,$3,$4::jsonb)`,
    [releaseId,environmentId,eventType,JSON.stringify(metadata)]
  );
}

module.exports = { addEvent };
