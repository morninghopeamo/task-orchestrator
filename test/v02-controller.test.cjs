'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createJsonJobStore } = require('../runtime/json-job-store.cjs');
const { createJobController } = require('../runtime/job-controller.cjs');

function temporaryStore() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'task-orchestrator-v02-'));
  return { directory, store: createJsonJobStore(path.join(directory, 'jobs.json')) };
}

test('offline controller persists a fast terminal start without a continuation', async (t) => {
  const { directory, store } = temporaryStore();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const calls = [];
  const controller = createJobController({
    jobStore: store,
    createId: () => 'job-fast',
    now: () => '2026-01-01T00:00:00.000Z',
    resolveWorker: () => ({
      async start({ task }) { calls.push(task); return { workerHandle: 'fixture-worker-1', state: 'completed', output: 'offline result' }; },
    }),
  });
  const submitted = controller.submit({ task: 'offline task', workerId: 'fixture-worker', workerProfileId: 'fixture-profile' });
  const completed = await controller.run(submitted.id);
  assert.equal(completed.status, 'COMPLETED');
  assert.deepEqual(completed.result, { state: 'completed', output: 'offline result' });
  assert.deepEqual(calls, ['offline task']);
  const durableText = fs.readFileSync(path.join(directory, 'jobs.json'), 'utf8');
  assert.match(durableText, /"workerProfileId": "fixture-profile"/);
  assert.doesNotMatch(durableText, /command|environment|credential/i);
});

test('offline deterministic recovery, cancellation, and terminal immutability retain one handle', async (t) => {
  const { directory, store } = temporaryStore();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const worker = {
    async start() { return { workerHandle: 'stable-handle', state: 'stopped', output: 'interrupted' }; },
    async recover({ workerHandle }) { return { workerHandle, state: 'completed', output: 'recovered' }; },
    async cancel({ workerHandle }) { return { workerHandle, state: 'cancelled', output: 'cancelled' }; },
  };
  let number = 0;
  const controller = createJobController({ jobStore: store, resolveWorker: () => worker, createId: () => `job-${++number}` });
  const interrupted = controller.submit({ task: 'recover me', workerId: 'fixture-worker', workerProfileId: 'fixture-profile' });
  assert.equal((await controller.run(interrupted.id)).workerState, 'stopped');
  const recovered = await controller.recover(interrupted.id);
  assert.equal(recovered.workerHandle, 'stable-handle');
  assert.equal(recovered.workerState, 'completed');
  const lateCancellation = await controller.cancel(interrupted.id);
  assert.equal(lateCancellation.workerState, 'completed');
  assert.equal(lateCancellation.result.output, 'recovered');

  const cancellable = controller.submit({ task: 'cancel me', workerId: 'fixture-worker', workerProfileId: 'fixture-profile' });
  await controller.run(cancellable.id);
  const cancelled = await controller.cancel(cancellable.id);
  assert.equal(cancelled.workerState, 'cancelled');
  assert.equal((await controller.recover(cancellable.id)).workerState, 'cancelled');
});
