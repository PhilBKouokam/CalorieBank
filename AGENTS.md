# CalorieBank Engineering Rules

## Product Priority

The primary V1 loop is: connect supported data sources -> configure goal and target -> automatically sync intake and expenditure data -> calculate bank changes -> update immutable ledger -> send one meaningful morning bank update -> explain the balance. V1 also includes Planning Database flows that compare future meal/event estimates against the bank without logging intake.

Do not introduce features outside that loop without explicit approval.

Food logging is secondary in V1. Treat manual entry as fallback, correction, supplementary input, or future expansion, not the dominant product workflow.

V1 includes a Planning Database for future meals and events. Treat Planning Database entries as planning estimates only; they are not confirmed intake, not Food Tracking records, and must not directly change the bank. Connected calorie-tracking applications remain the source of truth for consumed intake.

The authoritative V1 product direction is `docs/product/v1-prd.md`. Bank-calculation behavior is governed by `docs/product/bank-calculation-spec.md`. The connection-first direction change is recorded in `docs/product/adr-001-connection-first-v1.md`.

## Engineering Rules

- Use TypeScript for new V1 code.
- Avoid `any` unless a boundary genuinely requires it and the reason is documented.
- Validate API boundaries.
- Banking logic belongs in `packages/domain`.
- Shared API schemas belong in `packages/schemas`.
- Shared compiler and tooling config belongs in `packages/config`.
- Follow `docs/product/bank-calculation-spec.md` for all bank terminology, formulas, initialization, ledger, history, correction, and notification calculation behavior.
- Integration claims must be technically verified before being documented or implemented.
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
