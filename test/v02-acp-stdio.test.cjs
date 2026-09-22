'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { createAcpStdioBackend } = require('../workers/acp/stdio-backend.cjs');

function backend(mode) {
  return createAcpStdioBackend({ command: process.execPath, args: [path.join(__dirname, 'acp-fixture-worker.cjs'), mode], workingDirectory: process.cwd(), allowProcessLaunch: true });
}

test('ACP stdio start includes workingDirectory and an empty MCP-server list, dispatches typed prompt blocks, and accepts terminal chunks', async () => {
  const result = await backend('terminal').start({ task: 'initial prompt' });
  assert.equal(result.state, 'completed');
  assert.equal(result.output, 'chunk-done');
  assert.match(result.workerHandle, /^acp-/);
});

test('ACP stdio sends typed text prompt blocks and preserves method and request id on RPC errors', async () => {
  await assert.rejects(
    backend('invalid-prompt').start({ task: 'typed prompt' }),
    (error) => {
      assert.equal(error.method, 'session/prompt');
      assert.equal(error.requestId, '3');
      assert.equal(error.code, -32001);
      assert.match(error.message, /method=session\/prompt/);
      assert.match(error.message, /requestId=3/);
      return true;
    },
  );
});

test('ACP stdio cancellation and session load/recovery parse canonical terminal results', async () => {
  const cancellable = backend('cancel');
  const active = await cancellable.start({ task: 'cancellable prompt' });
  assert.equal(active.state, 'running');
  const cancelled = await cancellable.cancel({ workerHandle: active.workerHandle });
  assert.equal(cancelled.state, 'cancelled');

  const recoverable = backend('recover');
  const interrupted = await recoverable.start({ task: 'recoverable prompt' });
  assert.equal(interrupted.state, 'running');
  const recovered = await recoverable.recover({ workerHandle: interrupted.workerHandle });
  assert.equal(recovered.state, 'completed');
  assert.equal(recovered.output, 'recovered');
});

test('ACP stdio launch is fail-closed without explicit opt-in', () => {
  assert.throws(() => createAcpStdioBackend({ command: process.execPath }), /explicit opt-in/);
});

test('ACP stdio requires an explicit working directory for session creation', () => {
  assert.throws(() => createAcpStdioBackend({ command: process.execPath, allowProcessLaunch: true }), /workingDirectory/);
});
