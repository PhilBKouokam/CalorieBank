# Independent source selection release gate

The September 8 physical failures supersede the preceding release candidate.
Distribution remains on hold until this gate and the five device journeys pass.

## Canonical truth

`ProviderSelection` keeps independent `expenditureSelected` and `intakeSelected`
intent markers. Default authority identifiers are not evidence of user intent.
The additive migration preserves existing burn selections and concrete intake
selections, but does not mark generic Apple Health access as selected intake.
It changes no accounting boundary, aggregate, finalized record or ledger value.

`deriveSourceState` in `packages/schemas/src/source-state.ts` combines explicit
intent, connection health, exact intake tracker identity and data availability.
Its states are unselected, selected-not-connected, connected-no-data,
connected-data-ready, refreshing, transient-refresh-failure, reconnect-required
and unavailable. Connection success alone is not data readiness. Revoked
credentials take precedence over previously imported data.

Apple Health intake requires a real bundle identifier and tracker name.
Instruction labels are rejected at the API boundary and cannot satisfy selection.
HealthKit discovery and refresh never write provider selection. Selecting burn
does not discover/select intake. An inactive saved tracker is retained for later
explicit use, but is not queried when direct FatSecret intake is selected.

Both onboarding and Settings send `selectionRole`. The server validates and
writes only that role; foreign-role fields from an older client snapshot are
ignored. Burn selection continues to pair expenditure and activity context.
Intake remains independent. Existing source-switch reconciliation and historical
override/locked-day rules are unchanged. Established Apple Health burn switching
still requires usable burn evidence; first-use intent can be saved before data.

## Navigation and errors

The server derives setup as burn -> intake -> goal -> preparation -> ready.
Each source step requires its own concrete choice and healthy connection.
Connected/no-data may advance to Goal. Preparation still requires the existing
bounded full-window attempt: checked-empty history can finish setup; unqueried
or failed dates cannot masquerade as empty history.

Back, Edit Setup and opening Settings do not write source selections. Preparation
renders the server's role labels, not tracker-picker labels. Editing setup pauses
automatic preparation UI work. A subsequent canonical reload decides the stage.

Onboarding notices belong to their action and step, with view/request generations
invalidating older responses. Confirmed selection success supersedes generic
selection errors. Settings serializes source operations; each has a role/provider
owner, and leaving its sheet invalidates its notice. Native diagnostic lookup
failure cannot block loading or selecting a direct source.

## Automated release command

Use Node 20.20.2 and an existing dedicated **localhost** test PostgreSQL database.
Set `TEST_DATABASE_URL` privately to that test database, then run:

```sh
npm run release:friends-family
```

The command rejects non-local hosts and database names outside
`caloriebank_test*` / `caloriebank_rc_*`. It never reads a beta URL as its target.
It generates Prisma, validates/applies migrations **to that test database only**,
runs workspace TypeScript/lint, all API tests including persistence and rendered
mobile journeys, the production API build, and `git diff --check`.

Coverage includes a 2-burn x 6-intake persisted matrix, connection/readiness
state combinations, role-write races, no-writer alternatives, actual rendered
onboarding and Settings navigation, stale failures, and impossible-label guards.
Native HealthKit and browser authorization are mocked in rendered tests; database
selection behavior is independently exercised against real local PostgreSQL.
Expo configuration/dependency checks and an EAS native archive remain release
steps. Render's normal API predeploy applies the additive migration.

## Remaining device journeys

Local verification for this change: the release command passed 48 files / 570
tests, including 13 persisted matrix tests, 132 state/invariant tests and 18
rendered component journeys. Workspace TypeScript, API/mobile lint, Prisma
generation/validation/local migration deployment and the API production build
passed. EAS preview config preserves the bundle, project, HealthKit and push
entitlements; Expo dependencies are compatible.

The actual Health Connections screen and tracker chooser were rendered with
React Native Web and synthetic data at 320px and 390px. Labels, chevrons, wrapping,
touch targets and sheet bounds were inspected without horizontal overflow.
This is not physical iOS permission, native navigation or Dynamic Type validation.

1. Apple Health burn + FatSecret intake.
2. Apple Health burn + a detected Apple Health food tracker.
3. Fitbit burn + a detected Apple Health food tracker.
4. Fitbit burn + FatSecret intake.
5. Back/Edit Setup, change a source in Settings, then return to preparation.

Each must preserve independent selections, show the correct source in preparation,
and offer a truthful retry/selection/checked-empty completion path. The compact
Goal selector and all accounting/notification/authentication behavior are unchanged.
