English | [简体中文](./README.zh-CN.md)

# Task Orchestrator

Task Orchestrator is a small, provider-neutral foundation for applications that coordinate durable coding jobs executed by external workers.

## What it provides

- A strict worker contract for starting, continuing, inspecting, recovering, and cancelling work.
- Stable opaque worker handles across continuation.
- A compact state vocabulary with terminal-state protection.
- Helpers for mapping durable job records onto the neutral worker contract.
- An adapter resolver that keeps concrete integrations outside the core.

The calling application owns persistence, scheduling, authentication, user interaction, and the choice of worker implementation. Worker adapters own their protocol details and translate them to the contract in this repository.

```text
Calling application
        |
        v
 Durable job state <----> Worker contract <----> External worker adapter
```

## Install and verify

Requirements: Node.js 18 or later. The project has no production dependencies.

```sh
npm test
npm run check
```

The included tests are offline fixtures. They do not contact external services, start worker processes, or require credentials.

## Configuration

Copy `.env.example` to `.env` only if a deployment needs a default workspace path. Keep `.env`, runtime state, credentials, and execution transcripts outside version control.

## Scope

This repository deliberately provides contracts and boundary helpers, not a full execution product. It does not include a user interface, bundled worker runtime, credentials, automatic worker selection, or network transport.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please keep additions provider-neutral and ensure the default verification remains offline.

## Security

See [SECURITY.md](SECURITY.md) for responsible disclosure guidance.

## License

This project is released under the [MIT License](LICENSE).
