# CalorieBank V1 Product Requirements

Date: 2026-07-16

## Source Of Truth

This PRD is the authoritative V1 product document. It supersedes prior food-logging-first assumptions in older audits, prototype docs, and implementation notes. Bank-calculation behavior is governed by `docs/product/bank-calculation-spec.md`. Supporting architecture guidance lives in `docs/architecture/current-state-audit.md`; the direction change is recorded in `docs/product/adr-001-connection-first-v1.md`.

## V1 Mission

Validate whether users can connect their existing health and calorie data, understand and trust an automatically updated calorie-bank balance, and use the morning bank update to plan enjoyable foods with less friction and guilt.

The first 10 users are not primarily testing whether CalorieBank is a good food logger. They are testing whether the automatic calorie-banking loop is easy to set up, understandable, accurate enough to trust, useful in daily life, emotionally motivating, and low friction enough to keep using.

## Core Promise

"Keep using the health and calorie-tracking tools you already use. CalorieBank automatically turns that data into a clear calorie balance that helps you plan and enjoy the foods you love while staying aligned with your goal."

Calorie trackers answer "what did I eat?" Health tools answer "how much did I burn?" CalorieBank answers "what is available in my bank, how did it get there, and am I ready for the food, meal, or event I planned?"

## Target User

The target user is a calorie-aware adult who already uses at least one calorie-intake or health-data tool and wants a lower-friction way to understand surplus or deficit over time. They may be cutting, maintaining, or bulking, but they do not want another daily logging obligation.

V1 is not for users seeking medical nutrition therapy, eating disorder treatment, pediatric nutrition guidance, or automated meal coaching.

## Product Principles

- Lowest possible friction: connected users should not need to open CalorieBank or manually enter information every day for the core experience to work.
- Connection-first onboarding: the primary setup path asks users to connect a supported calorie-intake data source and a supported expenditure or health-data source.
- Automatic banking: once data and goals are available, CalorieBank imports, interprets, calculates, and explains the bank automatically.
- One meaningful notification: the morning bank update is the primary notification. Generic engagement notifications are outside the V1 mission.
- Food logging is secondary: manual entry is fallback, correction, supplementary input, or future expansion, not the promoted workflow.
- Interpretation layer: CalorieBank should create value primarily through synchronization, calculation, history, and planning, not screen time.

## Primary V1 Loop

1. User installs CalorieBank.
2. User connects a supported calorie-intake data source.
3. User connects a supported calorie-expenditure or health-data source, such as Apple Health when feasible.
4. User selects `cut`, `maintain`, or `bulk`, confirms a calorie target, and optionally names a food, meal, treat, or event they are saving toward.
5. CalorieBank imports available data and initializes the bank from recent history when possible.
6. CalorieBank calculates daily changes and updates the lifetime bank without requiring daily interaction.
7. Every morning, the user receives one bank-update notification.
8. User can inspect history and explanations when they want to understand or correct the balance.

## Required V1 Screens

- Onboarding: account creation/sign-in, goal mode, target confirmation, timezone, integration education.
- Connections: supported intake source connection, supported expenditure/health source connection, connection state, revoke/reconnect, troubleshooting.
- Bank Home: lifetime bank, latest daily change, data freshness, pending/incomplete indicators, progress toward saved item.
- Morning Update Detail: yesterday's result, added/deducted calories, current balance, saved-item readiness when applicable.
- History: daily changes, imported intake, imported expenditure/activity, net contribution, running lifetime balance.
- Explanation Detail: source labels, calculation inputs, duplicate/reconciliation status, confirmed/pending/estimated state.
- Manual Correction/Fallback: add or adjust intake/activity only where necessary.
- Notification Settings: morning update permission, timing, enable/disable.
- Privacy/Account Settings: connected data summary, data export/delete, sign out.

## Must-Have First-10-User Capabilities

- User onboarding.
- Goal and calorie-target configuration.
- Connection flow for at least one genuinely feasible intake-data source.
- Connection flow for at least one genuinely feasible expenditure or health-data source.
- Secure authorization and connection-state handling.
- Data synchronization.
- Handling for delayed, missing, incomplete, duplicated, and revoked data.
- Automatic bank calculation.
- Current lifetime bank-balance display.
- Daily bank-update generation.
- Morning notification with contextual permission request and user settings.
- Basic history and explanation showing how balance changed.
- Manual correction or fallback entry where technically necessary.
- Privacy, consent, integration revocation, and data-deletion considerations.
- Clear language explaining what is imported and how the bank is calculated.

## Secondary Capabilities

- Basic manual food logging as fallback only.
- Editing manually entered data.
- Selecting or naming a saved food, meal, treat, or event.
- Progress toward the saved item.
- Basic integration troubleshooting.

## Explicitly Not Required For First-10-User V1

- Building a MyFitnessPal replacement.
- Large food database, barcode scanning, recipe builder, or AI meal recognition.
- Social feeds, friends/family sharing, group pools, advertising, brand partnerships, restaurant integrations, or grocery ordering.
- CB Coin economy, advanced gamification, complex streaks, or screen-time-oriented engagement.
- Broad support for every health platform.
- Large-scale Android/iOS parity before the first experiment.
- Generic notifications such as "open the app", "maintain your streak", "log your meal", "drink water", or "we miss you".

## Integration Feasibility

Do not assume MyFitnessPal or any named third-party service has an open, approved, production-ready API for CalorieBank.

### Confirmed Direction

- V1 must choose the smallest technically credible integration path that can test automatic calorie banking.
- All imported records must carry source labels and sync metadata.
- Unsupported integrations must be described as aspirations or investigation items, not capabilities.

### Candidate Paths Requiring Validation

- Apple Health/HealthKit as an aggregation layer for iPhone users.
- Android Health Connect after the first experiment if Android becomes relevant.
- Supported direct APIs where access, terms, and production permissions are confirmed.
- User-authorized import, export-file import, or sandbox/mock integration for early usability testing.
- Manual fallback when an integration is unavailable or incomplete.

## Banking Concepts

- Daily target: the user's configured calorie target for a date, snapshotted with the goal mode and rules active on that date.
- Imported intake: calories consumed from a supported source.
- Imported expenditure/activity: calories burned or activity energy from a supported source.
- Manual correction/fallback: user-entered data used to correct or fill a gap, visibly labeled as manual.
- Daily change: the day's contribution to the bank based on approved calculation rules and available data.
- Lifetime bank: cumulative available calories. Banked calories do not expire in initial beta.
- Available balance: user-visible lifetime bank after confirmed transactions, with pending or estimated changes clearly separated.
- Ledger transaction: immutable record explaining a balance-affecting change.

## Negative Balance Rules

- Historical bank initialization should never start the user below zero.
- After initialization, the lifetime bank may become negative if confirmed later data or corrections produce a negative cumulative balance.
- A negative balance must not block synchronization, corrections, or continued use.
- UI language should be neutral, such as "overdrawn by X calories", and must avoid shame or punishment.
- The app should explain which days or corrections created the negative balance.

## Calculation Methodology

The V1 bank-calculation formula, historical initialization, lifetime bank behavior, correction rules, calculation status, and calculation-related notification content are defined in `docs/product/bank-calculation-spec.md`.

Product and engineering must still distinguish:

- Product principle: automatically turn connected intake, expenditure, and target data into a clear bank.
- Confirmed implementation requirement: every balance change is traceable and explainable.
- Approved V1 calculation policy: `v1-total-expenditure-80`.
- Open decisions: source feasibility, rounding, completeness criteria, cutoff timing, overlapping sources, and safety guardrails.

Do not present the 0.80 expenditure adjustment as universal physiological truth. It is an approved V1 product policy and must be named, versioned, transparent, and configurable.

## Historical Bank Initialization

After a user connects supported intake and expenditure data sources, CalorieBank should attempt to initialize the bank using up to the previous 7 days of available supported data.

- Calculate what the bank would have been during that period.
- If the calculated value is positive, initialize lifetime bank with that value.
- If the calculated value is zero or negative, initialize lifetime bank at zero.
- If required historical data is missing or incomplete, initialize with zero or a clearly labeled partial/pending state, then explain why.

This is an onboarding product-experience decision, not a physiological claim. The product intentionally avoids beginning a user's journey with a negative balance.

## Bank Update Behavior

- Daily bank calculation runs after the user's day boundary in their configured timezone and before the morning notification when data is available.
- The user's timezone controls daily boundaries, history, target snapshots, and notification scheduling.
- Imported data arriving late may trigger retroactive recalculation through adjustment/reconciliation transactions, not silent mutation.
- Corrections must show old value, new value, source, affected date, delta, and effect on lifetime bank.
- Historical edits, late imports, and manual corrections must create traceable reconciliation/adjustment records rather than silently mutating prior ledger transactions.
- If no intake data is available, show the day as missing or incomplete; do not assume zero intake without user-visible confirmation.
- If no expenditure data is available, use the configured fallback rule only if approved; otherwise mark expenditure as missing/pending.
- If an integration disconnects, stop future syncs, preserve already imported records according to consent/deletion settings, and show connection state.
- Duplicate records must be prevented using source IDs, timestamps, import batch IDs, and reconciliation rules.
- The UI must distinguish confirmed, pending, estimated, incomplete, imported, and manually entered data.
- Users can disable morning notifications and should be able to manually refresh sync status.
- Users must be able to inspect why the balance changed from the notification or history.

## Manual Fallback And Activity Entry

- Manual intake or activity entry is a fallback, correction, or supplementary tool, not the promoted daily workflow.
- Manual activity entries must be source-labeled as manual and included in explanations.
- Manual activity calories must not be presented as medically precise.
- If manual data overlaps imported data, duplicate-prevention and reconciliation rules must decide which record contributes to the bank.

## Notification Requirements

The primary V1 notification is the morning bank update. It should include, when available:

- Yesterday's relevant result.
- Calories added to or deducted from the bank.
- Current available lifetime bank balance.
- Progress toward a saved food, meal, treat, or event.
- Whether the user has accumulated enough for the planned item.
- A clear incomplete/pending status when data is not ready.

Request notification permission only after explaining this value.

## Trust And Safety Requirements

- Calculations must be transparent and inspectable.
- Data-source labels are required for imported, manual, estimated, pending, missing, and corrected data.
- Prevent double counting across sources.
- Behave conservatively when data is incomplete; do not overstate available calories.
- Provide user correction flows.
- Avoid language implying exercise perfectly cancels food.
- Avoid encouraging extreme restriction, compensatory behavior, or shame.
- Guard against unsafe calorie targets.
- Treat calorie, activity, and health data as sensitive.
- Support integration revocation, data export, and data deletion before broader beta.
- Never expose secrets to the client.

## Internal Alpha Success Criteria

- A team member can complete connection-first onboarding.
- At least one feasible intake-data path and one feasible expenditure/health-data path sync in a test or sandbox environment.
- The app can generate an automatically calculated bank from synced data.
- The morning update can be generated with confirmed, pending, or incomplete states.
- History explains balance changes with source labels.
- Manual fallback/correction can reconcile a bad or missing record.
- Ledger balance can be recomputed from immutable transactions.
- Timezone-specific calculation and notification behavior is tested.

## 10-User Private Beta Success Criteria

- Percentage of users who complete connection-first onboarding.
- Time required to connect necessary data sources.
- Percentage who reach an automatically calculated bank.
- Synchronization success and failure rate.
- Percentage who understand where the balance came from.
- Percentage who trust the balance enough to use it for planning.
- Morning-notification delivery and usefulness.
- Number of days the bank updates without manual intervention.
- Frequency and reasons for manual corrections.
- Whether users successfully plan a food, meal, or event using the bank.
- Whether the experience reduces mental friction or guilt.
- Reasons users disconnect, distrust, or abandon the product.

## Analytics Events To Measure Later

- `account_created`
- `onboarding_goal_selected`
- `daily_target_confirmed`
- `integration_intro_viewed`
- `intake_connection_started`
- `intake_connection_completed`
- `expenditure_connection_started`
- `expenditure_connection_completed`
- `integration_sync_started`
- `integration_sync_completed`
- `integration_sync_failed`
- `historical_bank_initialized`
- `daily_bank_update_generated`
- `morning_notification_permission_requested`
- `morning_notification_delivered`
- `morning_notification_opened`
- `balance_explanation_viewed`
- `manual_correction_created`
- `integration_disconnected`
- `saved_item_created`
- `saved_item_reached`
- `data_delete_requested`

Analytics must not include raw food names, free-text notes, passwords, precise health payloads, or unnecessary personally identifying information.

## Open Product Decisions

- Which intake-data source is genuinely feasible for the first 10 users?
- Which expenditure/health-data source is genuinely feasible for the first 10 users?
- Is HealthKit sufficient as the initial aggregation layer for both intake and expenditure, or is another intake path required?
- Which exact source provides imported total daily expenditure for the approved V1 calculation?
- How should active, resting, total, and unknown expenditure classifications be stored and explained when source data contains more than one type?
- What fallback should be used when only intake or only expenditure data is available?
- How long should the system wait after midnight before marking a day's data incomplete?
- Should historical initialization use partial data if one source is missing?
- What minimum and maximum calorie targets should be allowed?
- What notification time should be the default, and should users choose it during onboarding?
- What level of data export and deletion is required before the first 10 users?
