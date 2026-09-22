'use strict';

const fs = require('node:fs');
const path = require('node:path');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyDocument() {
  return { version: 1, jobs: {} };
}

// This deliberately small store has one writer at a time: the submitting CLI
// writes before launching its supervisor, and a supervisor then owns updates.
// It never receives provider configuration; that stays in the profile file.
function createJsonJobStore(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new TypeError('job store path is required');

  function readDocument() {
    if (!fs.existsSync(filePath)) return emptyDocument();
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed || parsed.version !== 1 || !parsed.jobs || typeof parsed.jobs !== 'object') {
      throw new Error('job store has an unsupported document shape');
    }
    return parsed;
  }

  function writeDocument(document) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, filePath);
  }

  return {
    create(job) {
      const document = readDocument();
      if (document.jobs[job.id]) throw new Error(`job already exists: ${job.id}`);
      document.jobs[job.id] = clone(job);
      writeDocument(document);
      return clone(document.jobs[job.id]);
    },
    get(id) {
      const job = readDocument().jobs[id];
      return job ? clone(job) : null;
    },
    update(id, transform) {
      const document = readDocument();
      const current = document.jobs[id];
      if (!current) throw new Error(`unknown job: ${id}`);
      const next = transform(clone(current));
      if (!next || typeof next !== 'object') throw new TypeError('job update must return an object');
      document.jobs[id] = clone(next);
      writeDocument(document);
      return clone(document.jobs[id]);
    },
  };
}

module.exports = { createJsonJobStore };
