const IORedis = require('ioredis');
const { redisUrl } = require('./config');
const logger = require('./logger');

const redis = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true
});

redis.on('error', (err) => {
  logger.error({ err }, 'redis_connection_error');
});

module.exports = redis;
