'use strict';

// Runtime paths are deployment configuration. Product code carries no
// machine-specific default; a caller may supply this environment variable
// when its deployment benefits from a convenience default.
function configuredDefaultWorktree(env = process.env) {
  const value = env.TASK_ORCHESTRATOR_DEFAULT_WORKTREE;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

module.exports = { configuredDefaultWorktree };
