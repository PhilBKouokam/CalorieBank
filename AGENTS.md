# CalorieBank Engineering Rules

## Product Priority

The primary V1 loop is: connect supported data sources -> configure goal mode and the deficit/surplus adjustment when applicable -> automatically sync intake and total-expenditure data -> calculate bank changes -> update immutable ledger -> send one meaningful morning bank update -> explain the balance. V1 also includes Planning Database flows that compare future meal/event estimates against the bank without logging intake.

Do not introduce features outside that loop without explicit approval.

Food logging is secondary in V1. Treat manual entry as fallback, correction, supplementary input, or future expansion, not the dominant product workflow.

V1 includes a Planning Database for future meals and events. Treat Planning Database entries as planning estimates only; they are not confirmed intake, not Food Tracking records, and must not directly change the bank. Connected calorie-tracking applications remain the source of truth for consumed intake.

The authoritative V1 product direction is `docs/product/v1-prd.md`. Bank-calculation behavior is governed by `docs/product/bank-calculation-spec.md`. The connection-first direction change is recorded in `docs/product/adr-001-connection-first-v1.md`. Interactive Today summary and Bank History behavior is recorded in `docs/product/adr-003-interactive-summary-and-explanation.md`. Automatic bank usage and dashboard awareness are recorded in `docs/product/adr-004-automatic-bank-usage-and-dashboard-awareness.md`. Future personalized activity opportunities are recorded in `docs/product/adr-005-personalized-activity-opportunity-notifications.md`.

## Engineering Rules

- Use TypeScript for new V1 code.
- Use the repository-pinned Node 20 runtime. Expo SDK 54 is not stable under Node 24 in this project.
- Avoid `any` unless a boundary genuinely requires it and the reason is documented.
- Validate API boundaries.
- Banking logic belongs in `packages/domain`.
- Shared API schemas belong in `packages/schemas`.
- Shared compiler and tooling config belongs in `packages/config`.
- Follow `docs/product/bank-calculation-spec.md` for all bank terminology, formulas, initialization, ledger, history, correction, and notification calculation behavior.
- Treat Today as bank-first. Available Bank is read-only, opens Bank History, and must show honest unavailable states until finalized bank inputs exist.
- Do not implement manual bank-spending, treat-withdrawal, or `Use Bank` actions. Negative completed days reduce the bank through finalized ledger transactions.
- Do not make estimated activity-opportunity calories affect the bank. Activity estimates are planning information only; connected-source expenditure and completed-day finalization remain authoritative.
- Do not use AI or hard-coded copy to invent calorie-burn numbers. Future activity estimates must be deterministic, versioned, qualified as ranges, and based on explicit user preferences or authorized history.
- Do not implement a user-entered absolute daily calorie target for V1. The daily allowance is derived from imported total daily expenditure, CalorieBank's `0.80` V1 adjustment, and the user's signed goal adjustment.
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
