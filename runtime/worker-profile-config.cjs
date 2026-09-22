'use strict';

const fs = require('node:fs');

function asStringArray(value, label) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new TypeError(`${label} must be an array of strings`);
  }
  return value.slice();
}

function validateProfile(profile, expectedId) {
  if (!profile || typeof profile !== 'object') throw new TypeError('worker profile must be an object');
  if (typeof profile.id !== 'string' || !profile.id.trim()) throw new TypeError('worker profile id is required');
  if (expectedId && profile.id !== expectedId) throw new Error(`worker profile id mismatch: ${expectedId}`);
  if (profile.workerId !== 'acp-reference') throw new Error('only the public ACP reference worker profile is supported');
  if (profile.transport !== 'acp-stdio') throw new Error('ACP reference worker transport must be acp-stdio');
  if (typeof profile.command !== 'string' || !profile.command.trim()) throw new TypeError('worker profile command is required');
  if (typeof profile.workingDirectory !== 'string' || !profile.workingDirectory.trim()) throw new TypeError('worker profile workingDirectory is required');
  if (profile.allowProcessLaunch !== true) throw new Error('worker profile must explicitly allow process launch');
  const args = asStringArray(profile.args || [], 'worker profile args');
  const environment = profile.environment || {};
  if (!environment || typeof environment !== 'object' || Array.isArray(environment)) throw new TypeError('worker profile environment must be an object');
  for (const [key, value] of Object.entries(environment)) {
    if (typeof key !== 'string' || typeof value !== 'string') throw new TypeError('worker profile environment values must be strings');
  }
  return { id: profile.id, workerId: profile.workerId, transport: profile.transport, command: profile.command, args, workingDirectory: profile.workingDirectory, environment: { ...environment }, allowProcessLaunch: true };
}

function loadWorkerProfiles(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const entries = Array.isArray(parsed?.profiles) ? parsed.profiles : Object.values(parsed?.profiles || {});
  const profiles = new Map();
  for (const raw of entries) {
    const profile = validateProfile(raw);
    if (profiles.has(profile.id)) throw new Error(`duplicate worker profile: ${profile.id}`);
    profiles.set(profile.id, profile);
  }
  return profiles;
}

function profileForId(profiles, id) {
  const profile = profiles.get(id);
  if (!profile) throw new Error(`worker profile is unavailable: ${id}`);
  return profile;
}

module.exports = { validateProfile, loadWorkerProfiles, profileForId };
