English | [简体中文](./README.zh-CN.md)

# Task Orchestrator

**Task Orchestrator is a durable orchestration layer for delegating long-running work to externally controllable AI workers.**

The calling application can focus on judgment, task breakdown, and supervision. The worker performs the delegated work. This repository provides provider-neutral contracts and boundary helpers that make the handoff a durable job lifecycle without making the caller manage every interruption, continuation, and worker session itself.

## Example workflow

A primary agent can submit a task to the included ACP Reference Worker through an explicitly configured ACP stdio profile.

```text
Primary agent / calling application
        |
        | delegate an implementation task
        v
Task Orchestrator
        |
        | durable job record + lifecycle supervision
        v
ACP Reference Worker
```

For example, the primary agent can break a feature into a task, hand it to a worker, then inspect progress, continue interrupted work, recover its durable session, or cancel it while retaining one stable lifecycle to reason about.

The included ACP Reference Worker uses an operator-supplied ACP stdio command. It never discovers executables, credentials, or sessions, and it cannot launch a process unless the profile explicitly opts in.

## Why Task Orchestrator exists

External workers are not always a single request that returns immediately. A task may run for a long time, stop awaiting more direction, lose its connection, or need to resume an earlier session after an interruption. Integrating each worker directly can leak provider-specific session IDs, state names, and recovery rules into the calling application.

Task Orchestrator gives the application a neutral boundary for those concerns: one durable job record, one stable worker handle, and a small, explicit lifecycle. The application retains control of its own storage and scheduling; adapters translate individual worker protocols at the edge.

## Architecture

```text
Job
 |
 v
Worker resolver
 |
 v
Admission contract
 |
 v
ACP Reference Worker (reference integration)
 |
 v
Addressable session / same-session continuation
 |
 v
Structured result
```

The calling application owns persistence, scheduling, authentication, and user interaction. Core contracts own the durable lifecycle and opaque worker handle; an adapter owns its provider protocol boundary.

## What it does

- Defines a strict worker contract for `start`, `continue`, `inspect`, `recover`, and `cancel`.
- Maps durable job records to a compact, provider-neutral worker-state vocabulary.
- Requires an opaque, stable worker handle across continuation, inspection, recovery, and cancellation.
- Protects terminal states (`completed`, `failed`, and `cancelled`) so the lifecycle remains unambiguous.
- Includes a durable JSON job store, detached supervisor, and public `run` entrypoint.
- Reconstructs the ACP Reference Worker from an external serialized profile; the durable job never contains command paths, environment, or credentials.
- Includes an offline conformance probe for verifying an adapter against the contract.

## Job lifecycle and supervision

```text
start --> running --> stopped / running --continue--> completed
                  \--inspect--> current state
                  \--recover--> current state
                  \--cancel--> cancelled

completed / failed / cancelled are terminal states.
```

The adapter reports the worker's canonical state and the same opaque handle throughout the job. A resumable interruption (`stopped`) is an active state that may receive a same-session continuation; it is not a terminal failure. The calling application decides when to persist the job, schedule a continuation, request recovery, or present progress to a user. This separation keeps worker-specific protocol details from becoming the application's job model.

## Install and verify

Requirements: Node.js 18 or later. The project has no production dependencies.

```sh
git clone https://github.com/morninghopeamo/task-orchestrator.git
cd task-orchestrator
node --version
npm test
npm run check
```

No `npm install` is required for the default verification because the repository has no dependencies. The included tests are offline fixtures: they do not contact external services or require credentials, and ACP tests start only a synthetic local fixture process.

## Configuration

Copy `.env.example` to `.env` only if a deployment needs a default workspace path. Keep `.env`, runtime state, credentials, and execution transcripts outside version control.

## Current scope and adapter boundary

This repository deliberately provides a narrow execution path, not a complete execution product. It does not include a user interface, bundled worker runtime, credentials, automatic worker selection, HTTP transport, scheduling, retry, fallback, or multi-worker routing.

The ACP Reference Worker remains outside `core/`; the operator supplies its explicit command, arguments, and environment in a profile file. Cloning this repository does not connect to a worker by itself.

## Worker admission contract

Task Orchestrator supports workers through explicit admission and transport contracts; it is not a universal desktop-agent wrapper or a GUI automation framework. Before an adapter can be resolved, it must explicitly declare all five capabilities:

- Reliable external control.
- Addressable session identity.
- Same-session continuation.
- Structured execution observability.
- Deterministic interruption semantics.

Workers that expose only a human-facing GUI without stable programmatic control and a session surface are outside the supported integration boundary.

## ACP Reference Worker

The ACP Reference Worker is a reference integration, not a claim that every ACP agent is supported. It uses a structured, protocol-driven ACP stdio transport; continuation reuses the same addressable session; and default tests use deterministic local fixtures. An operator supplies the command, arguments, environment, and explicit process-launch opt-in in a profile file. This repository never discovers executables, credentials, or sessions.

## Evidence boundary

The default repository evidence level is **OFFLINE + STATIC**. It verifies the contracts and deterministic fixture behavior, but it does not execute a live external provider and must not be read as live-provider validation.

## Non-goals

- GUI automation or universal desktop-agent control.
- Provider-specific scraping, undocumented hacks, or credential discovery.
- Hidden human-in-the-loop continuation.
- A universal ACP runtime or compatibility claim.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please keep additions provider-neutral and ensure the default verification remains offline.

## Security

See [SECURITY.md](SECURITY.md) for responsible disclosure guidance.

## License

This project is released under the [MIT License](LICENSE).
