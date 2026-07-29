# CalorieBank V1 Product Requirements

Date: 2026-07-16

## Source Of Truth

This PRD is the authoritative V1 product document. It supersedes prior food-logging-first assumptions in older audits, prototype docs, and implementation notes. Bank-calculation behavior is governed by `docs/product/bank-calculation-spec.md`. Supporting architecture guidance lives in `docs/architecture/current-state-audit.md`; focused accepted decisions are recorded in ADRs 001-014. Progressive Feature Discovery, including the distinction between V1 availability and first-use visibility, is governed by `docs/product/adr-011-progressive-feature-discovery.md`. Progressive Familiarity, including recommendation readiness, complementarity, and pacing, is governed by `docs/product/adr-014-progressive-familiarity.md`. Today's Eating Budget product boundaries and unresolved calculation requirements are governed by `docs/product/adr-012-todays-eating-budget.md`. Banking Goals, one-bank conservation, conceptual allocation methods, and implementation-blocking withdrawal policy decisions are governed by `docs/product/adr-013-banking-goals.md`.

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
- Automatic bank usage: completed-day finalization records deposits or withdrawals automatically from imported totals. V1 must not include a manual `Use Bank`, `Spend Bank`, or Planned Treat withdrawal action.
- Bank-first hierarchy: the default interface should show the all-time Available Bank first, keep the screen visually simple, and reveal history or calculation detail only when requested. Fitbit is a reference for information hierarchy and progressive disclosure only; CalorieBank must not copy its branding or exact visual design.
- Progressive Feature Discovery: introduce capabilities when they are likely to provide immediate value instead of presenting the entire product during onboarding or first use. **Complexity should be earned, not imposed.** This principle reduces cognitive load; it must not create artificial lockouts, hide safety or transparency, or optimize engagement for its own sake.
- Progressive Familiarity: **Features should be introduced only when they are relevant, complementary to the user's existing workflow, and the user has demonstrated enough familiarity to comfortably adopt them.** Relevance, Familiarity, and Complementarity are separate gates for proactive recommendations. Familiarity is not account age, days since signup, session count alone, or an arbitrary timer.
- Eating guidance is not the bank: Today's Eating Budget may translate current-day expenditure, confirmed intake, and goal configuration into actionable guidance, but it must remain visually and mathematically separate from finalized Available Bank and from forecasted expenditure.
- Planning, not tracking: CalorieBank helps users plan future meals and events using estimated nutrition information and their available calorie bank. Connected calorie-tracking applications remain the source of truth for food intake.
- One authoritative bank: Banking Goals may organize finalized Available Bank calories around user-created purposes, but they must not create independent balances, duplicate calories, or a second ledger.
- Personalized opportunities, not generic tips: future activity suggestions must be tied to the user's explicit preferences, active Planned Treat, remaining gap, timing, consent, and qualified calorie-burn ranges.
- Prepare for life, not perfection: users may optionally reserve part of genuinely accumulated banked calories in an Emergency Bank for unexpected meals, celebrations, travel, or changes in plans.
- Recovery, not punishment: when users exhaust both Available Bank and optional Emergency Bank, CalorieBank should guide them toward recovery with progress, planning, and transparency rather than making a large negative balance the primary experience.

## Primary V1 Loop

1. User installs CalorieBank.
2. User connects a supported calorie-intake data source.
3. On iPhone, the user connects Apple Health for the currently implemented foreground intake and expenditure path.
4. User selects `cut`, `maintain`, or `bulk`; configures a daily deficit for cut or daily surplus for bulk; and uses a zero adjustment for maintain. Optional Emergency Bank, planning, Banking Goals, forecasting, and personalization capabilities may be enabled during setup or discovered later under ADRs 011 and 014. Banking Goals are not mandatory onboarding.
5. CalorieBank imports available data and initializes the bank from recent history when possible.
6. CalorieBank calculates daily changes and updates the lifetime bank without requiring daily interaction.
7. Every morning, the user receives one bank-update notification.
8. User can search or create Planning Database entries to estimate future meals or events against the bank.
9. User can inspect history and explanations when they want to understand or correct the balance.

## Required V1 Screens

- Onboarding: account creation/sign-in, goal mode, daily deficit or surplus configuration when applicable, timezone, and integration education. Optional capabilities may be introduced lightly only when the relevance, familiarity, and complementarity gates are satisfied without overloading required setup. Onboarding must not require users to configure every V1 feature.
- Connections: supported intake source connection, supported expenditure/health source connection, connection state, revoke/reconnect, troubleshooting.
- Bank Home: compact product header, all-time Available Bank as the dominant standalone card, latest completed contribution with provisional/locked status, concise calculation access, and data freshness or calculation status where needed. Optional supporting capabilities appear only when manually enabled, contextually necessary, or progressively introduced.
- Bank History: read-only all-time Available Bank, latest completed date, range controls for day/week/month/3 months/year/all time, minimal history list, status/correction context, and selected-day calculation breakdown.
- Goal Settings: editable goal mode and goal-adjustment configuration using the approved cut/maintain/bulk model.
- Planning Search: estimated restaurant meals, grocery products, packaged foods, homemade meals, custom meals, favorites, and saved future plans.
- Planning Detail: estimated calories, source/estimate label, whether the meal fits the Available Bank, additional calories needed when it does not fit, and approximate time to bank enough when available.
- Planned Treat Setup/Edit: one active planned food, meal, treat, or event with name, required calories, optional target date, derived progress, ready state, edit/replace, and remove actions.
- Banking Goals: progressively discovered Planning experience for organizing portions of Available Bank among user-created goals and Unassigned calories. Exact navigation and first implementation scope remain open under ADR 013.
- Morning Update Detail: yesterday's result, added/deducted calories, Available Bank, Emergency Bank coverage or allocation when relevant, Recovery Forecast state when applicable, saved-item readiness when applicable.
- History: daily changes, imported intake, imported expenditure/activity, net contribution, allocation to Available Bank and Emergency Bank, withdrawals from each balance, running lifetime balance.
- Day Detail: selected completed day, effective contribution, original contribution, correction deltas, calories burned, 80% credited, goal adjustment, calories eaten, lock date, and provisional/locked state. Available Bank and history are read-only.
- Manual Correction/Fallback: add or adjust intake/activity only where necessary.
- Notification Settings: morning update permission, timing, enable/disable.
- Privacy/Account Settings: connected data summary, data export/delete, sign out.

V1 screen and capability lists define what belongs to V1; they do not require every item to appear during onboarding or on a new user's initial Today screen. Manual discoverability, recommendation, activation, and contextual necessity are separate visibility states governed by ADR 011. ADR 014 governs whether the user is ready for a proactive recommendation; it never blocks intentional manual exploration.

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
- Today's Forecast with Projected Daily Burn, introduced only when sufficient data and relevance support an understandable estimate. It must never present a Projected Bank.
- Today's Eating Budget, progressively introduced only after its provider semantics, goal relationship, and non-overlapping expenditure method are approved. It must not change Available Bank or create ledger transactions.

## Secondary Capabilities

- Basic manual food logging as fallback only.
- Editing manually entered data.
- Selecting or naming a saved food, meal, treat, or event.
- Progress toward the saved item.
- Advanced planning search/filtering, provider ranking, and favorite-meal management.
- Basic integration troubleshooting.
- Advanced Emergency Bank settings beyond the minimum optional reserve choice.
- Banking Goals as a post-foundation V1 Planning capability that conserves one authoritative Available Bank. It remains in V1 scope but is not a first-10-user foundation requirement; production implementation is blocked until ADR 013's protection, withdrawal-allocation, Emergency Bank order, and correction policies are approved.

## Explicitly Not Required For First-10-User V1

- Building a MyFitnessPal replacement.
- Food tracking depth such as a full logging database, barcode scanning for intake logs, consumed-meal recipe builder, or AI meal recognition.
- Social feeds, friends/family sharing, group pools, advertising, brand partnerships, transactional restaurant integrations, or grocery ordering.
- CB Coin economy, advanced gamification, complex streaks, or screen-time-oriented engagement.
- Broad support for every health platform.
- Large-scale Android/iOS parity before the first experiment.
- Replacing the existing one-active-Planned-Treat implementation before Banking Goals policy and migration decisions are approved.
- Production Activity Opportunity Engine, AI-generated recommendations, wearable-personalized activity estimates, or activity-nudge push delivery before source-attributed ingestion and notification consent are stable.
- Generic notifications such as "open the app", "maintain your streak", "log your meal", "drink water", or "we miss you".

## Integration Feasibility

Do not assume MyFitnessPal or any named third-party service has an open, approved, production-ready API for CalorieBank.

### Confirmed Direction

- V1 must choose the smallest technically credible integration path that can test automatic calorie banking.
- All imported records must carry source labels and sync metadata.
- Unsupported integrations must be described as aspirations or investigation items, not capabilities.
- Apple HealthKit is the first implemented iPhone adapter. Foreground synchronization reads active energy, basal energy, dietary energy, steps, and workouts on-device for the rolling window of current day, yesterday, and the day before, then sends normalized daily aggregates independently to the API.
- HealthKit requires an Expo development build; it is not supported in Expo Go.
- HealthKit dietary energy is usable only when an authorized nutrition source or manual Health entry has written it. CalorieBank must not imply that every food tracker writes dietary energy to Apple Health.

### Paths Requiring Validation

- HealthKit history beyond the approved rolling three-day window and background HealthKit delivery.
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

Planning may compare a hypothetical meal with Remaining Today. The planned amount must not reduce Remaining Today until confirmed intake arrives from the connected source. Product copy must distinguish planned food, confirmed intake, Remaining Today, and Available Bank.

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

Planned Treat is planning awareness only:

- Planned Treat estimates how close Available Bank is to a desired food, meal, restaurant order, or experience.
- It does not log food.
- It does not confirm consumption.
- It does not deduct calories.
- It does not create bank transactions.
- It does not replace the user's calorie-tracking application.

The separation is authoritative:

- Planned Treat = awareness.
- Intake tracker = source of truth for what the user actually ate.
- Finalized daily calculation = automatic deposit or withdrawal after imported daily totals are available.

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

Reaching a Planned Treat does not automatically deduct calories from the bank. Treat readiness and bank usage are separate concepts. The user still records actual consumption in their normal calorie tracker. CalorieBank later receives total intake and automatically reflects any daily overage during finalization.

The Planned Treat card is an available V1 supporting card that may be manually discovered or progressively introduced. It is not required on a new user's first Today screen. Empty, saving, ready, loading, and unavailable states should use friendly consumer language and must not show raw infrastructure errors.

## Banking Goals

Banking Goals is an approved, progressively discovered V1 Planning capability. It lets users organize finalized Available Bank calories around foods, meals, events, or experiences they are saving for.

The authoritative invariant is:

> CalorieBank maintains one authoritative finalized calorie balance. Banking Goals only organize portions of the Available Bank.

Conceptually:

```text
Available Bank =
  active Banking Goal allocations
  + Unassigned calories

total_active_goal_allocations + unassigned_available_calories
  = Available Bank

total_active_goal_allocations
  <= Available Bank
```

The same finalized calorie cannot fund more than one goal. Goal allocations are purpose labels on real Available Bank calories; they are not independent banks, calorie wallets, extra calories, projected balances, or a second authoritative ledger.

Emergency Bank remains separate and protected. Normal Banking Goals cannot silently allocate, consume, or present Emergency Bank calories as ordinary goal funding.

A Banking Goal may conceptually include a name, optional target calories, allocated calories, optional date or note, priority, allocation method, status, and optional Planning Database or Planned Treat reference. Potential states such as active, partially funded, ready, used, completed, paused, cancelled, and archived are conceptual and do not approve a schema.

Supported conceptual allocation methods are:

- Priority: fund the highest-priority eligible goal, then route overflow to the next goal or Unassigned.
- Percentage: divide the eligible portion of future finalized deposits without exceeding `100%`.
- Manual: retain calories as Unassigned until the user allocates them.

Priority allocation is the preferred default candidate because it minimizes daily work, but it is not authoritative until its interaction with Emergency Bank, corrections, ties, and withdrawals is approved.

The supported temporary-priority use case is:

```text
Available Bank: 4,000 kcal

Crumbl:       4,000 / 10,000 kcal
Aunt's event:     0 /  2,000 kcal, Saturday

New eligible finalized deposits: 2,300 kcal

Aunt's event: 2,000 / 2,000 kcal, Ready
Crumbl:       4,300 / 10,000 kcal
```

The upcoming event receives the first `2,000 kcal`; the `300 kcal` overflow resumes progress toward the longer-term goal. This is allocation of finalized savings, not a change to the daily bank formula.

Creating, editing, pausing, reordering, cancelling, deleting, completing, or archiving a goal must not independently change Available Bank. Cancelling an unused goal conceptually releases its allocation to Unassigned; pausing stops future allocation without necessarily releasing existing allocation; increasing a target creates no calories; and reducing a target releases excess under an approved overflow policy.

A Ready goal means enough Available Bank calories are reserved. It does not mean the food was eaten, intake was recorded, or a withdrawal occurred. Actual consumption remains in the connected intake tracker.

Used or Completed status requires user confirmation or another approved attribution process; full funding alone must not mark the goal consumed.

After a relevant finalized withdrawal, CalorieBank may ask whether the usage belonged to a goal, including `Yes`, `Partially`, `No`, or `Decide later`. This is planning attribution only. It cannot create, duplicate, or edit the ledger withdrawal. Partial use may leave calories in the goal, move them to another goal, release them to Unassigned, or follow an approved overflow preference; no leftover may move silently without a rule.

Because Banking Goal allocations are portions of Available Bank, a negative finalized change must preserve:

```text
active goal allocations + Unassigned = current Available Bank
```

The exact protection and withdrawal-allocation policy is not approved. Unassigned-first, associated-goal, reverse-priority, proportional, user-choice, and soft-reservation models remain candidates. This decision blocks implementation; the UI must never show goal allocations greater than Available Bank.

Banking Goals follows ADRs 011 and 014. It is not mandatory onboarding or Foundation-stage UI. It may be proactively introduced when a user has finalized savings to organize, demonstrates familiarity with Planning, and goal allocation naturally complements that workflow; explicit manual access remains available where practical. Recommendations must pass all three gates, remain optional, dismissible, non-repetitive, privacy-conscious, and appropriately paced.

ADR 013 governs detailed conservation, overflow, attribution, discovery, safety, and Open Product Decisions.

The current Planned Treat contract continues to compare one active treat with total Available Bank until a migration is approved. Product must decide whether Planned Treat becomes a Banking Goal, references one, or remains a separate awareness view before both models are active for the same user.

## Banking Concepts

- Goal mode: the user's selected goal context for a date: `cut`, `maintain`, or `bulk`.
- Daily energy adjustment: the signed calorie adjustment relative to adjusted imported expenditure for an effective date. Cut uses a negative adjustment, maintain uses zero, and bulk uses a positive adjustment.
- Adjustment source: whether the daily energy adjustment came from manual calorie selection or an estimated weekly weight-change preference.
- Goal-adjusted spending allowance: adjusted imported total expenditure plus the signed daily energy adjustment for the day.
- Imported intake: calories consumed from a supported source.
- Planning Database entry: estimated meal, food, drink, product, or event calorie information used for future planning only. It is not confirmed intake and does not directly affect the bank.
- Planned Treat: one active food, meal, treat, or event the user is saving toward. Progress is derived from Available Bank and required calories; it does not create bank transactions or confirmed intake.
- Banking Goal: a user-created purpose allocation within Available Bank. It uses finalized calories only and is not an independent balance or ledger.
- Unassigned calories: the portion of Available Bank not allocated to an active Banking Goal.
- Imported expenditure/activity: calories burned or activity energy from a supported source.
- Manual correction/fallback: user-entered data used to correct or fill a gap, visibly labeled as manual.
- Daily change: the day's contribution to the bank based on approved calculation rules and available data.
- Lifetime bank: internal cumulative non-expiring bank after initialization and confirmed ledger events. A positive value represents accumulated banked calories; a negative value represents the uncovered recovery amount after Available Bank and Emergency Bank are exhausted.
- Total Banked Calories: total genuinely accumulated calories available for allocation when no recovery amount exists.
- Available Bank: non-negative allocation intended for planned meals, foods, events, and other deliberate spending. It must never display a negative value.
- Emergency Bank: optional protected reserve allocation intended for unexpected overages and unplanned life events. It is not free calories, forgiveness, or a system-created amount.
- Recovery Forecast: primary home-screen experience when Available Bank and Emergency Bank are exhausted and an uncovered recovery amount remains.
- Today's Eating Budget: current-day, non-ledger guidance for total intake that would satisfy the configured daily goal under an approved live calculation. It may change during the day and is not Available Bank.
- Remaining Today: Today's Eating Budget minus confirmed intake so far. It is explicitly labeled current-day guidance, may be negative, and is not a bank balance.
- Today's Forecast: estimated future guidance based on projected end-of-day conditions and editable assumptions.
- Projected Daily Burn: estimated end-of-day expenditure from Today's Forecast. It is neither Today's Eating Budget nor a Projected Bank.
- Ledger transaction: immutable record explaining a balance-affecting change.

## Bank-First Information Architecture

CalorieBank V1 is an all-time calorie-bank interface powered by connected expenditure and calorie-intake data. It is not primarily a calorie-tracking interface.

- The primary number is the user's all-time Available Bank.
- The official bank includes completed days that have posted provisionally or locked, through the previous completed day. Provisional contributions affect Available Bank immediately.
- The current day is not part of the official bank.
- The current day may show clearly labeled live awareness or Projected Daily Burn estimates, but it must never look like an official bank result before finalization.
- Current-day live awareness may later show adjusted calories burned so far and calories eaten so far, with source and sync freshness, but it must remain separate from official bank calculations.
- The all-time bank is the sum of immutable initial and correction ledger transactions for provisional and locked days, after applying approved Available Bank, Emergency Bank, and Recovery Forecast behavior.
- The bank updates when the completed day is first processed after local midnight. Product language may say the bank updates at midnight, but implementation must remain reliable when posting occurs during the next sync or app session.
- A completed day is `PROVISIONAL` for the next two complete local calendar days. Provider intake or total-expenditure corrections in that window recalculate the effective contribution and append only the correction delta to the ledger.
- At the third local midnight after `logDate`, the contribution becomes `LOCKED`. Automatic provider changes cannot alter a locked contribution. Administrative reconciliation is deferred.
- Default UI should show the bank first, then use progressive disclosure for history and per-day calculation detail.
- Users can inspect history by day, week, month, 3 months, year, and all time.
- Selecting a specific finalized day reveals a short human-readable breakdown.
- Consumer UI must use plain language and must not expose raw internal identifiers, database fields, API field names, or variable names.

The initial Today experience should remain focused on:

1. Available Bank.
2. Latest Finalized Contribution.
3. Concise access to the calculation explanation.
4. Current data freshness or calculation status when needed.

Available Bank is mandatory, always visible, and always first. Today So Far, Today's Eating Budget, Planned Treat, Steps Today, Logged Workouts, Current Goal, Emergency Bank, Today's Forecast, and other optional supporting cards may be available in V1 without being initially visible. Their contextual discovery and activation follow ADR 011; proactive recommendation readiness and pacing follow ADR 014.

Banking Goals need not appear as competing bank cards on Today. When introduced, their entry point and summary must preserve Available Bank as the single primary balance and label allocated versus Unassigned calories clearly.

### Progressive Familiarity And Home Evolution

Progressive Feature Discovery asks whether a capability is relevant. Progressive Familiarity asks whether the user is ready to learn it. Proactive discovery occurs only when:

1. **Relevance:** the feature addresses a current user problem.
2. **Familiarity:** meaningful use indicates that prerequisite concepts are understood well enough to add another.
3. **Complementarity:** the feature is a natural extension of the current workflow.

If any gate is not satisfied, the recommendation waits.

Familiarity may be informed conceptually by natural revisits, successful use of prior capabilities, confidence with Planning, meaningful interaction with Today's Eating Budget or Today's Forecast, Banking Goal reorganization, and appropriate use of explanation views. These signals are not proof of understanding and do not approve an implementation model.

Account age, days since signup, session count alone, arbitrary timers, accidental taps, and passive exposure are insufficient.

Complementary workflow examples include:

```text
Today's Eating Budget -> Planning comparison
Planning -> Banking Goals
Banking Goals -> Move Allocation
Repeated priority changes -> Default Withdrawal Source
```

The examples do not approve unresolved Banking Goals operations.

When multiple features satisfy all three gates, CalorieBank should recommend the one with the highest immediate value, delay the others, and reevaluate after familiarity increases or context changes. The product should prefer depth of understanding over feature exposure and avoid introducing several new concepts in rapid succession.

Progressive Familiarity governs proactive recommendations, not permission. Available major capabilities remain manually discoverable where practical. Users who intentionally explore must not be blocked, and contextually required Recovery Forecast, source failures, corrections, calculation errors, safety information, and transparency must never wait for familiarity.

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
- Emergency Bank is separate from Available Bank and excluded from ordinary planned spending.
- Planned Treat progress must use Available Bank only. It must not include Emergency Bank calories.
- Emergency Bank is not automatically shown on Today. Users may choose whether its card is visible.
- A hidden Emergency Bank remains accessible through an intentional route such as Settings or a future Today menu. Hiding the card does not change its balance, contribution rule, or protection behavior.
- Emergency Bank detail should eventually show protected balance, contribution rule, visibility setting, and an explanation that it is excluded from normal planned spending.
- The product must avoid language that encourages casual use of the reserve.
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
- Recovery Forecast is contextually activated when needed. It must not depend on prior discovery, recommendation acceptance, or an enablement step.
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

The current backend persists provisional/locked daily reports, immutable calculation versions, and append-only ledger transactions for read-only Bank History.

- Initial provisional posting snapshots calories burned, 80% credited expenditure, goal mode, goal adjustment, calories eaten, daily allowance, contribution, timezone, provider provenance, sync-session provenance, and posting time.
- Initial posting writes one `daily_finalization` ledger transaction immediately in the same database transaction.
- Each contribution-changing recalculation creates an immutable calculation version and one `adjustment` transaction equal to `new contribution - current effective contribution`.
- The report retains original and effective contributions, status, lock time, correction count, and current version. Previous versions and ledger transactions are never edited.
- Unique user/date, snapshot-version, snapshot-fingerprint, ledger-snapshot, and ledger-idempotency constraints prevent duplicate posting and correction writes.
- PostgreSQL transaction advisory locks serialize work for the same user and local date.
- Rounding policy: adjusted expenditure is rounded deterministically to the nearest integer calorie after multiplying imported total daily expenditure by the expenditure adjustment rate.
- Development seed/posting exists only for local testing. Provider aggregate ingestion now invokes the same idempotent provisional posting and reconciliation service for completed dates.
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
- Bank usage is automatic. There is no manual `Use Bank`, `Spend Bank`, or treat-withdrawal action in V1.
- If `daily_bank_change` is positive, provisional posting creates a positive immutable ledger transaction.
- If `daily_bank_change` is negative, provisional posting creates a negative immutable ledger transaction that immediately reduces Available Bank under the approved Available Bank, Emergency Bank, and Recovery Forecast order.
- A positive finalized contribution may become eligible for Banking Goal allocation only after the Emergency Bank and Banking Goal allocation order is approved. Goal allocation does not change the contribution or Available Bank total.
- A negative finalized contribution is never a Banking Goal deposit. Banking Goal allocations must reconcile to the reduced Available Bank under the future ADR 013 withdrawal policy.
- A correction never edits that transaction. It appends a positive or negative delta transaction so the ledger sum equals the newest effective contribution.
- The user's timezone controls daily boundaries, history, goal-adjustment snapshots, and notification scheduling.
- Imported intake or total-expenditure data arriving during the two-day provisional window triggers automatic recalculation through adjustment transactions, not silent mutation. Steps and workout calories are never reconciliation inputs.
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

## Current-Day Live Awareness

CalorieBank shows current-day expenditure and intake together in one `Today so far` card when Apple Health returns matching data. This supports CalorieBank's role as the banking center that connects expenditure and intake in one place while still leaving decisions to the user.

The implemented flow exposes this through a provider-neutral read model at `GET /v1/me/today`. The iOS device queries HealthKit, maps results through focused expenditure, intake, step, and workout adapters, and sends validated normalized aggregates to provider-neutral ingestion commands. The API calculates adjusted expenditure and persists cumulative current-day aggregates and normalized workout summaries. Development adapters are limited to tests or explicit local fallback.

Concept:

```text
Today so far

Burned
1,600 kcal
2,000 from Apple Health x 80%

Eaten
1,500 kcal
Imported from Apple Health

Last synced 8 minutes ago
```

Rules:

- Current-day values may update throughout the day.
- Current-day values are incomplete until the day ends.
- The large burned value is adjusted current-day expenditure:

```text
adjusted_current_day_expenditure =
  imported_total_daily_expenditure_so_far * 0.80
```

- For Apple Health, raw total expenditure is active energy plus basal energy. The sum is adjusted once; workout or Move energy is not added separately.
- Raw imported device expenditure remains visible only as brief supporting context, such as `2,000 from Apple Health x 80%`.
- Use the connected expenditure source name dynamically when available.
- Do not double-count active calories. If the source exposes total daily expenditure, use that total once.
- Calories eaten uses source-attributed current-day total calorie intake.
- Use the connected intake source name dynamically when available.
- Current-day values must not be added to Available Bank before finalization.
- Today must not show an estimated deposit, estimated withdrawal, official bank change, generic or bank-like calories remaining, recommendation to eat less, recommendation to exercise more, or forecasted midnight balance. ADR 012 permits only the explicitly labeled `Remaining Today` eating-guidance value.
- UI must not imply current expenditure is already banked, deposited, earned, or available.
- Source and sync freshness should be displayed where useful.
- If unavailable, use friendly setup or unavailable states for the missing source.
- HealthKit does not reveal whether read access was denied. Empty Apple Health queries must use conservative language such as `No data found today` or `Waiting for data`, not an unsupported `Permission denied` claim.
- Do not create food entries in CalorieBank from this card.
- Do not make CalorieBank the primary food logger.
- Do not show raw API, job, or infrastructure terminology.
- Step count is context only. It does not estimate calories or modify burned calories.
- Logged workouts are context only. Workout energy is already represented in Apple Health active energy and must not be added to raw or adjusted expenditure.
- `No workouts logged today` is an empty state, not an error or exercise prompt.

Future read model concept:

- Local date.
- Timezone.
- Adjusted expenditure calories.
- Raw imported expenditure calories.
- Expenditure adjustment rate.
- Expenditure source.
- Expenditure last synced time.
- Imported calorie intake.
- Intake source.
- Intake last synced time.
- Data freshness status.
- Current-day flag.
- Partial flag.
- Cumulative step count, source, status, and last sync time.
- Normalized current-day workouts, source, status, and last sync time.

The read model should be derived from source-attributed ingestion records and must not store a projected bank result.

Provider-specific translation belongs inside adapters. Domain and bank logic must not depend on Apple Health fields, Fitbit JSON, MyFitnessPal response structures, or switches on provider names. Future providers should be added by implementing the relevant provider interface and registering the adapter.

Apple Health synchronization runs as one coordinated rolling-window session after explicit connection, on app launch/Today focus, when the app returns to the foreground, and on manual refresh, subject to a five-minute cooldown. Manual refresh bypasses the cooldown. Current day, yesterday, and the day before are queried independently for expenditure, intake, steps, and workouts. Accepted unchanged values are skipped; changed values are uploaded per category/date through an ordered local outbox that survives offline failures. A lightweight server record stores queried, uploaded, skipped, reconciled, locked, waiting, and errored dates plus category outcomes, counts, versions, trigger, and duration without raw health samples. Completing the session invokes the existing posting/reconciliation/locking services. `GET /v1/me/today` remains read-only, and current-day aggregates never write the ledger.

Completed days without required inputs must enter an explicit `waiting_for_intake`, `waiting_for_expenditure`, `waiting_for_provider`, `waiting_for_sync`, or `waiting_for_required_inputs` state. Missing intake and expenditure are never treated as zero. Foreground sync, manual refresh, provider reconnection, and scheduler invocation are retry opportunities; orchestration coordinates the accounting engine but does not duplicate its calculations.

Each Today section owns its freshness state so a missing category does not hide usable data from another category. Current implementation marks a previously ready value stale after 30 minutes without a successful sync. This is a named, adjustable technical policy rather than a physiological or bank-calculation rule.

### Today's Eating Budget

Today's Eating Budget is a progressively discovered V1 guidance capability. It answers:

> Based on confirmed expenditure so far today, how many total calories can I eat today and still satisfy my configured daily banking goal?

It is not Available Bank, Today's Forecast, Projected Daily Burn, a Projected Bank, or a ledger result. It may change during the day as confirmed source data changes, but it never modifies Available Bank or creates a transaction before completed-day posting.

The capability must distinguish:

- Total Today's Eating Budget.
- Confirmed intake already recorded.
- Remaining Today, calculated as total budget minus confirmed intake.

Confirmed intake may make Remaining Today negative. The UI may say `220 kcal above today's current eating budget`, but it must not display a negative Available Bank, claim the final result is known, or use punishment or exercise-compensation language.

The current Apple Health path supplies cumulative active plus basal energy for the local-day query window. It does not supply an approved estimate of expenditure for the unelapsed part of the day. Future providers may expose accumulated, full-day estimated, component, or insufficient intra-day values. Therefore, only this confirmed component is currently authoritative:

```text
adjusted_expenditure_so_far =
  confirmed_provider_expenditure_so_far * 0.80
```

The product intent is:

```text
today_eating_budget =
  approved_adjusted_expected_expenditure_for_today
  adjusted for the user's configured daily banking goal
```

The exact production formula is unresolved. In particular, the repository has no approved method for remaining resting expenditure and no separate `desired_daily_bank_contribution` field; it has a signed cut/maintain/bulk `daily_energy_adjustment`. Do not implement a numeric budget until ADR 012's blocking decisions are resolved.

Projected activity belongs to Today's Forecast and must not silently increase confirmed Today's Eating Budget. If a future forecasted eating budget is shown, it must be separately labeled. Steps, workouts, active energy, resting energy, personal activity averages, and provider total expenditure must not be stacked when they overlap.

A read-only explanation should identify the `0.80` policy, confirmed expenditure, any estimated remaining expenditure, configured goal effect, confirmed intake, source freshness, and which values are confirmed versus estimated. Detailed formulas should not crowd the default card.

The feature follows ADRs 011 and 014. It is not required during onboarding or on the Foundation-stage dashboard and should remain manually discoverable where practical. Proactive introduction requires relevance, familiarity with prerequisite bank/current-day concepts, and complementarity with the user's current workflow. Exact provider semantics, goal mapping, estimation, rounding, refresh, stale-state, correction, timezone, notification, and safety policies are open in ADR 012.

### Today's Forecast And Projected Daily Burn

Today's Forecast, including Projected Daily Burn, is an approved V1 capability but is not required in onboarding or the initial Today experience. It should be proactively introduced only when sufficient complete expenditure history supports a grounded estimate and Relevance, Familiarity, and Complementarity are all satisfied. Users may still find and enable the capability manually where practical.

Projected Daily Burn may help answer:

- What is my likely total expenditure by the end of today?
- How might expected steps or a familiar activity affect that estimate?
- How does today compare with my normal pattern?

It is an estimate of expenditure, not a bank result. It must not display or imply a Projected Bank, estimated deposit, estimated withdrawal, generic calories remaining, or guaranteed physiological burn. A separately labeled forecasted eating budget remains an open ADR 012 decision. The official bank continues to change only through completed-day provisional posting and reconciliation.

Users should edit forecast assumptions rather than type an arbitrary projected-burn value. Conceptual assumptions may include expected final step count, duration of a familiar activity, whether a recurring activity is expected today, or planned walking, running, cycling, or another supported activity. Exact controls, supported activities, eligibility thresholds, and estimation methods remain open.

When sufficient reliable history exists, the forecast may use approximate personal activity averages. Product copy must distinguish raw provider-reported expenditure from CalorieBank-adjusted expenditure. Whether an average displays raw values, adjusted values, or both is unresolved and must be decided before implementation.

## Today And Bank History Interaction

Today uses a bank-first hierarchy.

- Available Bank is the visually dominant first element and opens Bank History.
- Available Bank is mandatory, always visible, and cannot be hidden by dashboard customization.
- Available Bank must show `Not calculated`, `Waiting for data`, `Pending`, `Incomplete`, or another honest status until finalized ledger inputs exist.
- Available Bank must not be manually editable and must not display fabricated `0 kcal` values as though they were calculated.
- Supporting copy should be compact, such as `Through yesterday` or `Updated this morning`.
- Planned Treat shows empty, saving, ready, loading, or unavailable state and opens Planned Treat setup/edit.
- Planned Treat progress must use the same real all-time Available Bank source as Bank Summary. It must not cache a separate bank balance or create fake ledger transactions.
- Today so far should appear only after real current-day expenditure and intake data exist or an honest setup/unavailable state exists. It must not use mock values and must not imply an official current-day bank change.
- Today's Eating Budget must appear only after its calculation policy and required data are reliable. It must clearly label total budget, confirmed intake, and Remaining Today; it must not look like Available Bank or a forecast.
- Today shows the previous-day or latest completed contribution, its `Provisional` or `Locked` status, lock date when provisional, and `Adjusted from` context after a correction. It does not expose raw reconciliation identifiers.
- Today's Forecast must not appear in the initial experience by default or compete with Available Bank. Once progressively introduced, Projected Daily Burn must be clearly labeled as an estimate and remain distinct from any projected bank change, which is prohibited.
- Infrastructure diagnostics such as API health, service names, or backend connectivity details are not consumer home-screen content.
- Today must not contain long explanatory paragraphs, raw formula blocks, or internal variable names.
- Goal Mode, Daily Deficit, Daily Surplus, or Maintenance opens Goal Settings.
- Maintain displays a zero adjustment and explains that no deficit or surplus is applied; it must not show an editable calorie target.
- Calculated bank data is read-only. User preferences such as goal mode, daily deficit, daily surplus, estimated weekly weight-change preference, and future reserve settings are editable through settings/configuration flows.
- Bank History shows the all-time Available Bank, latest completed date, range filters, effective contribution, status, correction count, and selected-day calculation detail. Day detail shows original contribution, each correction delta, effective contribution, and lock date.
- Selected-day detail must use plain language, not raw internal identifiers or variable names.
- UI states must distinguish loading, unavailable, pending, incomplete, finalized, and calculated data.
- Interactive summary cards require visible labels, current value or honest status, a navigation affordance, press feedback, accessible button semantics, descriptive accessibility labels and hints, and practical touch targets.
- Noninteractive information should not look tappable.

### Customizable Today Dashboard

Today supports account-level card-visibility toggles with a fixed order. Drag-and-drop and custom ordering remain deferred. V1 availability does not imply that every optional card is visible during first use.

Mandatory:

- Available Bank: always visible and always first.

Optional cards:

- Latest Finalized Contribution.
- Today So Far.
- Today's Eating Budget.
- Planned Treat.
- Steps Today.
- Logged Workouts.
- Current Goal.

Customization may expose available optional cards through visibility toggles such as:

```text
Show Latest contribution On
Show Today so far         On
Show Eating budget       Off
Show Planned Treat        On
Show Steps                On
Show Workouts             On
Show Current Goal         On
```

The initial defaults should preserve the Foundation-stage experience defined by ADR 011. Optional cards may become visible through manual discovery, explicit enablement, a recommendation that passes all three ADR 014 gates, or contextual necessity. Preferences persist through the account-level API and hiding a card does not disable ingestion. Available Bank is not part of the mutable preference contract. Drag-and-drop reordering, Emergency Bank presentation, and complex dashboard engines are deferred.

## Manual Fallback And Activity Entry

- Manual intake or activity entry is a fallback, correction, or supplementary tool, not the promoted daily workflow.
- Manual activity entries must be source-labeled as manual and included in explanations.
- Manual activity calories must not be presented as medically precise.
- If manual data overlaps imported data, duplicate-prevention and reconciliation rules must decide which record contributes to the bank.
- Planning Database entries are not manual intake entries. They are future-planning estimates and must remain separate from confirmed intake and manual correction/fallback records.

## Source-Attributed Ingestion

Expenditure records preserve enough provenance for automatic finalization and reconciliation:

- User ID.
- Log date.
- Source.
- External source ID.
- Total daily expenditure.
- Imported time.
- Source updated time.
- Sync batch ID.
- Timezone.
- Whether the record represents the current day.
- Deduplication identity.

Intake records preserve:

- User ID.
- Log date.
- Source.
- External source ID.
- Total daily calorie intake.
- Imported time.
- Source updated time.
- Sync batch ID.
- Timezone.
- Deduplication identity.

Prefer daily aggregate imports when that is what the provider exposes. Do not double-count active calories on top of a source's total daily expenditure. Preserve the approved `0.80` expenditure adjustment policy. Finalization consumes source-attributed daily aggregates. Late source corrections must create traceable reconciliation behavior. Integration data must remain auditable.

Provider corrections must not overwrite ledger records destructively. During the provisional window, ingestion compares corrected source-attributed daily intake and total expenditure with the newest immutable calculation version and appends the exact adjustment delta. After lock, ingestion may retain provider data for audit but cannot automatically alter the contribution.

The approved HealthKit historical scope is intentionally limited to three local calendar days. The current day is awareness-only. The two completed dates align with the provisional correction window. HealthKit remains device-only, and scheduling can retry already imported completed-day data but cannot query Apple Health from the backend.

## Notification Requirements

The primary V1 notification is the morning bank update. It should include, when available:

- Yesterday's relevant result.
- Calories added to or deducted from the bank.
- Current Available Bank.
- Emergency Bank allocation, withdrawal, or coverage when relevant.
- Recovery Forecast state when Available Bank and Emergency Bank are exhausted.
- Progress toward a saved food, meal, treat, or event.
- Banking Goal progress or Ready status when notification policy explicitly approves it.
- Whether the user has accumulated enough for the planned item.
- A clear incomplete/pending status when data is not ready.

Request notification permission only after explaining this value.

Notifications may support Progressive Feature Discovery only when Relevance, Familiarity, and Complementarity are all satisfied, the user has granted appropriate permission, pacing allows another introduction, the message provides immediate planning value, and an in-app introduction would not be more appropriate. Generic feature advertising must not compete with the morning update. Recommendation frequency, dismissal suppression, and category eligibility remain open.

Do not send frequent notifications whenever Today's Eating Budget changes. A meaningful activity-related increase, planning threshold, user-requested alert, or significant correction may be considered only after notification thresholds, frequency, consent, and safety controls are approved.

Do not notify on every Banking Goal allocation. A concise morning-update line for a newly Ready goal, an approaching user-selected date, a requested reminder, or an allocation conflict may be considered only after thresholds, consent, frequency, and fatigue controls are approved.

### Future Activity Opportunity Engine

CalorieBank should eventually include an Activity Opportunity Engine that detects useful moments when an activity suggestion may help a user make progress toward an active Planned Treat. This is future architecture, not a blocker for the first-10-user V1.

The engine should generate structured recommendation candidates and remain separate from push-notification delivery. It should evaluate:

- Active Planned Treat name, required calories, optional planned date/time, and remaining gap.
- All-time Available Bank only; Emergency Bank must be excluded.
- User timezone, quiet hours, preferred notification windows, and consent.
- Explicit activity preferences and activities the user does not want recommended.
- Preferred durations, days, and time windows.
- Recent notification history, cooldowns, and weekly frequency caps.
- Population-based or wearable-personalized calorie-burn range estimates.

Activity preferences must be explicit or learned only from behavior the user authorized CalorieBank to use. Do not infer preferred activities from sex, age, ethnicity, or stereotypes.

The engine may eventually suggest activities such as dancing, fitness gaming, walking, running, cycling, swimming, strength training, recreational sports, hiking, home workouts, group activities, solo activities, indoor activities, outdoor activities, low-impact activities, or high-intensity activities.

Numerical estimates must be qualified ranges, not promises:

```text
You're about 300 kcal from Friday's dinner goal. Based on your profile,
a 30-minute dance session may burn around 220-320 kcal.
```

Do not use language such as `will burn`, `guaranteed`, `exactly`, `earn your food`, `burn off what you ate`, `undo your meal`, `compensate for overeating`, `you failed`, or `work this off`.

The recommendation estimate is planning information only. It must not create a ledger transaction, directly change Available Bank, mark a Planned Treat consumed, or replace actual imported expenditure. If the user performs the activity, CalorieBank waits for the connected expenditure source to report the actual result and uses completed-day finalization.

The staged estimation strategy is:

1. Curated population-based activity-energy estimates from a versioned activity catalogue.
2. Wearable-personalized estimates only after sufficient consented historical activity data exists.
3. Fallback to population estimates when personal history lacks enough data confidence.

Do not scrape search results at notification time. Do not let an LLM invent calorie numbers. Deterministic, auditable services must provide all numerical estimates and delivery eligibility decisions.

The notification taxonomy remains restrained:

- Daily finalized bank update: primary V1 notification.
- Planned Treat progress milestone.
- Personalized activity opportunity: optional future category.
- Positive momentum message that combines finalized bank progress and Planned Treat progress.

## Trust And Safety Requirements

- Calculations must be transparent and inspectable.
- Data-source labels are required for imported, manual, estimated, pending, missing, and corrected data.
- Planning estimates must be visibly separated from confirmed intake and must never be used as hidden bank inputs.
- Banking Goal allocations must conserve Available Bank, remain distinct from Emergency Bank, and never present projected or duplicate calories as funded.
- Prevent double counting across sources.
- Behave conservatively when data is incomplete; do not overstate available calories.
- Provide user correction flows.
- Avoid language implying exercise perfectly cancels food.
- Avoid encouraging extreme restriction, compensatory behavior, or shame.
- Treat Today's Eating Budget as uncertain planning guidance, not permission to eat or a medical prescription. Do not imply that food must be earned through exercise.
- Future activity opportunities must support autonomy, not guilt. They must not be triggered as direct punishment after a high-intake event.
- Guard against unsafe deficit or surplus selections.
- Weight-rate conversions are planning estimates, not promises. The common `3,500 kcal per pound` conversion is an approximation affected by metabolism, body composition, adherence, water changes, measurement error, and physiological adaptation.
- CalorieBank must not promise that a selected deficit or surplus will produce an exact weekly weight change.
- The application should eventually consider minimum-intake and other safety protections before recommending or displaying an allowance.
- Users with medical or nutrition concerns should consult a qualified healthcare professional.
- Treat calorie, activity, and health data as sensitive.
- Support integration revocation, data export, and data deletion before broader beta.
- Never expose secrets to the client.
- Do not hide calculation policy, source status, missing or incomplete data, corrections, errors, safety disclaimers, estimate labels, active recovery guidance, or integration failures behind feature-discovery eligibility.
- Progressive Familiarity must not become a permission gate, gamified unlock system, or reason to withhold contextually required information.
- Behavioral feature recommendations may use only data available under approved permissions and must explain relevance using limited, visible evidence rather than claiming broad surveillance or unsupported intent.

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
- The initial experience presents the core bank without requiring configuration or comprehension of every optional V1 capability.
- Optional feature introductions can be dismissed, and required transparency remains available without discovery milestones.
- Proactive recommendations require documented relevance, familiarity, and complementarity rather than elapsed time or session count alone.
- Before numeric implementation, Today's Eating Budget provider semantics, goal mapping, remaining-expenditure method, and double-counting protections are approved and testable.
- Before Banking Goals implementation, protection semantics, finalized-withdrawal allocation, Emergency Bank ordering, correction behavior, and one-bank conservation are approved and testable.

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
- Whether users understand the core bank before optional capabilities appear.
- Whether feature introductions feel relevant and explain why they appeared.
- Whether introductions arrive after users understand prerequisite concepts and feel like the next natural workflow step.
- Whether recommendation pacing allows depth of understanding before another concept appears.
- Whether users can manually find desired V1 capabilities.
- Whether users distinguish Projected Daily Burn from a guaranteed outcome and understand that there is no Projected Bank.
- Whether progressive discovery improves trust and usefulness rather than merely increasing engagement.
- Whether users distinguish Today's Eating Budget, Remaining Today, Available Bank, Today's Forecast, and Projected Daily Burn.
- Whether total budget and confirmed intake make Remaining Today understandable and actionable.
- Whether budget changes feel trustworthy, reduce manual arithmetic, and help a real food decision without encouraging exercise-for-food compensation.
- Whether users understand that the finalized contribution is determined later.
- Whether users understand Banking Goals as allocations within one Available Bank, distinguish allocated from Unassigned calories, and can predict priority and overflow behavior.
- Whether users distinguish Ready from consumed or withdrawn and understand how finalized withdrawals affect allocations.
- Whether Banking Goals supports a meaningful plan without encouraging extreme restriction or exercise-for-food compensation.

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
- `planned_treat_created`
- `planned_treat_ready_viewed`
- `today_so_far_viewed`
- `today_customization_opened`
- `today_card_visibility_changed`
- `emergency_bank_detail_viewed`
- `activity_preferences_configured`
- `activity_opportunity_candidate_generated`
- `activity_opportunity_suppressed`
- `activity_opportunity_delivered`
- `activity_opportunity_opened`
- `activity_opportunity_dismissed`
- `recovery_forecast_viewed`
- `feature_discovery_eligible`
- `feature_discovery_recommended`
- `feature_discovery_learn_more_opened`
- `feature_discovery_dismissed`
- `feature_discovery_enabled`
- `feature_manually_discovered`
- `feature_familiarity_gate_evaluated`
- `feature_complementarity_gate_evaluated`
- `feature_recommendation_deferred`
- `today_forecast_opened`
- `projected_daily_burn_assumption_changed`
- `today_eating_budget_opened`
- `today_eating_budget_explanation_viewed`
- `today_eating_budget_discovery_dismissed`
- `banking_goals_opened`
- `banking_goal_created`
- `banking_goal_allocation_changed`
- `banking_goal_priority_changed`
- `banking_goal_ready`
- `banking_goal_cancelled`
- `banking_goal_usage_attributed`
- `banking_goals_discovery_dismissed`
- `data_delete_requested`

Analytics must not include raw food names, Banking Goal names, free-text notes, passwords, precise health payloads, or unnecessary personally identifying information.
Feature-discovery analytics must not treat opens, sessions, elapsed time, or activation alone as proof of familiarity or value. Validation must include trust, understanding, relevance, complementarity, pacing, annoyance, manual discoverability, and whether users feel important capabilities are hidden.

## Open Product Decisions

Progressive Feature Discovery decisions are governed comprehensively by ADR 011. Before automated recommendation or production forecast discovery is implemented, resolve:

- What defines sufficient familiarity with the core bank?
- What minimum data is required for Today's Forecast and personalized activity averages?
- Which approved signals make each feature eligible?
- Which V1 features are manually accessible before recommendation, and where?
- How long is a dismissed recommendation suppressed, and can recommendations be disabled permanently?
- How many recommendations may be active or introduced within the same week?
- Which introductions may use push notifications?
- How are recommendation relevance, false inferences, discovery-state persistence, resets, returning users, and imported historical data handled?
- What happens when a forecast loses sufficient data?
- Do personal activity averages display raw provider expenditure, CalorieBank-adjusted expenditure, or both?
- Which measures distinguish user value from engagement manipulation?

Progressive Familiarity decisions are governed comprehensively by ADR 014. Before proactive recommendation behavior is implemented, resolve:

- How familiarity is measured.
- Which interactions represent genuine understanding rather than accidental use.
- Whether familiarity decays after inactivity.
- How long to wait between recommendations.
- How simultaneous eligible discoveries are prioritized.
- Whether and when dismissed recommendations reappear.
- How accessibility needs affect pacing.
- Whether manual exploration signals interest, familiarity, or both.
- How returning users and imported history are handled.
- Whether familiarity is global or capability-specific.
- How recommendation state is stored and reset.

Today's Eating Budget decisions are governed comprehensively by ADR 012. Its numeric implementation is blocked until product resolves provider intra-day semantics, remaining-resting-expenditure methodology, overlap prevention, the relationship to signed goal adjustment, missing-input behavior, rounding, refresh and freshness policy, correction behavior, timezone/day-boundary behavior, forecast separation, notification eligibility, and health safeguards.

Banking Goals decisions are governed comprehensively by ADR 013. Implementation is blocked until product resolves whether allocations are soft or protected, how finalized withdrawals reduce Unassigned and goal allocations, the exact Emergency Bank ordering, and how provisional corrections reroute allocations without violating conservation. Additional decisions include first implementation scope, manual discoverability, default allocation method, percentage/manual support, target requirements, priority ties, overflow, partial use, history retention, active-goal limits, Planning Database references, rounding, notification policy, and discovery suppression.

- Is Apple Health dietary energy sufficiently available among the first 10 users' existing calorie trackers, or is a second supported intake path required?
- The rolling HealthKit operational sync window is approved as current day plus the prior two local dates. A separate seven-day onboarding initialization import remains unresolved.
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
- Is automatic Emergency Bank coverage mandatory when the feature is enabled?
- Can users disable Emergency Bank coverage while keeping the reserve?
- Where should hidden Emergency Bank be accessible: Today overflow, Settings, or both?
- What exact copy explains that Emergency Bank is excluded from Planned Treat progress?
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
- Should the current 30-minute stale threshold change after physical-device observation?
- Should dashboard visibility preferences gain local-only overrides after production authentication exists?
- When, if ever, should drag-and-drop Today card reordering be introduced?
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
- Which activity categories should appear in the first explicit preference settings?
- What profile fields are required for population-based activity estimates, and which are optional?
- Which curated activity-energy data source and model version should be approved for population estimates?
- What minimum data confidence is required before using wearable-personalized activity estimates?
- Should Planned Treat evolve from `targetDate` to a `plannedFor` date/time for timing-aware opportunities?
- What useful time window should activity opportunities use before a Planned Treat?
- What maximum activity nudges per week should be allowed?
- What quiet-hours defaults and preferred notification windows should be offered?
- What duplicate-suppression and cooldown rules apply by activity and notification category?
- What delivery-history retention period is appropriate for fatigue controls and privacy?
- What user controls are required to mute a specific activity, disable activity nudges, or disable goal-linked nudges?
