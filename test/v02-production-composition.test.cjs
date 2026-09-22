'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const test = require('node:test');

const execFileAsync = promisify(execFile);

test('public CLI delegates through a detached supervisor reconstructed from a serialized profile', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'task-orchestrator-v02-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const profiles = path.join(directory, 'profiles.json');
  const jobs = path.join(directory, 'jobs.json');
  fs.writeFileSync(profiles, JSON.stringify({ profiles: [{
    id: 'acp-reference-fixture', workerId: 'acp-reference', transport: 'acp-stdio', command: process.execPath,
    args: [path.join(__dirname, 'acp-fixture-worker.cjs'), 'terminal'], workingDirectory: directory, environment: {}, allowProcessLaunch: true,
  }] }));
  const cli = path.join(__dirname, '../runtime/task-orchestrator.cjs');
  const { stdout, stderr } = await execFileAsync(process.execPath, [cli, 'run', '--job-store', jobs, '--profiles', profiles, '--profile', 'acp-reference-fixture', '--task', 'delegated task'], { timeout: 10000 });
  assert.equal(stderr, '');
  const result = JSON.parse(stdout);
  assert.equal(result.workerState, 'completed');
  assert.equal(result.result.output, 'chunk-done');
  const durable = fs.readFileSync(jobs, 'utf8');
  assert.doesNotMatch(durable, new RegExp(process.execPath.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')));
  assert.doesNotMatch(durable, new RegExp(directory.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')));
  assert.doesNotMatch(durable, /allowProcessLaunch|environment|transport/);
});
