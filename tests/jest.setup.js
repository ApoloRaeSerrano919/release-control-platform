afterAll(async () => {
  const queuePath = require.resolve('../src/queues/deploymentQueue');
  const redisPath = require.resolve('../src/redis');
  const dbPath = require.resolve('../src/db');

  if (require.cache[queuePath]) {
    const { closeDeploymentQueue } = require('../src/queues/deploymentQueue');
    await closeDeploymentQueue();
  }

  if (require.cache[redisPath]) {
