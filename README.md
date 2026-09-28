English | [简体中文](./README.zh-CN.md)

# Task Orchestrator

**Task Orchestrator is a durable orchestration layer for delegating long-running work to externally controllable AI workers.**

The calling application can focus on judgment, task breakdown, and supervision. The worker performs the delegated work. This repository provides provider-neutral contracts and boundary helpers that make the handoff a durable job lifecycle without making the caller manage every interruption, continuation, and worker session itself.

## v0.3: durable external-agent orchestration

This release positions Task Orchestrator as **application-side infrastructure**: an embeddable layer for an application or agent that delegates long-running work to an external agent. It is not a workaround for any particular chat product, and it is not a wrapper around one worker vendor.

The public implementation remains provider-neutral and reproducible offline. A separate controlled deployment validated the same lifecycle against a real external worker implementation. That deployment is evidence for the lifecycle, not a compatibility promise for every ACP agent or product version.

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
Host application / agent
 |
 v
Task Orchestrator
 |- Durable job state: id, revision, opaque worker handle, terminal result
 |- Supervisor: start, inspect, recover, cancel, same-session continuation
 `- Human-action boundary: explicit wait / decision / continuation
 |
 v
Worker adapter (protocol boundary)
 |
 v
ACP-compatible external agent
```

The calling application owns storage deployment, scheduling, authentication, and the user experience for human decisions. Core contracts own the durable lifecycle and opaque worker handle; an adapter owns its provider protocol boundary. A late asynchronous worker result cannot overwrite the job's already-recorded terminal fact.

## What it does

- Defines a strict worker contract for `start`, `continue`, `inspect`, `recover`, and `cancel`.
- Maps durable job records to a compact, provider-neutral worker-state vocabulary.
- Requires an opaque, stable worker handle across continuation, inspection, recovery, and cancellation.
- Protects terminal states (`completed`, `failed`, and `cancelled`) so the lifecycle remains unambiguous.
- Includes a durable JSON job store, detached supervisor, and public `run` entrypoint.
- Reconstructs the ACP Reference Worker from an external serialized profile; the durable job never contains command paths, environment, or credentials.
- Includes an offline conformance probe for verifying an adapter against the contract.

## Capability and evidence matrix

Evidence labels describe what has actually been exercised; they are not interchangeable. `OFFLINE` means deterministic local fixtures only. `LIVE_PROVIDER` means a controlled real external-worker deployment. Neither label promises that every worker implementing a similarly named protocol behaves the same way.

| Capability | Public repository evidence | Controlled real-worker evidence | Scope boundary |
| --- | --- | --- | --- |
| ACP `initialize` → `session/new` → `session/prompt` | `OFFLINE` fixture | `LIVE_PROVIDER` | The reference adapter is a protocol example, not a universal ACP runtime. |
| Same-session continuation | `OFFLINE` fixture | `LIVE_PROVIDER` | The opaque handle must remain addressable. |
| Persisted worker handle and session restoration after a new supervisor process | `OFFLINE` detached-supervisor and recovery fixtures | `LIVE_PROVIDER` | Profiles, command paths, environments, and credentials stay outside the durable job. |
| Explicit cancellation | `OFFLINE` fixture | `LIVE_PROVIDER` | Cancellation is an adapter operation with a canonical terminal outcome. |
| Post-cancel barrier and same-session reuse | Not part of the public reference-worker compatibility claim | `LIVE_PROVIDER` | This is deployment evidence only; it is not assumed for another worker. |
| Durable job, detached supervision, and terminal-result authority | `OFFLINE` fixture | `LIVE_PROVIDER` | The public store is intentionally small; embedders choose their production persistence and scheduling. |
| Human-action wait / decision / continuation boundary | `OFFLINE` lifecycle state model | Not presented as a live UI demonstration | The host application must provide an explicit human decision and UI. |

## Validated real-world worker implementation

**WorkBuddy is a validated real-world worker implementation, not the product itself.** In a controlled deployment, its ACP worker path exercised initialization, session creation and prompting, same-session continuation, persisted-session restoration, cancellation, a post-cancel barrier before reuse, and durable supervisor/job handling. A real delegated workload reached its authoritative completion gate after continuation.

The deployment-specific adapter, paths, credentials, runtime traces, workloads, and operating details are intentionally not published here. This repository therefore does not claim that cloning it connects to WorkBuddy, that every WorkBuddy installation is compatible, or that any other ACP agent has been validated.

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

This repository deliberately provides a narrow execution path, not a complete execution product. It does not include a user interface, bundled worker runtime, credentials, automatic worker selection, HTTP transport, production scheduler, retry policy, fallback, or multi-worker routing.

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
- A bundled or hidden human-in-the-loop UI; embedders must make human choices explicit.
- A universal ACP runtime or compatibility claim.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please keep additions provider-neutral and ensure the default verification remains offline.

## Security

See [SECURITY.md](SECURITY.md) for responsible disclosure guidance.

## License

This project is released under the [MIT License](LICENSE).
