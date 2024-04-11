const { Pool } = require('pg');
const { databaseUrl } = require('./config');

module.exports = new Pool({
  connectionString: databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000
});
