const pool = require('../src/db');

async function main() {
  const service = (await pool.query(
    `INSERT INTO services(name,repository_url,owner_team,deployment_strategy,health_path)
     VALUES('billing-service','https://github.com/example/billing-service','Payments','rolling','/health')
     ON CONFLICT(name) DO UPDATE SET owner_team=EXCLUDED.owner_team
     RETURNING id`
  )).rows[0];

  for (const [name,url,approval] of [
    ['development','http://billing.dev.local',false],
    ['staging','http://billing.staging.local',false],
    ['production','https://billing.example.com',true]
  ]) {
    await pool.query(
      `INSERT INTO environments(service_id,name,base_url,requires_approval)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(service_id,name) DO NOTHING`,
      [service.id,name,url,approval]
    );
  }

  console.log('Seed complete');
  await pool.end();
}

