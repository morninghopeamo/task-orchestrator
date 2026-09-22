#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');
const { createJsonJobStore } = require('./json-job-store.cjs');
const { loadWorkerProfiles, profileForId } = require('./worker-profile-config.cjs');
const { createJobController } = require('./job-controller.cjs');

function argumentValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

function sleep(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

async function main(argv = process.argv.slice(2)) {
  const [command] = argv;
  if (command !== 'run') throw new Error('usage: task-orchestrator run --job-store <file> --profiles <file> --profile <id> --task <text>');
  const storePath = argumentValue(argv, '--job-store');
  const profilePath = argumentValue(argv, '--profiles');
  const profileId = argumentValue(argv, '--profile');
  const task = argumentValue(argv, '--task');
  if (!storePath || !profilePath || !profileId || !task) throw new Error('run requires --job-store, --profiles, --profile, and --task');
  const resolvedStorePath = path.resolve(storePath);
  const resolvedProfilePath = path.resolve(profilePath);
  const profiles = loadWorkerProfiles(resolvedProfilePath);
  const profile = profileForId(profiles, profileId);
  const store = createJsonJobStore(resolvedStorePath);
  // The submitter deliberately does not build a backend. Only the detached
  // supervisor composes a provider adapter from the serialized profile.
  const controller = createJobController({ jobStore: store, resolveWorker: () => { throw new Error('the submitting CLI never constructs provider backends'); } });
  const submitted = controller.submit({ task, workerId: profile.workerId, workerProfileId: profile.id });
  const supervisor = path.resolve(__dirname, 'detached-supervisor.cjs');
  const child = spawn(process.execPath, [supervisor, '--job-store', resolvedStorePath, '--profiles', resolvedProfilePath, '--job-id', submitted.id], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const job = store.get(submitted.id);
    if (job && ['completed', 'failed', 'cancelled'].includes(job.workerState)) return job;
    await sleep(20);
  }
  throw new Error(`timed out waiting for detached supervisor job ${submitted.id}`);
}

if (require.main === module) {
  main().then((job) => process.stdout.write(`${JSON.stringify(job)}\n`)).catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main };
