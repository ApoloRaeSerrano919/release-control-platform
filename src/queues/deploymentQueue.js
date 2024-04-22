const { Queue } = require('bullmq');

let deploymentQueue;

function getDeploymentQueue() {
  if (!deploymentQueue) {
    const redis = require('../redis');
    deploymentQueue = new Queue('deployment-jobs', {
      connection: redis
    });
  }
  return deploymentQueue;
}

async function closeDeploymentQueue() {
  if (!deploymentQueue) return;
  await deploymentQueue.close();
  deploymentQueue = null;
}

