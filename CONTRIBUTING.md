# Contributing

Thanks for your interest in improving n8n Visualizer.

## Getting set up

Requires [Bun](https://bun.sh) (npm/pnpm/yarn also work).

```bash
bun install
bun run dev      # http://localhost:3000
bun run test     # run the test suite
```

## Development workflow

1. Fork the repo and create a branch off `main`.
2. Make your change. Keep it focused — one logical change per PR.
3. Add or update tests. The project favors small, well-tested units in
   `server/` and `app/composables/` — most files have a colocated `.test.ts`.
4. Run `bun run test` and make sure everything passes.
5. Open a pull request describing what changed and why.

## Code style

- TypeScript strict mode is on — keep it green.
- Match the surrounding code: minimal comments, readable names, small functions.
- Server logic lives in `server/`, UI in `app/`, shared types/utils in
  `shared/`. Keep parsing/graph logic out of components.
- New behavior needs a test. Bug fixes should include a test that fails without
  the fix.

## Reporting bugs and requesting features

Open an issue using the templates under `.github/ISSUE_TEMPLATE/`. For bugs,
include reproduction steps and, when possible, a sample workflow JSON export
(scrubbed of secrets).

## Tests

```bash
bun run test         # one-shot
bun run test:watch   # watch mode
```

CI runs the same suite on every push and pull request.

By contributing, you agree your contributions are licensed under the
[MIT License](LICENSE).
