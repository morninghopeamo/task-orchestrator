'use strict';

const crypto = require('node:crypto');
const { WORKER_STATES, TERMINAL_WORKER_STATES } = require('../core/coding-worker-contract.cjs');
const { normalizedWorkerResult } = require('../core/durable-job-schema.cjs');

const STATUS_FOR_STATE = Object.freeze({
  [WORKER_STATES.RUNNING]: 'RUNNING',
  [WORKER_STATES.STOPPED]: 'WAITING_HUMAN',
  [WORKER_STATES.COMPLETED]: 'COMPLETED',
  [WORKER_STATES.FAILED]: 'FAILED',
  [WORKER_STATES.CANCELLED]: 'CANCELLED',
  [WORKER_STATES.UNKNOWN]: 'ORPHANED',
});

function isTerminal(job) {
  return TERMINAL_WORKER_STATES.has(job.workerState);
}

function createJobController({ jobStore, resolveWorker, now = () => new Date().toISOString(), createId = () => crypto.randomUUID() } = {}) {
  if (!jobStore || typeof jobStore.create !== 'function' || typeof jobStore.update !== 'function') throw new TypeError('job controller requires a job store');
  if (typeof resolveWorker !== 'function') throw new TypeError('job controller requires a worker resolver');

  function submit({ task, workerId, workerProfileId }) {
    if (typeof task !== 'string' || !task.trim()) throw new TypeError('task is required');
    if (typeof workerId !== 'string' || !workerId.trim()) throw new TypeError('workerId is required');
    if (typeof workerProfileId !== 'string' || !workerProfileId.trim()) throw new TypeError('workerProfileId is required');
    const timestamp = now();
    return jobStore.create({
      id: createId(), task, workerId, workerProfileId, workerHandle: null,
      status: 'STARTING', workerState: WORKER_STATES.RUNNING, result: null,
      revision: 0, createdAt: timestamp, updatedAt: timestamp,
    });
  }

  function applyResult(id, result) {
    const normalized = normalizedWorkerResult(result);
    if (!normalized.workerHandle) throw new Error('worker result is missing workerHandle');
    return jobStore.update(id, (job) => {
      // A canonical terminal result is authoritative. A late async update can
      // be observed by the worker but cannot overwrite that terminal fact.
      if (isTerminal(job)) return job;
      job.workerHandle = normalized.workerHandle;
      job.workerState = normalized.state;
      job.status = STATUS_FOR_STATE[normalized.state];
      if (TERMINAL_WORKER_STATES.has(normalized.state)) {
        job.result = { state: normalized.state, output: normalized.output };
      }
      job.revision += 1;
      job.updatedAt = now();
      return job;
    });
  }

  async function invoke(id, operation, payload = {}) {
    const job = jobStore.get(id);
    if (!job) throw new Error(`unknown job: ${id}`);
    if (isTerminal(job)) return job;
    const worker = resolveWorker(job);
    try {
      const result = await worker[operation](payload);
      return applyResult(id, result);
    } catch (error) {
      return applyResult(id, { workerHandle: job.workerHandle || `unavailable-${id}`, state: WORKER_STATES.FAILED, output: error.message || String(error) });
    }
  }

  return {
    submit,
    get: (id) => jobStore.get(id),
    run: (id) => {
      const job = jobStore.get(id);
      if (!job) return Promise.reject(new Error(`unknown job: ${id}`));
      return invoke(id, 'start', { task: job.task, mode: 'write', context: { jobId: id } });
    },
    continue: (id, instruction) => invoke(id, 'continue', { workerHandle: jobStore.get(id)?.workerHandle, instruction }),
    recover: (id) => invoke(id, 'recover', { workerHandle: jobStore.get(id)?.workerHandle }),
    cancel: (id) => invoke(id, 'cancel', { workerHandle: jobStore.get(id)?.workerHandle }),
  };
}

module.exports = { createJobController, STATUS_FOR_STATE };
