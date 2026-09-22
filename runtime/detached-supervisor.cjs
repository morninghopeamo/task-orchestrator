'use strict';

const path = require('node:path');
const { createWorkerAdapterResolver } = require('../core/worker-adapter-resolver.cjs');
const { createJsonJobStore } = require('./json-job-store.cjs');
const { loadWorkerProfiles, profileForId } = require('./worker-profile-config.cjs');
const { createJobController } = require('./job-controller.cjs');
const { createAcpStdioBackend } = require('../workers/acp/stdio-backend.cjs');
const { createAcpReferenceWorker } = require('../workers/acp/reference-worker.cjs');

function argumentValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

async function main(argv = process.argv.slice(2)) {
  const storePath = argumentValue(argv, '--job-store');
  const profilePath = argumentValue(argv, '--profiles');
  const jobId = argumentValue(argv, '--job-id');
  if (!storePath || !profilePath || !jobId) throw new Error('usage: detached-supervisor --job-store <file> --profiles <file> --job-id <id>');
  const jobStore = createJsonJobStore(path.resolve(storePath));
  const profiles = loadWorkerProfiles(path.resolve(profilePath));
  const resolver = createWorkerAdapterResolver({
    'acp-reference': ({ profile }) => createAcpReferenceWorker({ backend: createAcpStdioBackend(profile) }),
  });
  const controller = createJobController({
    jobStore,
    resolveWorker: (job) => resolver(job, { profile: profileForId(profiles, job.workerProfileId) }),
  });
  return controller.run(jobId);
}

if (require.main === module) {
  main().then((job) => process.stdout.write(`${JSON.stringify(job)}\n`)).catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main };
