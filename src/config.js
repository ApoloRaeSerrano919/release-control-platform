require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 4100),
  databaseUrl: process.env.DATABASE_URL || 'postgres://release:release@localhost:5433/release',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
  logLevel: process.env.LOG_LEVEL || 'info'
};
