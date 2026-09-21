# Contributing

Keep changes small, provider-neutral, and independently testable.

Before opening a change, run:

```sh
npm test
npm run check
```

Default tests must use fixtures or injected fakes. Do not add credentials, machine-specific paths, transcripts, captured sessions, or live-service calls to the repository.

New integrations belong behind the worker contract. Do not import a concrete integration into the core modules.
