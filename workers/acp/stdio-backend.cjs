'use strict';

const { spawn } = require('node:child_process');
const { WORKER_STATES, TERMINAL_WORKER_STATES } = require('../../core/coding-worker-contract.cjs');

function canonicalState(value) {
  if (Object.values(WORKER_STATES).includes(value)) return value;
  if (value === 'completed' || value === 'end_turn') return WORKER_STATES.COMPLETED;
  if (value === 'cancelled' || value === 'canceled') return WORKER_STATES.CANCELLED;
  if (value === 'failed' || value === 'error') return WORKER_STATES.FAILED;
  if (value === 'stopped' || value === 'waiting') return WORKER_STATES.STOPPED;
  return WORKER_STATES.RUNNING;
}

function textFrom(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return [value.text, value.content, value.message, value.output, value.update?.text, value.update?.content].find((item) => typeof item === 'string') || '';
}

function acpRequestError({ method, requestId, message, code, data, cause } = {}) {
  const error = new Error(`ACP RPC failure [method=${method}, requestId=${requestId}]: ${message || 'unknown error'}`);
  error.method = method;
  error.requestId = requestId;
  if (code !== undefined) error.code = code;
  if (data !== undefined) error.data = data;
  if (cause !== undefined) error.cause = cause;
  return error;
}

function createAcpStdioBackend({ command, args = [], workingDirectory, environment = {}, allowProcessLaunch = false, requestTimeoutMs = 30000 } = {}) {
  if (allowProcessLaunch !== true) throw new Error('ACP stdio process launch requires explicit opt-in');
  if (typeof command !== 'string' || !command.trim()) throw new TypeError('ACP command is required');
  if (!Array.isArray(args) || !args.every((item) => typeof item === 'string')) throw new TypeError('ACP args must be strings');
  if (typeof workingDirectory !== 'string' || !workingDirectory.trim()) throw new TypeError('ACP workingDirectory is required');
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1) throw new TypeError('ACP requestTimeoutMs must be a positive integer');

  const sessions = new Map();
  let nextHandle = 0;

  function snapshot(session) {
    return {
      workerHandle: session.workerHandle,
      sessionId: session.sessionId,
      state: session.state,
      output: session.output,
    };
  }

  async function openSession() {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...environment }, windowsHide: true });
    const session = { child, workerHandle: `acp-${++nextHandle}`, sessionId: null, state: WORKER_STATES.RUNNING, output: '', nextId: 0, pending: new Map(), closed: false };
    sessions.set(session.workerHandle, session);
    let buffer = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let message;
        try { message = JSON.parse(line); } catch { session.state = WORKER_STATES.FAILED; session.output += 'Invalid ACP JSON response'; continue; }
        if (Object.prototype.hasOwnProperty.call(message, 'id')) {
          const pending = session.pending.get(String(message.id));
          if (pending) {
            session.pending.delete(String(message.id));
            clearTimeout(pending.timer);
            if (message.error) {
              pending.reject(acpRequestError({
                method: pending.method,
                requestId: pending.requestId,
                message: message.error.message || 'ACP JSON-RPC error',
                code: message.error.code,
                data: message.error.data,
              }));
            }
            else pending.resolve(message.result || {});
          }
        } else {
          const params = message.params || {};
          if (params.sessionId && params.sessionId !== session.sessionId) continue;
          const chunkText = textFrom(params);
          if (chunkText) session.output += chunkText;
          if (message.method === 'session/terminal' || message.method === 'session/completed' || params.state || params.status) {
            session.state = canonicalState(params.state || params.status || (message.method === 'session/completed' ? 'completed' : 'running'));
          }
        }
      }
    });
    function rejectPending(error) {
      for (const [id, pending] of session.pending) {
        session.pending.delete(id);
        clearTimeout(pending.timer);
        pending.reject(acpRequestError({
          method: pending.method,
          requestId: pending.requestId,
          message: error.message,
          cause: error,
        }));
      }
    }
    child.on('error', (error) => {
      if (!TERMINAL_WORKER_STATES.has(session.state)) session.state = WORKER_STATES.FAILED;
      session.output += error.message;
      rejectPending(error);
    });
    child.on('exit', (code) => {
      if (!session.closed && !TERMINAL_WORKER_STATES.has(session.state)) {
        session.state = code === 0 ? WORKER_STATES.COMPLETED : WORKER_STATES.FAILED;
      }
      session.closed = true;
      rejectPending(new Error(`ACP process exited before replying (code ${code})`));
    });

    function request(method, params) {
      if (session.closed) return Promise.reject(new Error('ACP session is closed'));
      const id = String(++session.nextId);
      const message = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          session.pending.delete(id);
          reject(acpRequestError({ method, requestId: id, message: 'request timed out' }));
        }, requestTimeoutMs);
        const pending = { resolve, reject, timer, method, requestId: id };
        session.pending.set(id, pending);
        child.stdin.write(`${message}\n`, (error) => {
          if (error) {
            session.pending.delete(id);
            clearTimeout(timer);
            reject(acpRequestError({ method, requestId: id, message: error.message, cause: error }));
          }
        });
      });
    }
    session.request = request;
    // ACP requires the client capability object; identifying this public
    // runtime also lets providers validate the peer without any profile data.
    await request('initialize', {
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo: { name: 'task-orchestrator', version: '0.2' },
    });
    const created = await request('session/new', { workingDirectory, mcpServers: [] });
    session.sessionId = created.sessionId || created.id;
    if (typeof session.sessionId !== 'string' || !session.sessionId) throw new Error('ACP session/new did not return sessionId');
    return session;
  }

  async function prompt(session, promptText) {
    const response = await session.request('session/prompt', {
      sessionId: session.sessionId,
      prompt: [{ type: 'text', text: promptText }],
    });
    const responseText = textFrom(response);
    if (responseText) session.output += responseText;
    if (response.state || response.status || response.stopReason) session.state = canonicalState(response.state || response.status || response.stopReason);
    return snapshot(session);
  }

  function requireSession(workerHandle) {
    const session = sessions.get(workerHandle);
    if (!session) throw new Error(`unknown ACP worker handle: ${workerHandle}`);
    return session;
  }

  return {
    async start({ task }) { const session = await openSession(); return prompt(session, task); },
    async continue({ workerHandle, instruction }) { const session = requireSession(workerHandle); return TERMINAL_WORKER_STATES.has(session.state) ? snapshot(session) : prompt(session, instruction); },
    async inspect({ workerHandle }) { return snapshot(requireSession(workerHandle)); },
    async recover({ workerHandle }) {
      const session = requireSession(workerHandle);
      const response = await session.request('session/load', { sessionId: session.sessionId });
      const responseText = textFrom(response);
      if (responseText) session.output += responseText;
      if (response.state || response.status) session.state = canonicalState(response.state || response.status);
      return snapshot(session);
    },
    async cancel({ workerHandle }) {
      const session = requireSession(workerHandle);
      if (TERMINAL_WORKER_STATES.has(session.state)) return snapshot(session);
      const response = await session.request('session/cancel', { sessionId: session.sessionId });
      if (response.state || response.status) session.state = canonicalState(response.state || response.status);
      return snapshot(session);
    },
  };
}

module.exports = { createAcpStdioBackend };
