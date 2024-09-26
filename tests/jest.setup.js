afterAll(async () => {
  const queuePath = require.resolve('../src/queues/deploymentQueue');
  const redisPath = require.resolve('../src/redis');
  const dbPath = require.resolve('../src/db');

  if (require.cache[queuePath]) {
    const { closeDeploymentQueue } = require('../src/queues/deploymentQueue');
    await closeDeploymentQueue();
  }

    const redis = require('../src/redis');
    if (redis.status !== 'end' && redis.status !== 'wait') {
      redis.disconnect();
    }
  }

  if (require.cache[dbPath]) {
    await require('../src/db').end();
  }
});
