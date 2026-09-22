'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createWorkerAdapterResolver } = require('../core/worker-adapter-resolver.cjs');
const {
  CODING_WORKER_CONTRACT_VERSION,
  WORKER_STATES,
} = require('../core/coding-worker-contract.cjs');
const {
  applyCanonicalJobFields,
  normalizedWorkerResult,
} = require('../core/durable-job-schema.cjs');
const { configuredDefaultWorktree } = require('../core/runtime-config.cjs');

function worker() {
  const active = async ({ workerHandle = 'fixture-handle' } = {}) => ({
    workerHandle,
    state: WORKER_STATES.RUNNING,
  });
  return {
    workerId: 'fixture-worker',
    contractVersion: CODING_WORKER_CONTRACT_VERSION,
    admission: {
      externalControl: true,
      sessionAddressability: true,
      sameSessionContinuation: true,
      observableExecution: true,
      deterministicInterruption: true,
    },
    start: active,
    continue: active,
    cancel: active,
    inspect: active,
    recover: active,
  };
}

test('durable fields are normalized without provider-specific state', () => {
  const job = applyCanonicalJobFields({ status: 'COMPLETED', workerHandle: ' handle ' });
  assert.equal(job.workerState, WORKER_STATES.COMPLETED);
  assert.equal(job.workerHandle, ' handle ');
  assert.deepEqual(
    normalizedWorkerResult({ workerHandle: '', state: 'invalid', output: 4 }),
    { workerHandle: null, state: WORKER_STATES.UNKNOWN, output: '4' },
  );
});

test('the resolver selects an injected adapter by neutral identifier', () => {
  const resolve = createWorkerAdapterResolver({ 'fixture-worker': worker });
  assert.equal(resolve({ workerId: 'fixture-worker' }).workerId, 'fixture-worker');
  assert.throws(() => resolve({ workerId: 'missing-worker' }), /unavailable/);
});

test('the resolver rejects a structurally valid worker without admission capabilities', () => {
  const resolve = createWorkerAdapterResolver({
    'reference-worker': () => ({ ...worker(), workerId: 'reference-worker', admission: { externalControl: true } }),
  });
  assert.throws(
    () => resolve({ workerId: 'reference-worker' }),
    (error) => {
      assert.equal(error.admission.status, 'REJECTED');
      assert.deepEqual(error.admission.reasons, [
        'SESSION_ADDRESSABILITY_REQUIRED',
        'CONTINUATION_REQUIRED',
        'OBSERVABLE_EXECUTION_REQUIRED',
        'INTERRUPTION_SEMANTICS_REQUIRED',
      ]);
      return true;
    },
  );
});

test('default workspace configuration has no built-in machine path', () => {
  assert.equal(configuredDefaultWorktree({}), null);
  assert.equal(configuredDefaultWorktree({ TASK_ORCHESTRATOR_DEFAULT_WORKTREE: '  workspace  ' }), 'workspace');
});
