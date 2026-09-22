'use strict';

const { assertWorkerDescriptor } = require('./coding-worker-contract.cjs');
const { ADMISSION_STATUSES, validateWorkerAdmission } = require('./worker-admission-contract.cjs');

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
    const worker = assertWorkerDescriptor(factory(options));
    const admission = validateWorkerAdmission(worker);
    if (admission.status !== ADMISSION_STATUSES.ADMITTED) {
      const error = new Error(`Worker adapter does not satisfy the admission contract: ${admission.reasons.join(', ')}`);
      error.admission = admission;
      throw error;
    }
    return worker;
  };
}

module.exports = { createWorkerAdapterResolver };
