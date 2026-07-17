# CalorieBank Mobile

Expo React Native foundation for CalorieBank V1.

## Product Direction

The mobile app should follow the repository-level V1 source of truth:

- `../../docs/product/v1-prd.md`
- `../../docs/product/bank-calculation-spec.md`
- `../../docs/product/adr-001-connection-first-v1.md`
- `../../docs/architecture/current-state-audit.md`

V1 is connection-first and low-friction. The primary experience is not daily manual food logging. The app should help users connect supported intake and expenditure/health data sources, calculate a transparent lifetime calorie bank, and receive one meaningful morning bank update.

Manual food entry belongs only as fallback, correction, supplementary input, or future expansion unless the PRD changes.

## Current Scope

This app is a mobile shell/foundation. Authentication, integration authorization, data sync, notifications, API persistence, and ledger finalization are not considered complete until implemented against the PRD and verified.

## Development

From the repository root:

```bash
npm install
npm run mobile:start
```

Before completing implementation tasks, run the relevant lint, typecheck, and test commands from the root package scripts.
