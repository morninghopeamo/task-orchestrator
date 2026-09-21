'use strict';

// The worker contract is deliberately provider-neutral. It describes the
// boundary between the durable orchestrator and one external coding worker;
// it does not choose a worker or invoke a network service.
const CODING_WORKER_CONTRACT_VERSION = '1.0';

const WORKER_STATES = Object.freeze({
  RUNNING: 'running',
  STOPPED: 'stopped',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  UNKNOWN: 'unknown',
});

const TERMINAL_WORKER_STATES = new Set([
  WORKER_STATES.COMPLETED,
  WORKER_STATES.FAILED,
  WORKER_STATES.CANCELLED,
]);

const REQUIRED_OPERATIONS = Object.freeze(['start', 'continue', 'cancel', 'inspect', 'recover']);

function assert(condition, message) {
  if (!condition) throw new TypeError(`CODING_WORKER_CONTRACT: ${message}`);
}

function assertWorkerDescriptor(worker) {
  assert(worker && typeof worker === 'object', 'worker must be an object');
  assert(typeof worker.workerId === 'string' && worker.workerId.trim(), 'workerId must be a non-empty string');
  assert(worker.contractVersion === CODING_WORKER_CONTRACT_VERSION, `contractVersion must be ${CODING_WORKER_CONTRACT_VERSION}`);
  for (const operation of REQUIRED_OPERATIONS) {
    assert(typeof worker[operation] === 'function', `${operation} must be a function`);
  }
  return worker;
}

function assertWorkerResult(result, operation, { expectedHandle = null, terminal = null } = {}) {
  assert(result && typeof result === 'object', `${operation} must return an object`);
  assert(typeof result.state === 'string' && Object.values(WORKER_STATES).includes(result.state), `${operation} returned an invalid state`);
  assert(typeof result.workerHandle === 'string' && result.workerHandle.trim(), `${operation} must return workerHandle`);
  if (expectedHandle !== null) assert(result.workerHandle === expectedHandle, `${operation} changed workerHandle`);
  if (terminal === true) assert(TERMINAL_WORKER_STATES.has(result.state), `${operation} must return a terminal state`);
  if (terminal === false) assert(!TERMINAL_WORKER_STATES.has(result.state), `${operation} must not return a terminal state`);
  return result;
}

// An offline conformance probe for adapters. It intentionally uses synthetic
// task text and never supplies credentials, paths, or provider configuration.
async function runWorkerConformance(worker) {
  assertWorkerDescriptor(worker);
  const trace = [];
  const baseInput = Object.freeze({
    task: 'Add a small pure function and its unit test.',
    mode: 'write',
    context: { conformance: true },
  });

  const started = assertWorkerResult(await worker.start(baseInput), 'start', { terminal: false });
  trace.push('start');
  const activeHandle = started.workerHandle;

  const inspectedActive = assertWorkerResult(await worker.inspect({ workerHandle: activeHandle }), 'inspect', { expectedHandle: activeHandle, terminal: false });
  trace.push('inspect-active');

  const stopped = assertWorkerResult(await worker.continue({ workerHandle: activeHandle, instruction: 'Continue from the current point.' }), 'continue', { expectedHandle: activeHandle, terminal: false });
  trace.push('continue-stopped');
  assert(stopped.state === WORKER_STATES.STOPPED || stopped.state === WORKER_STATES.RUNNING, 'continue must preserve an active worker state before completion');

  const completed = assertWorkerResult(await worker.continue({ workerHandle: activeHandle, instruction: 'Finish the remaining work.' }), 'continue', { expectedHandle: activeHandle, terminal: true });
  trace.push('continue-completed');
  assert(completed.state === WORKER_STATES.COMPLETED, 'completion scenario must finish as completed');

  const cancelStarted = assertWorkerResult(await worker.start({ ...baseInput, task: 'Begin a cancellable fixture task.' }), 'start', { terminal: false });
  trace.push('start-cancellable');
  const cancelled = assertWorkerResult(await worker.cancel({ workerHandle: cancelStarted.workerHandle }), 'cancel', { expectedHandle: cancelStarted.workerHandle, terminal: true });
  trace.push('cancel');
  assert(cancelled.state === WORKER_STATES.CANCELLED, 'cancel scenario must finish as cancelled');

  const recovered = assertWorkerResult(await worker.recover({ workerHandle: cancelStarted.workerHandle }), 'recover', { expectedHandle: cancelStarted.workerHandle, terminal: true });
  trace.push('recover');
  assert(recovered.state === WORKER_STATES.CANCELLED, 'recovery must preserve the canonical terminal state');

  return {
    contractVersion: CODING_WORKER_CONTRACT_VERSION,
    workerId: worker.workerId,
    status: 'passed',
    trace,
    observations: {
      activeState: inspectedActive.state,
      completionState: completed.state,
      cancellationState: cancelled.state,
      recoveryState: recovered.state,
    },
  };
}

module.exports = {
  CODING_WORKER_CONTRACT_VERSION,
  WORKER_STATES,
  TERMINAL_WORKER_STATES,
  REQUIRED_OPERATIONS,
  assertWorkerDescriptor,
  assertWorkerResult,
  runWorkerConformance,
};
