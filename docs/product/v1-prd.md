# CalorieBank V1 Product Requirements

Date: 2026-07-16

## Source Of Truth

This PRD is the authoritative V1 product document. It supersedes prior food-logging-first assumptions in older audits, prototype docs, and implementation notes. Bank-calculation behavior is governed by `docs/product/bank-calculation-spec.md`. Supporting architecture guidance lives in `docs/architecture/current-state-audit.md`; the connection-first direction change is recorded in `docs/product/adr-001-connection-first-v1.md`, the expenditure-relative goal model is recorded in `docs/product/adr-002-expenditure-relative-goal-adjustment.md`, and the interactive summary/history model is recorded in `docs/product/adr-003-interactive-summary-and-explanation.md`.

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
- Bank-first hierarchy: the default interface should show the all-time Available Bank first, keep the screen visually simple, and reveal history or calculation detail only when requested. Fitbit is a reference for information hierarchy and progressive disclosure only; CalorieBank must not copy its branding or exact visual design.
- Planning, not tracking: CalorieBank helps users plan future meals and events using estimated nutrition information and their available calorie bank. Connected calorie-tracking applications remain the source of truth for food intake.
- Prepare for life, not perfection: users may optionally reserve part of genuinely accumulated banked calories in an Emergency Bank for unexpected meals, celebrations, travel, or changes in plans.
- Recovery, not punishment: when users exhaust both Available Bank and optional Emergency Bank, CalorieBank should guide them toward recovery with progress, planning, and transparency rather than making a large negative balance the primary experience.

## Primary V1 Loop

1. User installs CalorieBank.
2. User connects a supported calorie-intake data source.
3. User connects a supported calorie-expenditure or health-data source, such as Apple Health when feasible.
4. User selects `cut`, `maintain`, or `bulk`; configures a daily deficit for cut or daily surplus for bulk; uses a zero adjustment for maintain; optionally configures Emergency Bank reserve behavior; and optionally names a food, meal, treat, or event they are saving toward.
5. CalorieBank imports available data and initializes the bank from recent history when possible.
6. CalorieBank calculates daily changes and updates the lifetime bank without requiring daily interaction.
7. Every morning, the user receives one bank-update notification.
8. User can search or create Planning Database entries to estimate future meals or events against the bank.
9. User can inspect history and explanations when they want to understand or correct the balance.

## Required V1 Screens

- Onboarding: account creation/sign-in, goal mode, daily deficit or surplus configuration when applicable, timezone, integration education, lightweight optional Emergency Bank education/configuration.
- Connections: supported intake source connection, supported expenditure/health source connection, connection state, revoke/reconnect, troubleshooting.
- Bank Home: compact product header, all-time Available Bank as the dominant standalone card, one active Planned Treat card directly beneath it when available or as an empty setup prompt, compact latest finalized result, and current goal configuration. Current-day pending rules remain part of the product model but should not be repeated as persistent home-screen copy.
- Bank History: read-only all-time Available Bank, latest finalized date, range controls for day/week/month/3 months/year/all time, minimal history visualization or list, and selected-day calculation breakdown.
- Goal Settings: editable goal mode and goal-adjustment configuration using the approved cut/maintain/bulk model.
- Planning Search: estimated restaurant meals, grocery products, packaged foods, homemade meals, custom meals, favorites, and saved future plans.
- Planning Detail: estimated calories, source/estimate label, whether the meal fits the Available Bank, additional calories needed when it does not fit, and approximate time to bank enough when available.
- Planned Treat Setup/Edit: one active planned food, meal, treat, or event with name, required calories, optional target date, derived progress, ready state, edit/replace, and remove actions.
- Morning Update Detail: yesterday's result, added/deducted calories, Available Bank, Emergency Bank coverage or allocation when relevant, Recovery Forecast state when applicable, saved-item readiness when applicable.
- History: daily changes, imported intake, imported expenditure/activity, net contribution, allocation to Available Bank and Emergency Bank, withdrawals from each balance, running lifetime balance.
- Day Detail: selected finalized day, daily bank change, calories burned, 80% credited, goal adjustment, calories eaten, final banked amount, duplicate/reconciliation status, and confirmed/pending/estimated state. Available Bank and finalized history are read-only.
- Manual Correction/Fallback: add or adjust intake/activity only where necessary.
- Notification Settings: morning update permission, timing, enable/disable.
- Privacy/Account Settings: connected data summary, data export/delete, sign out.

## Must-Have First-10-User Capabilities

- User onboarding.
- Goal mode and expenditure-relative adjustment configuration.
- Connection flow for at least one genuinely feasible intake-data source.
- Connection flow for at least one genuinely feasible expenditure or health-data source.
- Secure authorization and connection-state handling.
- Data synchronization.
- Handling for delayed, missing, incomplete, duplicated, and revoked data.
- Automatic bank calculation.
- Current Available Bank display, floored at zero.
- Optional Emergency Bank reserve model for users who choose to protect part of future positive deposits.
- Recovery Forecast when Available Bank and optional Emergency Bank are exhausted.
- Planning Database for future meal and event estimates.
- User-created planning entries for custom meals, local restaurants, homemade meals, personal treats, and favorites.
- One active Planned Treat that gives the all-time Available Bank a concrete purpose.
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
- Advanced planning search/filtering, provider ranking, and favorite-meal management.
- Basic integration troubleshooting.
- Advanced Emergency Bank settings beyond the minimum optional reserve choice.

## Explicitly Not Required For First-10-User V1

- Building a MyFitnessPal replacement.
- Food tracking depth such as a full logging database, barcode scanning for intake logs, consumed-meal recipe builder, or AI meal recognition.
- Social feeds, friends/family sharing, group pools, advertising, brand partnerships, transactional restaurant integrations, or grocery ordering.
- CB Coin economy, advanced gamification, complex streaks, or screen-time-oriented engagement.
- Broad support for every health platform.
- Large-scale Android/iOS parity before the first experiment.
- Multiple simultaneous treat goals.
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

## Planning Versus Tracking

V1 contains two separate food concepts.

### Food Tracking

Food Tracking is performed by the user's connected calorie-tracking application through approved supported integrations. CalorieBank should not ask users to log the same meal twice.

Food Tracking remains the authoritative source for:

- Daily calorie intake.
- Historical intake.
- Bank calculations.
- Daily synchronization.

Only confirmed intake synchronized from the connected calorie-tracking application, or an approved manual correction/fallback when technically necessary, changes the user's bank.

### Planning Database

The Planning Database is a separate V1 product capability used exclusively for planning future meals and events. It helps users estimate calorie costs before deciding what they want to spend their bank on.

The Planning Database may support:

- Restaurant meals.
- Fast-food items.
- Grocery products.
- Packaged snacks.
- Desserts.
- Drinks.
- Homemade meals.
- User-created custom meals.
- Saved favorite meals.
- Future meal planning.
- Event planning.

Planning calculations are advisory. They may answer:

- How many calories would this meal cost?
- Do I already have enough banked calories?
- If not, how many additional calories do I need to bank?
- Approximately how many days will that take based on Recovery Forecast or normal banking pace?
- Which planned meals fit inside my current Available Bank?

Planning estimates do not modify the user's bank, do not become confirmed intake, and do not replace Food Tracking. If the user later eats the meal, the meal should be logged in the connected calorie-tracking application; confirmed synchronized intake then updates the bank.

User-created planning entries may include homemade recipes, family meals, local restaurants, restaurants without published nutrition information, personal treats, custom desserts, and favorite meals. Creating a planning entry does not automatically log that food as consumed.

Planning values may come from official nutrition information, manufacturer-provided values, restaurant-published values, or user-estimated values. Estimated planning values must be clearly identified as estimates when appropriate and must not be represented as confirmed intake.

Preferred language:

- "Plan before you eat."
- "See whether your bank already covers this meal."
- "Estimated calories for planning."
- "Your connected calorie tracker records what you actually ate."

Avoid language implying that the Planning Database is the official food log, that planning entries automatically become consumed meals, or that planning estimates automatically affect the bank.

## Planned Treat

V1 supports one active Planned Treat per user. A Planned Treat gives the all-time Available Bank a concrete purpose, such as cookies and milk, ice cream, a restaurant dinner, pizza night, or a birthday meal.

A Planned Treat includes:

- Name.
- Required calories.
- Optional target date.

Progress is derived from the current all-time Available Bank and the treat's required calories:

```text
available_bank_calories = current all-time finalized Available Bank
progress_ratio = available_bank_calories / required_calories
display_progress = clamp(progress_ratio, 0, 1)
remaining_calories = max(required_calories - max(available_bank_calories, 0), 0)
```

Treat status:

- `no_plan`: no active Planned Treat exists.
- `saving`: an active Planned Treat exists and Available Bank is below the required calories.
- `ready`: Available Bank is greater than or equal to the required calories.

If Available Bank is zero or negative, progress displays as `0%` and remaining calories equals the full required amount. If Available Bank exceeds the requirement, visual progress displays as `100%` while supporting copy may still show the real saved amount, such as `1,650 / 1,500 kcal`.

Reaching a Planned Treat does not automatically deduct calories from the bank. Treat readiness and bank spending are separate concepts. Spending or withdrawal flows require a later approved milestone and must create transparent ledger/history records when implemented.

The Planned Treat card appears directly below Available Bank on Today because it answers the next user question after seeing the primary bank number: what can this bank help me enjoy? Empty, saving, ready, loading, and unavailable states should use friendly consumer language and must not show raw infrastructure errors.

## Banking Concepts

- Goal mode: the user's selected goal context for a date: `cut`, `maintain`, or `bulk`.
- Daily energy adjustment: the signed calorie adjustment relative to adjusted imported expenditure for an effective date. Cut uses a negative adjustment, maintain uses zero, and bulk uses a positive adjustment.
- Adjustment source: whether the daily energy adjustment came from manual calorie selection or an estimated weekly weight-change preference.
- Goal-adjusted spending allowance: adjusted imported total expenditure plus the signed daily energy adjustment for the day.
- Imported intake: calories consumed from a supported source.
- Planning Database entry: estimated meal, food, drink, product, or event calorie information used for future planning only. It is not confirmed intake and does not directly affect the bank.
- Planned Treat: one active food, meal, treat, or event the user is saving toward. Progress is derived from Available Bank and required calories; it does not create bank transactions or confirmed intake.
- Imported expenditure/activity: calories burned or activity energy from a supported source.
- Manual correction/fallback: user-entered data used to correct or fill a gap, visibly labeled as manual.
- Daily change: the day's contribution to the bank based on approved calculation rules and available data.
- Lifetime bank: internal cumulative non-expiring bank after initialization and confirmed ledger events. A positive value represents accumulated banked calories; a negative value represents the uncovered recovery amount after Available Bank and Emergency Bank are exhausted.
- Total Banked Calories: total genuinely accumulated calories available for allocation when no recovery amount exists.
- Available Bank: non-negative allocation intended for planned meals, foods, events, and other deliberate spending. It must never display a negative value.
- Emergency Bank: optional protected reserve allocation intended for unexpected overages and unplanned life events. It is not free calories, forgiveness, or a system-created amount.
- Recovery Forecast: primary home-screen experience when Available Bank and Emergency Bank are exhausted and an uncovered recovery amount remains.
- Ledger transaction: immutable record explaining a balance-affecting change.

## Bank-First Information Architecture

CalorieBank V1 is an all-time calorie-bank interface powered by connected expenditure and calorie-intake data. It is not primarily a calorie-tracking interface.

- The primary number is the user's all-time Available Bank.
- The official bank includes finalized days only, through the previous completed day.
- The current day is not part of the official bank.
- The current day may show a clearly labeled estimate or pending state later, but it must never look official before finalization.
- The all-time bank is the sum of immutable finalized daily bank transactions, after applying approved Available Bank, Emergency Bank, and Recovery Forecast behavior.
- The bank updates after a day is finalized according to the user's timezone. Product language may say the bank updates at midnight, but implementation must remain reliable when actual reconciliation occurs during the next sync or app session.
- Default UI should show the bank first, then use progressive disclosure for history and per-day calculation detail.
- Users can inspect history by day, week, month, 3 months, year, and all time.
- Selecting a specific finalized day reveals a short human-readable breakdown.
- Consumer UI must use plain language and must not expose raw internal identifiers, database fields, API field names, or variable names.

Selected-day breakdowns should use consumer labels such as:

- Date.
- Daily bank change.
- Calories burned.
- 80% credited.
- Cut goal, Maintenance · no adjustment, or Bulk goal.
- Calories eaten.
- Banked amount.

For maintenance, omit the goal-adjustment row when space is tight or label it `Maintenance · no adjustment`. For bulk, use language such as `Bulk goal +300 kcal`. A compact arithmetic explanation may appear after a day is selected, using plain labels such as `credited`, `cut goal`, `eaten`, and `banked`.

## Emergency Bank Rules

- Emergency Bank is optional; users may decline it, enable it later, disable future allocations, set the allocation rate to `0%`, or choose a supported positive allocation percentage.
- Emergency Bank allocation applies only to positive daily bank changes.
- Positive daily changes are split under the active reserve policy into Available Bank allocation and Emergency Bank allocation.
- Priority reserve building toward an initial Emergency Bank target may exist as an optional strategy, but it must not be the default for every user.
- The recommended default should let users begin growing Available Bank immediately unless they deliberately choose a more conservative reserve strategy.
- A fixed `5,000 kcal` reserve target is not a universal recommendation, requirement, or default.
- Emergency Bank must contain only genuinely accumulated banked calories and must not erase overages.
- Detailed allocation, spending order, history, policy-versioning, target behavior, and open decisions are governed by `docs/product/bank-calculation-spec.md`.

## Recovery Rules

- Historical bank initialization should never start the user below zero.
- After initialization, confirmed later data or corrections may exhaust Available Bank and optional Emergency Bank and create a recovery amount.
- The Available Bank must display zero instead of a negative value.
- Recovery Forecast replaces a large negative bank number as the primary home-screen focus only after Available Bank and Emergency Bank are exhausted.
- A recovery state must not block synchronization, corrections, or continued use.
- UI language should emphasize recovery, rebuilding, restoring flexibility, being back on track, estimated recovery, and progress.
- UI language should avoid debt, punishment, failure, or owing calories.
- The app should explain which days or corrections created the recovery state in history/explanation views.

## Calculation Methodology

The V1 bank-calculation formula, historical initialization, lifetime bank behavior, correction rules, calculation status, and calculation-related notification content are defined in `docs/product/bank-calculation-spec.md`.

Product and engineering must still distinguish:

- Product principle: automatically turn connected intake, total-expenditure, and goal-adjustment data into a clear bank.
- Confirmed implementation requirement: every balance change, allocation, withdrawal, reserve-policy version, and recovery amount is traceable and explainable.
- Approved V1 calculation policy: `v1-total-expenditure-80`.
- Open decisions: source feasibility, rounding, completeness criteria, cutoff timing, overlapping sources, and safety guardrails.

Do not present the 0.80 expenditure adjustment as universal physiological truth. It is an approved V1 product policy and must be named, versioned, transparent, and configurable.

Users must not enter an absolute daily calorie target for V1. The connected total-calorie-expenditure source is the operational source of truth for deriving the daily allowance. CalorieBank applies the approved `0.80` adjustment, then applies the user's signed goal adjustment:

```text
adjusted_daily_expenditure =
  imported_total_daily_expenditure * 0.80

daily_spending_allowance =
  adjusted_daily_expenditure + daily_energy_adjustment

daily_bank_change =
  daily_spending_allowance - imported_daily_calorie_intake
```

Signed adjustment behavior:

- Cut: negative adjustment, configured as a desired daily deficit such as `300`, `400`, or `500 kcal/day`.
- Maintain: zero adjustment; do not ask the user for a calorie target, deficit, or surplus.
- Bulk: positive adjustment, configured as a desired daily surplus such as `200`, `300`, `400`, or `500 kcal/day`.

If weekly weight-change options are offered, they must be described as estimates, not promises. Planning approximations may include `0.5 lb/week ~= 250 kcal/day`, `1.0 lb/week ~= 500 kcal/day`, `1.5 lb/week ~= 750 kcal/day`, and `2.0 lb/week ~= 1,000 kcal/day` for cut; bulk examples may include `0.5 lb/week ~= 250 kcal/day` and `1.0 lb/week ~= 500 kcal/day`.

Do not add active calories separately after using imported total daily expenditure. Do not combine this model with a separate fixed calorie target that already represents estimated expenditure.

### Implemented Finalized Bank Read Model

The current backend milestone persists immutable finalized daily bank records and matching ledger transactions for development and read-only Bank History.

- Finalized daily records snapshot calories burned, 80% credited expenditure, goal mode, goal adjustment, calories eaten, daily allowance, daily bank change, timezone, and finalization time.
- Each finalized record writes one `daily_finalization` ledger transaction in the same database transaction.
- The ledger transaction amount equals the finalized day's bank change.
- A unique user/date constraint prevents duplicate finalization for the same day.
- A unique user/idempotency-key constraint prevents duplicate ledger writes for the same finalization.
- Rounding policy: adjusted expenditure is rounded deterministically to the nearest integer calorie after multiplying imported total daily expenditure by the expenditure adjustment rate.
- Development seed/finalization exists only for local testing until real integrations and day-finalization jobs are implemented.
- `GET /v1/me/bank-summary` returns the all-time bank summary.
- `GET /v1/me/bank-history?range=D|W|M|3M|Y|ALL` returns filtered finalized days plus the all-time bank; range filters do not replace the official all-time bank.
- `GET /v1/me/bank-history/:logDate` returns the selected finalized day detail needed by the mobile Bank History screen.
- `GET /v1/me/planned-treat` returns the active Planned Treat with progress derived from the all-time bank, or a `no_plan` response.
- `POST /v1/me/planned-treat` creates or replaces the one active Planned Treat.
- `PATCH /v1/me/planned-treat` updates the active Planned Treat.
- `DELETE /v1/me/planned-treat` removes the active Planned Treat without changing bank history.

## Historical Bank Initialization

After a user connects supported intake and expenditure data sources, CalorieBank should attempt to initialize the bank using up to the previous 7 days of available supported data.

- Calculate what the bank would have been during that period.
- If the calculated value is positive, initialize lifetime bank with that value.
- If the calculated value is zero or negative, initialize lifetime bank at zero.
- If required historical data is missing or incomplete, initialize with zero or a clearly labeled partial/pending state, then explain why.
- Historical records must snapshot the active goal mode, daily energy adjustment, adjustment source, expenditure-credit rate, and calculation-policy version for each effective date.

This is an onboarding product-experience decision, not a physiological claim. The product intentionally avoids beginning a user's journey with a negative balance.

How historical initialization interacts with the optional Emergency Bank is not yet approved. Do not automatically split initialization into Available Bank and Emergency Bank until that decision is resolved in `docs/product/bank-calculation-spec.md`.

## Bank Update Behavior

- Daily bank calculation runs after the user's day boundary in their configured timezone and before the morning notification when data is available.
- The user's timezone controls daily boundaries, history, goal-adjustment snapshots, and notification scheduling.
- Imported data arriving late may trigger retroactive recalculation through adjustment/reconciliation transactions, not silent mutation.
- Corrections must show old value, new value, source, affected date, delta, and effect on lifetime bank.
- Historical edits, late imports, and manual corrections must create traceable reconciliation/adjustment records rather than silently mutating prior ledger transactions.
- If no intake data is available, show the day as missing or incomplete; do not assume zero intake without user-visible confirmation.
- Planning Database estimates must not be used to fill missing intake data.
- If no expenditure data is available, use the configured fallback rule only if approved; otherwise mark expenditure as missing/pending.
- If an integration disconnects, stop future syncs, preserve already imported records according to consent/deletion settings, and show connection state.
- Duplicate records must be prevented using source IDs, timestamps, import batch IDs, and reconciliation rules.
- The UI must distinguish confirmed, pending, estimated, incomplete, imported, and manually entered data.
- Users can disable morning notifications and should be able to manually refresh sync status.
- Users must be able to inspect why the balance changed from the notification or history.
- When Emergency Bank covers an overage, the UI must show how much was covered by Available Bank, how much was covered by Emergency Bank, and whether any recovery amount remains.

## Today And Bank History Interaction

Today uses a bank-first hierarchy.

- Available Bank is the visually dominant first element and opens Bank History.
- Available Bank must show `Not calculated`, `Waiting for data`, `Pending`, `Incomplete`, or another honest status until finalized ledger inputs exist.
- Available Bank must not be manually editable and must not display fabricated `0 kcal` values as though they were calculated.
- Supporting copy should be compact, such as `Through yesterday` or `Updated this morning`.
- Planned Treat appears directly below Available Bank. It shows empty, saving, ready, loading, or unavailable state and opens Planned Treat setup/edit.
- Planned Treat progress must use the same real all-time Available Bank source as Bank Summary. It must not cache a separate bank balance or create fake ledger transactions.
- Today shows compact previous-day or latest-finalized status and current goal configuration.
- Today should not persistently show current-day forecast, projected daily bank change, or midnight-pending copy. If current-day estimates are introduced later, they must be clearly labeled and should not compete with the official Available Bank.
- Infrastructure diagnostics such as API health, service names, or backend connectivity details are not consumer home-screen content.
- Today must not contain long explanatory paragraphs, raw formula blocks, or internal variable names.
- Goal Mode, Daily Deficit, Daily Surplus, or Maintenance opens Goal Settings.
- Maintain displays a zero adjustment and explains that no deficit or surplus is applied; it must not show an editable calorie target.
- Calculated bank data is read-only. User preferences such as goal mode, daily deficit, daily surplus, estimated weekly weight-change preference, and future reserve settings are editable through settings/configuration flows.
- Bank History shows the all-time Available Bank, latest finalized date, range filters, a simple history visualization or list, and selected-day calculation detail.
- Selected-day detail must use plain language, not raw internal identifiers or variable names.
- UI states must distinguish loading, unavailable, pending, incomplete, finalized, and calculated data.
- Interactive summary cards require visible labels, current value or honest status, a navigation affordance, press feedback, accessible button semantics, descriptive accessibility labels and hints, and practical touch targets.
- Noninteractive information should not look tappable.

## Manual Fallback And Activity Entry

- Manual intake or activity entry is a fallback, correction, or supplementary tool, not the promoted daily workflow.
- Manual activity entries must be source-labeled as manual and included in explanations.
- Manual activity calories must not be presented as medically precise.
- If manual data overlaps imported data, duplicate-prevention and reconciliation rules must decide which record contributes to the bank.
- Planning Database entries are not manual intake entries. They are future-planning estimates and must remain separate from confirmed intake and manual correction/fallback records.

## Notification Requirements

The primary V1 notification is the morning bank update. It should include, when available:

- Yesterday's relevant result.
- Calories added to or deducted from the bank.
- Current Available Bank.
- Emergency Bank allocation, withdrawal, or coverage when relevant.
- Recovery Forecast state when Available Bank and Emergency Bank are exhausted.
- Progress toward a saved food, meal, treat, or event.
- Whether the user has accumulated enough for the planned item.
- A clear incomplete/pending status when data is not ready.

Request notification permission only after explaining this value.

## Trust And Safety Requirements

- Calculations must be transparent and inspectable.
- Data-source labels are required for imported, manual, estimated, pending, missing, and corrected data.
- Planning estimates must be visibly separated from confirmed intake and must never be used as hidden bank inputs.
- Prevent double counting across sources.
- Behave conservatively when data is incomplete; do not overstate available calories.
- Provide user correction flows.
- Avoid language implying exercise perfectly cancels food.
- Avoid encouraging extreme restriction, compensatory behavior, or shame.
- Guard against unsafe deficit or surplus selections.
- Weight-rate conversions are planning estimates, not promises. The common `3,500 kcal per pound` conversion is an approximation affected by metabolism, body composition, adherence, water changes, measurement error, and physiological adaptation.
- CalorieBank must not promise that a selected deficit or surplus will produce an exact weekly weight change.
- The application should eventually consider minimum-intake and other safety protections before recommending or displaying an allowance.
- Users with medical or nutrition concerns should consult a qualified healthcare professional.
- Treat calorie, activity, and health data as sensitive.
- Support integration revocation, data export, and data deletion before broader beta.
- Never expose secrets to the client.

## Internal Alpha Success Criteria

- A team member can complete connection-first onboarding.
- At least one feasible intake-data path and one feasible expenditure/health-data path sync in a test or sandbox environment.
- The app can generate an automatically calculated bank from synced data.
- The morning update can be generated with confirmed, pending, or incomplete states.
- History explains balance changes with source labels.
- Planning Database entries can be searched or created without changing the bank.
- Recovery Forecast appears instead of a large negative primary balance when Available Bank and Emergency Bank are exhausted.
- Emergency Bank coverage can be explained from ledger/history data when enabled.
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
- Whether Recovery Forecast feels clear, motivating, and non-punitive.
- Whether users understand Emergency Bank as optional protected previously accumulated calories.
- Whether Emergency Bank helps users handle unexpected overages without reducing trust or encouraging unsafe restriction.
- Whether users successfully plan a food, meal, or event using the bank.
- Whether users understand that Planning Database estimates do not log food or change the bank.
- Whether the experience reduces mental friction or guilt.
- Reasons users disconnect, distrust, or abandon the product.

## Analytics Events To Measure Later

- `account_created`
- `onboarding_goal_selected`
- `goal_adjustment_configured`
- `weekly_weight_change_preference_selected`
- `integration_intro_viewed`
- `intake_connection_started`
- `intake_connection_completed`
- `expenditure_connection_started`
- `expenditure_connection_completed`
- `integration_sync_started`
- `integration_sync_completed`
- `integration_sync_failed`
- `historical_bank_initialized`
- `emergency_bank_intro_viewed`
- `emergency_bank_configured`
- `emergency_bank_allocation_recorded`
- `emergency_bank_withdrawal_recorded`
- `daily_bank_update_generated`
- `morning_notification_permission_requested`
- `morning_notification_delivered`
- `morning_notification_opened`
- `balance_explanation_viewed`
- `bank_history_opened`
- `bank_history_range_changed`
- `bank_history_day_selected`
- `goal_settings_opened`
- `goal_configuration_update_started`
- `goal_configuration_update_completed`
- `goal_configuration_update_failed`
- `manual_correction_created`
- `integration_disconnected`
- `saved_item_created`
- `saved_item_reached`
- `planning_search_performed`
- `planning_entry_viewed`
- `planning_entry_created`
- `planning_affordability_checked`
- `recovery_forecast_viewed`
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
- What minimum and maximum daily deficits and surpluses should be allowed?
- Should weekly weight-change options be part of V1 onboarding, and if so what exact copy and options should be used?
- What minimum-intake or allowance safeguards are required before broader beta?
- How should existing implementation fields or API contracts that use absolute daily target naming be migrated?
- What notification time should be the default, and should users choose it during onboarding?
- What level of data export and deletion is required before the first 10 users?
- How are Recovery Forecast estimates calculated?
- Minimum history required before Recovery Forecast becomes available.
- How Recovery Forecast reacts to delayed or corrected data.
- Whether users can manually adjust recovery goals.
- How Recovery Forecast behaves when insufficient historical data exists.
- Whether multiple recovery estimation strategies will exist in future versions.
- What Emergency Bank allocation-rate range is supported?
- What default Emergency Bank allocation rate, if any, should be recommended?
- Should Emergency Bank be suggested during onboarding or after initial use?
- Can users transfer calories manually between Available Bank and Emergency Bank?
- Can users withdraw from Emergency Bank for planned spending?
- Is automatic Emergency Bank coverage mandatory when the feature is enabled?
- Can users disable Emergency Bank coverage while keeping the reserve?
- Can Emergency Bank grow without limit?
- Is there a maximum Emergency Bank reserve target?
- What happens when allocation rate changes mid-day?
- How are fractional Emergency Bank allocations rounded?
- How are corrected historical deposits reallocated?
- How does historical initialization interact with Emergency Bank?
- Does an Emergency Bank target pause allocations or act only as a milestone?
- What happens to the balance when Emergency Bank is disabled?
- How should unusually large Emergency Bank balances be presented?
- What safeguards prevent unsafe reserve-building behavior?
- Which restaurant, grocery, packaged-food, and nutrition-data providers are supported for the Planning Database?
- How should planning search rank, filter, and label results?
- What fields are required for user-created planning entries?
- How are custom planning meals edited or deleted?
- Can users share planning entries?
- How are duplicate planning foods or meals handled?
- How do favorite meals work?
- Is offline planning supported?
- How fresh must Planning Database nutrition data be?
- Is moderation required for community-created planning entries?
- Can planning entries later be exported into supported calorie-tracking applications?
- What disclaimer language is required for estimated planning calories?
