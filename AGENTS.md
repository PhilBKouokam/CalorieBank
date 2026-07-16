# CalorieBank Engineering Rules

## Product Priority

The primary loop is: set target -> log calories -> calculate daily result -> update ledger -> explain balance.

Do not introduce features outside that loop without explicit approval.

## Engineering Rules

- Use TypeScript for new V1 code.
- Avoid `any` unless a boundary genuinely requires it and the reason is documented.
- Validate API boundaries.
- Banking logic belongs in `packages/domain`.
- Shared API schemas belong in `packages/schemas`.
- Shared compiler and tooling config belongs in `packages/config`.
- Ledger-style balance records are immutable.
- Do not store the bank exclusively as one mutable balance.
- Every balance change must be traceable.
- Add tests for calculation changes.
- Never expose secrets to the client.
- Do not install dependencies without a concrete reason.
- Run lint, type checks, and tests before completing implementation tasks.
- Keep changes scoped.
- Do not redesign unrelated screens.
- Preserve accessibility.
- Document important architectural decisions.

## AI Workflow

- Inspect relevant files before editing.
- State assumptions.
- Prefer small vertical slices.
- Report changed files and verification results.
- Never claim a command passed unless it was run successfully.
