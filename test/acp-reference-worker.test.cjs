'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { ADMISSION_STATUSES, validateWorkerAdmission } = require('../core/worker-admission-contract.cjs');
const { createWorkerAdapterResolver } = require('../core/worker-adapter-resolver.cjs');
const { createAcpStdioBackend } = require('../workers/acp/stdio-backend.cjs');
const { createAcpReferenceWorker } = require('../workers/acp/reference-worker.cjs');

function backend(mode) {
  return createAcpStdioBackend({
    command: process.execPath,
    args: [path.join(__dirname, 'acp-fixture-worker.cjs'), mode],
    workingDirectory: process.cwd(),
    allowProcessLaunch: true,
  });
}

function resolveReferenceWorker(acpBackend) {
  const resolve = createWorkerAdapterResolver({
    'acp-reference': ({ backend: configuredBackend }) => createAcpReferenceWorker({ backend: configuredBackend }),
  });
  return resolve({ workerId: 'acp-reference' }, { backend: acpBackend });
}

test('ACP reference worker is admitted and closes a resumable delegation on one ACP session', async () => {
  const worker = resolveReferenceWorker(backend('resumable'));
  assert.deepEqual(validateWorkerAdmission(worker), { status: ADMISSION_STATUSES.ADMITTED, reasons: [] });

  const interrupted = await worker.start({ task: 'delegate reference task' });
  assert.equal(interrupted.state, 'stopped');
  assert.match(interrupted.workerHandle, /^acp-/);
  assert.match(interrupted.sessionId, /^fixture-session-/);

  const observed = await worker.inspect({ workerHandle: interrupted.workerHandle });
  assert.equal(observed.state, 'stopped');
  assert.equal(observed.sessionId, interrupted.sessionId);

  const completed = await worker.continue({ workerHandle: interrupted.workerHandle, instruction: 'continue same task' });
  assert.equal(completed.state, 'completed');
  assert.equal(completed.workerHandle, interrupted.workerHandle);
  assert.equal(completed.sessionId, interrupted.sessionId, 'continuation must reuse the original ACP session');
  assert.equal(completed.output, 'pause-done');
});

test('terminal ACP failure is not resumable and cannot enter a continuation loop', async () => {
  const worker = resolveReferenceWorker(backend('fatal'));
  const failed = await worker.start({ task: 'delegate failing task' });
  assert.equal(failed.state, 'failed');
  assert.equal(failed.output, 'fatal fixture failure');

  const afterContinuationAttempt = await worker.continue({ workerHandle: failed.workerHandle, instruction: 'must not send' });
  assert.equal(afterContinuationAttempt.state, 'failed');
  assert.equal(afterContinuationAttempt.workerHandle, failed.workerHandle);
  assert.equal(afterContinuationAttempt.sessionId, failed.sessionId);
});

test('resolver rejects an ACP reference worker whose admission declaration is incomplete', () => {
  const acpBackend = backend('terminal');
  const resolve = createWorkerAdapterResolver({
    'acp-reference': () => {
      const worker = createAcpReferenceWorker({ backend: acpBackend });
      worker.admission.deterministicInterruption = false;
      return worker;
    },
  });
  assert.throws(
    () => resolve({ workerId: 'acp-reference' }),
    (error) => error.admission?.reasons.includes('INTERRUPTION_SEMANTICS_REQUIRED'),
  );
});
