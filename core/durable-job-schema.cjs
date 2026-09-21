'use strict';

const { WORKER_STATES } = require('./coding-worker-contract.cjs');

const JOB_STATUS_TO_WORKER_STATE = Object.freeze({
  STARTING: WORKER_STATES.RUNNING,
  RUNNING: WORKER_STATES.RUNNING,
  RESUMING_HUMAN: WORKER_STATES.RUNNING,
  WAITING_HUMAN: WORKER_STATES.STOPPED,
  CANCEL_REQUESTED: WORKER_STATES.STOPPED,
  COMPLETED: WORKER_STATES.COMPLETED,
  FAILED: WORKER_STATES.FAILED,
  CANCELLED: WORKER_STATES.CANCELLED,
  ORPHANED: WORKER_STATES.UNKNOWN,
});

function normalizeWorkerHandle(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function workerStateForJobStatus(status, fallback = WORKER_STATES.UNKNOWN) {
  return JOB_STATUS_TO_WORKER_STATE[status] || fallback;
}

// This helper owns only provider-neutral durable fields. Provider-specific
// compatibility mapping belongs at an adapter boundary, not in this module.
function applyCanonicalJobFields(job) {
  if (!job || typeof job !== 'object') throw new TypeError('durable job must be an object');
  job.workerHandle = normalizeWorkerHandle(job.workerHandle);
  job.workerState = workerStateForJobStatus(job.status, job.workerState || WORKER_STATES.UNKNOWN);
  return job;
}

function normalizedWorkerResult({ workerHandle, state, output = '' } = {}) {
  return {
    workerHandle: normalizeWorkerHandle(workerHandle),
    state: Object.values(WORKER_STATES).includes(state) ? state : WORKER_STATES.UNKNOWN,
    output: typeof output === 'string' ? output : String(output || ''),
  };
}

module.exports = {
  JOB_STATUS_TO_WORKER_STATE,
  normalizeWorkerHandle,
  workerStateForJobStatus,
  applyCanonicalJobFields,
  normalizedWorkerResult,
};
