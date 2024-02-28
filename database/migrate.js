const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

async function main() {
  const dir = path.join(__dirname,'migrations');
  const files = fs.readdirSync(dir).filter(x=>x.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(`Running ${file}`);
    await pool.query(fs.readFileSync(path.join(dir,file),'utf8'));
  }

  console.log('Migrations complete');
  await pool.end();
}

main().catch(err=>{
  console.error(err);
  process.exit(1);
});
