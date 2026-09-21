'use strict';

const { assertWorkerDescriptor } = require('./coding-worker-contract.cjs');

// The durable core resolves a worker by its neutral identifier.  Concrete
// providers are registered by the composition layer; this module never
// imports a provider implementation.
function createWorkerAdapterResolver(workerFactories = {}) {
  const factories = new Map(Object.entries(workerFactories));

  return function workerAdapterForJob(job, options = {}) {
    const workerId = job?.workerId || job?.provider;
    if (typeof workerId !== 'string' || !workerId.trim()) {
      throw new Error('A durable job must identify a coding worker');
    }
    const factory = factories.get(workerId);
    if (typeof factory !== 'function') throw new Error(`Worker adapter is unavailable for ${workerId}`);
    return assertWorkerDescriptor(factory(options));
  };
}

module.exports = { createWorkerAdapterResolver };
