'use strict';

const { CODING_WORKER_CONTRACT_VERSION } = require('../../core/coding-worker-contract.cjs');

// This adapter deliberately contains no provider behavior. ACP transport and
// session semantics remain at the backend boundary; this surface only exposes
// the durable worker contract and its explicit admission declaration.
function createAcpReferenceWorker({ backend } = {}) {
  if (!backend || typeof backend !== 'object') throw new TypeError('ACP reference worker requires an ACP backend');
  const operations = ['start', 'continue', 'inspect', 'recover', 'cancel'];
  for (const operation of operations) if (typeof backend[operation] !== 'function') throw new TypeError(`ACP backend lacks ${operation}`);
  return {
    workerId: 'acp-reference',
    contractVersion: CODING_WORKER_CONTRACT_VERSION,
    admission: {
      externalControl: true,
      sessionAddressability: true,
      sameSessionContinuation: true,
      observableExecution: true,
      deterministicInterruption: true,
    },
    start: (input) => backend.start(input),
    continue: (input) => backend.continue(input),
    inspect: (input) => backend.inspect(input),
    recover: (input) => backend.recover(input),
    cancel: (input) => backend.cancel(input),
  };
}

module.exports = { createAcpReferenceWorker };
