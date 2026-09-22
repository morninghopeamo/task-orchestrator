'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ADMISSION_REASONS,
  ADMISSION_STATUSES,
  validateWorkerAdmission,
} = require('../core/worker-admission-contract.cjs');

function referenceWorker(admission) {
  return { workerId: 'reference-worker', admission };
}

function completeAdmission(overrides = {}) {
  return {
    externalControl: true,
    sessionAddressability: true,
    sameSessionContinuation: true,
    observableExecution: true,
    deterministicInterruption: true,
    ...overrides,
  };
}

test('a generic worker declaring every required capability is admitted', () => {
  assert.deepEqual(validateWorkerAdmission(referenceWorker(completeAdmission())), {
    status: ADMISSION_STATUSES.ADMITTED,
    reasons: [],
  });
});

test('a worker without reliable external control is rejected', () => {
  assert.deepEqual(validateWorkerAdmission(referenceWorker(completeAdmission({ externalControl: false }))), {
    status: ADMISSION_STATUSES.REJECTED,
    reasons: [ADMISSION_REASONS.EXTERNAL_CONTROL_REQUIRED],
  });
});

test('a worker without session addressability is rejected', () => {
  assert.deepEqual(validateWorkerAdmission(referenceWorker(completeAdmission({ sessionAddressability: false }))), {
    status: ADMISSION_STATUSES.REJECTED,
    reasons: [ADMISSION_REASONS.SESSION_ADDRESSABILITY_REQUIRED],
  });
});

test('a worker without same-session continuation is rejected', () => {
  assert.deepEqual(validateWorkerAdmission(referenceWorker(completeAdmission({ sameSessionContinuation: false }))), {
    status: ADMISSION_STATUSES.REJECTED,
    reasons: [ADMISSION_REASONS.CONTINUATION_REQUIRED],
  });
});

test('a worker without structured execution observability is rejected', () => {
  assert.deepEqual(validateWorkerAdmission(referenceWorker(completeAdmission({ observableExecution: false }))), {
    status: ADMISSION_STATUSES.REJECTED,
    reasons: [ADMISSION_REASONS.OBSERVABLE_EXECUTION_REQUIRED],
  });
});

test('a worker without deterministic interruption semantics is rejected', () => {
  assert.deepEqual(validateWorkerAdmission(referenceWorker(completeAdmission({ deterministicInterruption: false }))), {
    status: ADMISSION_STATUSES.REJECTED,
    reasons: [ADMISSION_REASONS.INTERRUPTION_SEMANTICS_REQUIRED],
  });
});

test('multiple missing capabilities produce stable rejection reasons', () => {
  assert.deepEqual(
    validateWorkerAdmission(referenceWorker(completeAdmission({
      externalControl: false,
      observableExecution: false,
      deterministicInterruption: false,
    }))),
    {
      status: ADMISSION_STATUSES.REJECTED,
      reasons: [
        ADMISSION_REASONS.EXTERNAL_CONTROL_REQUIRED,
        ADMISSION_REASONS.OBSERVABLE_EXECUTION_REQUIRED,
        ADMISSION_REASONS.INTERRUPTION_SEMANTICS_REQUIRED,
      ],
    },
  );
});
