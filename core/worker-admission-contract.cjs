'use strict';

// Admission is separate from the operation-level coding worker contract. It
// defines the minimum boundary a worker must expose before the orchestrator
// can safely create and supervise a durable job for it.
const ADMISSION_STATUSES = Object.freeze({
  ADMITTED: 'ADMITTED',
  REJECTED: 'REJECTED',
});

const ADMISSION_REASONS = Object.freeze({
  EXTERNAL_CONTROL_REQUIRED: 'EXTERNAL_CONTROL_REQUIRED',
  SESSION_ADDRESSABILITY_REQUIRED: 'SESSION_ADDRESSABILITY_REQUIRED',
  CONTINUATION_REQUIRED: 'CONTINUATION_REQUIRED',
  OBSERVABLE_EXECUTION_REQUIRED: 'OBSERVABLE_EXECUTION_REQUIRED',
  INTERRUPTION_SEMANTICS_REQUIRED: 'INTERRUPTION_SEMANTICS_REQUIRED',
});

const REQUIRED_ADMISSION_CAPABILITIES = Object.freeze([
  Object.freeze({ capability: 'externalControl', reason: ADMISSION_REASONS.EXTERNAL_CONTROL_REQUIRED }),
  Object.freeze({ capability: 'sessionAddressability', reason: ADMISSION_REASONS.SESSION_ADDRESSABILITY_REQUIRED }),
  Object.freeze({ capability: 'sameSessionContinuation', reason: ADMISSION_REASONS.CONTINUATION_REQUIRED }),
  Object.freeze({ capability: 'observableExecution', reason: ADMISSION_REASONS.OBSERVABLE_EXECUTION_REQUIRED }),
  Object.freeze({ capability: 'deterministicInterruption', reason: ADMISSION_REASONS.INTERRUPTION_SEMANTICS_REQUIRED }),
]);

function validateWorkerAdmission(worker) {
  const declaration = worker?.admission;
  const reasons = REQUIRED_ADMISSION_CAPABILITIES
    .filter(({ capability }) => declaration?.[capability] !== true)
    .map(({ reason }) => reason);

  return Object.freeze({
    status: reasons.length === 0 ? ADMISSION_STATUSES.ADMITTED : ADMISSION_STATUSES.REJECTED,
    reasons: Object.freeze(reasons),
  });
}

module.exports = {
  ADMISSION_STATUSES,
  ADMISSION_REASONS,
  REQUIRED_ADMISSION_CAPABILITIES,
  validateWorkerAdmission,
};
