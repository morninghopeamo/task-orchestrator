'use strict';

const assert = require('node:assert/strict');
const {
  CODING_WORKER_CONTRACT_VERSION,
  WORKER_STATES,
  runWorkerConformance,
} = require('../core/coding-worker-contract.cjs');

function createFakeCodingWorker() {
  let nextHandle = 0;
  const sessions = new Map();
  const calls = [];

  function result(session) {
    return { workerHandle: session.workerHandle, state: session.state, output: session.output || '' };
  }

  function sessionFor(workerHandle) {
    const session = sessions.get(workerHandle);
    if (!session) throw new Error(`unknown fake worker handle: ${workerHandle}`);
    return session;
  }

  return {
    workerId: 'fake-coding-worker',
    contractVersion: CODING_WORKER_CONTRACT_VERSION,
    calls,
    async start(input) {
      assert.equal(input.context.conformance, true);
      const workerHandle = `fake-${++nextHandle}`;
      const session = { workerHandle, state: WORKER_STATES.RUNNING, continueCount: 0, output: '' };
      sessions.set(workerHandle, session);
      calls.push({ operation: 'start', workerHandle });
      return result(session);
    },
    async continue({ workerHandle }) {
      const session = sessionFor(workerHandle);
      session.continueCount += 1;
      if (session.continueCount === 1) {
        session.state = WORKER_STATES.STOPPED;
        session.output = 'partial fixture output';
      } else {
        session.state = WORKER_STATES.COMPLETED;
        session.output = 'completed fixture output';
      }
      calls.push({ operation: 'continue', workerHandle });
      return result(session);
    },
    async cancel({ workerHandle }) {
      const session = sessionFor(workerHandle);
      session.state = WORKER_STATES.CANCELLED;
      calls.push({ operation: 'cancel', workerHandle });
      return result(session);
    },
    async inspect({ workerHandle }) {
      const session = sessionFor(workerHandle);
      calls.push({ operation: 'inspect', workerHandle });
      return result(session);
    },
    async recover({ workerHandle }) {
      const session = sessionFor(workerHandle);
      calls.push({ operation: 'recover', workerHandle });
      return result(session);
    },
  };
}

async function main() {
  const worker = createFakeCodingWorker();
  const report = await runWorkerConformance(worker);

  assert.equal(report.status, 'passed');
  assert.deepEqual(report.trace, [
    'start', 'inspect-active', 'continue-stopped', 'continue-completed',
    'start-cancellable', 'cancel', 'recover',
  ]);
  assert.deepEqual(report.observations, {
    activeState: 'running', completionState: 'completed', cancellationState: 'cancelled', recoveryState: 'cancelled',
  });
  assert.equal(worker.calls.filter((call) => call.operation === 'start').length, 2);
  assert.equal(worker.calls.filter((call) => call.operation === 'continue').length, 2);
  assert.equal(worker.calls[1].workerHandle, worker.calls[2].workerHandle, 'continuation must retain the initial worker handle');

  const unstableWorker = createFakeCodingWorker();
  const stableContinue = unstableWorker.continue;
  unstableWorker.continue = async (input) => ({
    ...(await stableContinue(input)),
    workerHandle: 'unexpected-replacement-handle',
  });
  await assert.rejects(
    () => runWorkerConformance(unstableWorker),
    /continue changed workerHandle/,
    'the harness must reject a continuation that replaces the durable worker handle',
  );
  console.log('coding worker contract conformance fixture: PASS');
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
