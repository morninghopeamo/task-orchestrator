'use strict';

const mode = process.argv[2] || 'terminal';
let buffer = '';
let nextSession = 0;
let sessionId = null;
let promptCount = 0;

function send(message) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`); }
function response(id, result) { send({ id, result }); }
function finish() { setImmediate(() => process.exit(0)); }

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    const request = JSON.parse(line);
    if (request.method === 'initialize') {
      if (!request.params || typeof request.params.clientCapabilities !== 'object' ||
          request.params.clientInfo?.name !== 'task-orchestrator' || request.params.clientInfo?.version !== '0.2') {
        send({ id: request.id, error: { code: -32602, message: 'Invalid params' } });
      } else response(request.id, { protocolVersion: 1 });
    }
    if (request.method === 'session/new') {
      if (!request.params || typeof request.params.workingDirectory !== 'string' || !request.params.workingDirectory ||
          !Array.isArray(request.params.mcpServers)) {
        send({ id: request.id, error: { code: -32602, message: 'Invalid params' } });
      } else {
        sessionId = `fixture-session-${process.pid}-${++nextSession}`;
        response(request.id, { sessionId });
      }
    }
    if (request.method === 'session/prompt') {
      const validPrompt = Array.isArray(request.params?.prompt) && request.params.prompt.length === 1 &&
        request.params.prompt[0]?.type === 'text' && typeof request.params.prompt[0]?.text === 'string' &&
        request.params.sessionId === sessionId;
      if (!validPrompt) {
        send({ id: request.id, error: { code: -32602, message: 'Invalid params' } });
        finish();
      } else if (mode === 'invalid-prompt') {
        send({ id: request.id, error: { code: -32001, message: 'Prompt rejected for fixture coverage' } });
        finish();
      } else if (mode === 'terminal') {
        send({ method: 'session/update', params: { sessionId, update: { text: 'chunk-' } } });
        send({ method: 'session/terminal', params: { sessionId, state: 'completed' } });
        response(request.id, { state: 'completed', output: 'done' });
        finish();
      } else if (mode === 'resumable') {
        promptCount += 1;
        if (promptCount === 1) response(request.id, { state: 'stopped', output: 'pause-' });
        else if (promptCount === 2) {
          response(request.id, { state: 'completed', output: 'done' });
          finish();
        } else {
          send({ id: request.id, error: { code: -32002, message: 'Unexpected extra continuation' } });
          finish();
        }
      } else if (mode === 'fatal') {
        response(request.id, { state: 'failed', output: 'fatal fixture failure' });
        finish();
      } else response(request.id, { state: 'running' });
    }
    if (request.method === 'session/load') {
      response(request.id, { state: 'completed', output: 'recovered' });
      finish();
    }
    if (request.method === 'session/cancel') {
      send({ method: 'session/terminal', params: { sessionId, state: 'cancelled' } });
      response(request.id, { state: 'cancelled' });
      finish();
    }
  }
});
