# CalorieBank Mobile

Expo React Native foundation for CalorieBank V1.

## Product Direction

The mobile app should follow the repository-level V1 source of truth:

- `../../docs/product/v1-prd.md`
- `../../docs/product/bank-calculation-spec.md`
- `../../docs/product/adr-001-connection-first-v1.md`
- `../../docs/product/adr-006-provider-neutral-ingestion-architecture.md`
- `../../docs/product/adr-007-apple-healthkit-device-ingestion.md`
- `../../docs/product/adr-008-activity-context-and-customizable-today.md`
- `../../docs/product/adr-011-progressive-feature-discovery.md`
- `../../docs/product/adr-012-todays-eating-budget.md`
- `../../docs/product/adr-013-banking-goals.md`
- `../../docs/product/adr-014-progressive-familiarity.md`
- `../../docs/product/adr-015-time-aware-activity-forecasting.md`
- `../../docs/product/adr-016-authoritative-provider-selection-and-multi-provider-resolution.md`
- `../../docs/product/adr-017-multi-provider-wearable-integration-strategy.md`
- `../../docs/product/adr-018-direct-nutrition-provider-strategy-and-fatsecret-integration.md`
- `../../docs/architecture/current-state-audit.md`

V1 is connection-first and low-friction. The primary experience is not daily manual food logging. The app should help users connect supported intake and expenditure/health data sources, calculate a transparent lifetime calorie bank, and receive one meaningful morning bank update.

The mobile home experience should show Available Bank first and keep the initial surface focused on the latest finalized contribution, explanation, and required status. Optional V1 cards may be manually enabled under ADR 011 or proactively introduced after all ADR 014 gates pass. Recovery Forecast appears automatically after Available Bank and Emergency Bank are exhausted; do not make a large negative balance the primary home-screen experience.

ADR 014 requires Relevance, Familiarity, and Complementarity before proactive mobile recommendations. This does not block intentional navigation or manual card enablement.

ADR 015 defines Time-Aware Activity Forecasting as an advanced layer within Today's Forecast. It requires two independent readiness checks: CalorieBank must have sufficient reliable personal data, and the user must be familiar enough for the guidance to help. The current mobile shell must not fabricate pace checkpoints, burn-target feasibility, or familiar-activity scenarios.

Today's Eating Budget is an optional V1 guidance capability, distinct from Available Bank and Today's Forecast. Its numeric implementation is blocked by ADR 012's open provider-semantic, remaining-expenditure, and goal-mapping decisions; the current mobile shell must not fabricate it from Today So Far.

The mobile Planning Database experience is for future meal and event estimates only. Planning entries do not log consumed food and must not directly update the bank; the connected calorie-tracking app remains the source of truth for actual intake.

Banking Goals is approved for progressive V1 discovery but is not part of the current mobile shell. Do not present goal allocations as separate balances or add UI until ADR 013's protection, withdrawal-allocation, Emergency Bank order, and correction policies are approved.

Manual food entry belongs only as fallback, correction, supplementary input, or future expansion unless the PRD changes.

## Current Scope

The app includes coordinated foreground rolling-window ingestion from Apple Health, Fitbit through Google Health, and FatSecret; a provider-neutral Today read model; authoritative provider selection; Clerk-hosted beta authentication; and persistent fixed-order card visibility preferences. FatSecret imports only existing diary daily totals and never creates food entries. Available Bank remains mandatory and first. Existing implementation visibility may require a later ADR 011 migration; this documentation change does not add discovery logic. Today's Forecast and Projected Daily Burn remain V1 estimates but must not be represented as Projected Bank data. Time-aware forecasting is documentation-planned and implementation-blocked under ADR 015. Broad historical ingestion, background HealthKit delivery, exact-time scheduling, and notifications remain deferred.

## Development

From the repository root:

```bash
npm install
npm run mobile:prebuild:ios
npm run mobile:ios:device
npm run mobile:start
```

HealthKit requires the installed development client and does not run in Expo Go. Rebuild after native dependency or configuration changes; JavaScript-only changes continue through Metro.

Clerk authentication uses the hosted Account Portal and `expo-secure-store`. Set `EXPO_PUBLIC_AUTH_MODE=clerk` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` for authenticated builds. The `development` EAS profile is an internal development client; `preview` is an internal beta candidate with normal HTTPS enforcement; `production` is reserved for a future store build. Adding Clerk and Secure Store changes native configuration, so install a newly built development client before testing authentication.

The EAS `development` profile enables iOS local-network HTTP only for communication with the Mac development API. Preview and production configurations retain normal ATS HTTPS enforcement. Set `EXPO_PUBLIC_API_URL` in the local `.env` to the Mac's current LAN address, restart Metro after changing it, and use the development-only HealthKit diagnostics screen to verify the resolved URL and API reachability.

Before completing implementation tasks, run the relevant lint, typecheck, and test commands from the root package scripts.
