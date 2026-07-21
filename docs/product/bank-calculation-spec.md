# CalorieBank Bank Calculation Specification

Date: 2026-07-16

## Authority

This specification is the single source of truth for how CalorieBank calculates, initializes, stores, updates, explains, and presents a user's Calorie Bank.

It governs:

- Calculation terminology.
- Eligible data inputs.
- Expenditure adjustment.
- Daily contribution.
- Historical initialization.
- Lifetime balance.
- Total Banked Calories.
- Available Bank.
- Emergency Bank.
- Recovery Forecast.
- Corrections and recalculation.
- History and explanation.
- Missing or delayed data.
- Calculation status.
- Calculation-related notification content.

Other product documents may describe the broader V1 experience, but they must not define conflicting bank-calculation behavior. If another document conflicts with this specification, this specification governs bank-calculation behavior.

## Reviewed Context

This specification preserves the current V1 direction from:

- `docs/product/v1-prd.md`
- `docs/product/adr-001-connection-first-v1.md`
- `docs/product/adr-002-expenditure-relative-goal-adjustment.md`
- `docs/product/adr-003-interactive-summary-and-explanation.md`
- `docs/product/adr-004-automatic-bank-usage-and-dashboard-awareness.md`
- `docs/product/adr-005-personalized-activity-opportunity-notifications.md`
- `docs/architecture/current-state-audit.md`
- `README.md`
- `AGENTS.md`

Superseded ideas include manual-food-logging-first V1, user-entered absolute daily calorie targets, weekly-bank framing as the primary model, mutable bank balances, and generic engagement notifications.

## Design Principles

### Lowest Friction

The normal connected experience should require almost no daily work inside CalorieBank.

### Automatic By Default

Supported intake and expenditure data should synchronize automatically, and the bank should update when sufficient data is available.

### Transparent Calculations

Users must be able to understand where their balance came from.

Users may inspect finalized history and selected-day calculation inputs by opening the read-only Bank History experience from Available Bank. History and explanation views must not allow users to manually edit calculated bank values.

### Conservative Crediting

CalorieBank should avoid giving users more expenditure credit than its approved calculation policy permits.

### Trust Over Engagement

The product should prioritize understandable and trustworthy balances rather than maximizing app opens, screen time, streaks, or notifications.

### Augment Existing Tools

CalorieBank is not primarily a replacement for established food-logging or health-tracking applications. It transforms supported data from those tools into a calorie-bank balance and planning experience.

### Configuration Over Hard-Coded Constants

Approved calculation parameters must be represented as named, versioned configuration rather than unexplained numeric literals scattered throughout the codebase.

### Prepare For Life, Not Perfection

CalorieBank should assume that plans sometimes change. Unexpected family meals, celebrations, travel, social events, and ordinary human unpredictability should not automatically create a punishing product experience. Users may optionally reserve a portion of their genuinely accumulated banked calories as protection for unexpected overages.

The Emergency Bank is not artificial forgiveness and does not erase calorie intake. It is a protected allocation of calories the user previously banked.

### Recovery, Not Punishment

CalorieBank should guide users toward recovery rather than making them feel punished. When users overspend their Available Bank and optional Emergency Bank, the product should communicate what happened, show a realistic path forward, and provide confidence that recovery is achievable. The primary recovery experience should emphasize progress, planning, and transparency rather than displaying an intimidating negative balance.

## Product Model

CalorieBank is an automatic interpretation and planning layer.

Existing applications may answer:

- What did I eat?
- How much activity did my device record?

CalorieBank answers:

- How much did my bank change?
- What is my Available Bank?
- What, if anything, is protected in my optional Emergency Bank?
- Why did the balance change?
- Have I accumulated enough flexibility for a desired food, meal, or event?
- Can a planned future meal or event fit inside my current Available Bank?
- How close am I to one active Planned Treat I intentionally chose?

CalorieBank must not claim to measure a person's exact metabolism or exact physiological energy expenditure.

The Planning Database described in `docs/product/v1-prd.md` supports future meal and event planning only. Planning estimates are not confirmed intake, are not Food Tracking records, and must not directly change the bank.

The Planned Treat described in `docs/product/v1-prd.md` is a purpose layer over the bank. Planned Treat progress is derived from the all-time Available Bank and the treat's required calories. Creating, editing, reaching, or removing a Planned Treat must not create deposits, withdrawals, confirmed intake, or automatic bank-spending transactions. Actual consumption remains in the user's calorie tracker; CalorieBank reflects it later through imported daily intake and completed-day finalization.

Future Activity Opportunity Engine estimates are also planning information only. Estimated activity calories may help a user understand one possible way to make progress toward a Planned Treat, but they must not create ledger transactions, change Available Bank, mark a Planned Treat consumed, or replace imported expenditure. If a user performs an activity, the connected expenditure source remains the source of truth for the actual expenditure used in completed-day finalization.

## Required Terminology

- Goal mode: the user's selected goal context for an effective date: `cut`, `maintain`, or `bulk`.
- Daily energy adjustment: signed calorie adjustment relative to adjusted imported total expenditure. Cut uses a negative adjustment, maintain uses zero, and bulk uses a positive adjustment.
- Adjustment source: the source of the daily energy adjustment, such as `manual_calories` or `estimated_weight_rate`.
- Desired weekly weight change: optional planning preference used to estimate a daily energy adjustment. This is not a guaranteed physiological outcome.
- Adjusted daily expenditure: imported total daily expenditure after applying CalorieBank's approved V1 conservative `0.80` policy.
- Goal-adjusted spending allowance: adjusted daily expenditure plus the signed daily energy adjustment.
- Imported calorie intake: calories consumed for an effective date from a supported intake source or approved manual fallback.
- Planning Database entry: estimated meal, food, drink, grocery product, restaurant item, homemade meal, or event calorie information used for future planning only. It is not confirmed intake and does not directly affect bank calculations.
- Planned Treat: one active food, meal, treat, or event the user is saving toward. It has a name, required calories, optional target date, and progress derived from Available Bank.
- Raw imported active calories: activity-only calories reported by a source before CalorieBank adjustment. These are distinct from total expenditure and are not separately added in the approved V1 primary formula.
- Raw imported total expenditure: total daily calorie expenditure reported by a supported expenditure or health-data source for an effective date.
- Eligible active calories: active calories allowed to influence a calculation under an approved policy. In V1's primary formula, this value is recorded for provenance when available but is not separately added after applying the total-expenditure formula.
- Expenditure credit rate: named, versioned calculation parameter applied to the approved expenditure input. V1 uses `0.80`.
- Credited active calories: active-calorie credit after policy adjustment. In V1's total-expenditure formula, this value may be displayed for explanation only when source data supports it; it is not an extra additive input.
- Allowance savings: the amount left after comparing goal-adjusted spending allowance to imported intake for a day.
- Daily bank contribution: the calculated daily bank change before it is represented as a deposit, withdrawal, or zero-change ledger event.
- Bank deposit: positive balance-changing event.
- Bank withdrawal: negative balance-changing event.
- Manual correction: user-entered or support-entered correction to imported or calculated data.
- Historical initialization: onboarding calculation using up to seven prior complete calendar days.
- Lifetime bank: internal cumulative non-expiring bank after initialization and confirmed ledger events. A positive value represents accumulated banked calories; a negative value represents the uncovered recovery amount after Available Bank and Emergency Bank are exhausted.
- Total Banked Calories: total genuinely accumulated calories available for allocation when no recovery amount exists. Conceptually, `total_banked_calories = available_bank + emergency_bank`.
- Available Bank: non-negative user-visible allocation intended for planned meals, foods, events, and other deliberate spending. It is the primary spendable balance during normal banking.
- Emergency Bank: optional non-negative protected reserve allocation intended for unexpected overages and unplanned life events. It is not normally used for planned spending.
- Recovery Forecast: the primary user-facing experience when both Available Bank and Emergency Bank are exhausted and a negative cumulative amount remains. It explains the path back to a positive Available Bank without making a large negative number the main interface focus.
- Recovery amount: non-negative uncovered amount that remains after Available Bank and Emergency Bank have been applied to negative daily changes.
- Running balance: internal lifetime bank after a specific ledger event.
- Daily change: net bank contribution for one effective date.
- Weekly change: sum of daily changes in a week; not an expiring bank.
- Monthly change: sum of daily changes in a month; not an expiring bank.
- Pending day: day awaiting required data or cutoff policy.
- Complete day: day that meets the approved data requirements for calculation.
- Incomplete day: day missing required intake, expenditure, or policy inputs.
- Corrected day: day recalculated or adjusted after late data, corrected source data, or manual correction.
- Confirmed data: data that is available from source or approved manual entry and eligible for confirmed calculation.
- Estimated data: data labeled as approximate, partial, or not yet final.
- Manually entered data: user-entered fallback or correction data.
- Data-source record: source-level record with provenance, identifier, type, timestamp, and sync status.
- Calculation-policy version: immutable identifier for the calculation rules and parameters used for a ledger event.
- Reserve-policy version: immutable identifier for Emergency Bank allocation, withdrawal, target, and coverage rules used for an event.

Active calories and total daily energy expenditure are distinct. V1's primary formula uses imported total daily expenditure. Do not add active calories on top of that formula.

## Calculation Policy Configuration

Approved V1 policy:

- `calculation_policy_version`: `v1-total-expenditure-80`
- `expenditure_input`: `imported_total_daily_expenditure`
- `expenditure_credit_rate`: `0.80`
- `goal_mode`: `cut | maintain | bulk`
- `goal_adjustment_input`: `daily_energy_adjustment`
- `adjustment_source`: `manual_calories | estimated_weight_rate`
- `desired_weekly_weight_change`: optional planning value
- `intake_input`: `imported_daily_calorie_intake`

The `0.80` rate is an authoritative V1 product policy. It must be stored as a named, versioned calculation parameter so later versions can adjust it without rewriting the bank model.

Emergency Bank allocation must also be represented as named, versioned configuration rather than unexplained numeric literals. Conceptual reserve-policy fields may include:

- `emergency_bank_enabled`
- `emergency_allocation_rate`
- `emergency_target`
- `priority_reserve_building_enabled`
- `emergency_target_behavior`
- `reserve_policy_version`

These names are conceptual product requirements, not a final database schema.

User-facing language should refer to:

- "Reported daily expenditure"
- "Adjusted daily expenditure"
- "CalorieBank's conservative 80% adjustment"

Do not claim:

- "Your exact calorie burn"
- "Your true physiological expenditure"
- "Every wearable overestimates by exactly 20%"

## Authoritative V1 Bank-Calculation Model

For CalorieBank V1, the connected calorie-expenditure source's total daily calorie-expenditure value is the calculation input.

CalorieBank does not separately calculate resting expenditure and active expenditure for the primary V1 bank formula.

Users do not enter an absolute daily calorie target in V1. The connected total-expenditure source remains the operational source of truth for determining the user's daily allowance, after CalorieBank applies the approved conservative expenditure adjustment and the user's signed goal adjustment.

The approved V1 calculation is:

```text
adjusted_daily_expenditure =
  imported_total_daily_expenditure * 0.80

daily_spending_allowance =
  adjusted_daily_expenditure + daily_energy_adjustment

daily_bank_change =
  daily_spending_allowance - imported_daily_calorie_intake
```

Equivalent form:

```text
daily_bank_change =
  (imported_total_daily_expenditure * 0.80)
  + daily_energy_adjustment
  - imported_daily_calorie_intake
```

Signed adjustment behavior:

- `cut`: negative adjustment, configured as a desired daily deficit.
- `maintain`: zero adjustment. Do not ask the user for a calorie target, deficit, or surplus.
- `bulk`: positive adjustment, configured as a desired daily surplus.

Interpretation:

- A positive `daily_bank_change` is deposited into the user's lifetime bank.
- A negative `daily_bank_change` creates a negative finalized ledger transaction and automatically reduces the user's bank according to the approved Available Bank, Emergency Bank, and Recovery Forecast order.
- A zero result means the user consumed exactly the goal-adjusted spending allowance for that day.
- Banked calories do not expire.
- The lifetime bank represents the cumulative sum of confirmed deposits and withdrawals after initialization.
- Positive daily changes may be allocated between Available Bank and optional Emergency Bank under the user's active reserve policy.
- Negative daily changes are applied automatically in this conceptual order: Available Bank, then Emergency Bank, then Recovery Forecast for any remaining uncovered amount.

There is no manual `Use Bank`, `Spend Bank`, or Planned Treat withdrawal action in V1. The immutable finalized daily transaction is the withdrawal when a completed day is negative.

The 0.80 adjustment applies to the complete imported total daily expenditure value used by CalorieBank. Do not add imported active calories separately after applying this formula. Do not combine this formula with a separate fixed calorie target that already represents estimated daily expenditure. Doing either would double count expenditure.

The imported expenditure source and imported intake source are the operational V1 sources of truth. Their values remain estimates and user-generated records rather than direct measurements of exact physiology.

Planning Database estimates are not operational sources of truth for intake. If a user plans a meal in CalorieBank and later eats it, the confirmed intake must come from the connected calorie-tracking application or an approved manual correction/fallback path before it affects the bank.

### Examples

```text
Imported total expenditure: 3,000 kcal
V1 expenditure adjustment: 0.80
Adjusted daily expenditure: 2,400 kcal
Goal mode: cut
Daily energy adjustment: -500 kcal
Imported intake: 1,900 kcal
Daily bank change: 0 kcal
```

```text
Imported total expenditure: 3,000 kcal
Adjusted daily expenditure: 2,400 kcal
Goal mode: cut
Daily energy adjustment: -500 kcal
Imported intake: 1,700 kcal
Daily bank change: +200 kcal
```

```text
Imported total expenditure: 3,000 kcal
Adjusted daily expenditure: 2,400 kcal
Goal mode: cut
Daily energy adjustment: -500 kcal
Imported intake: 2,200 kcal
Daily bank change: -300 kcal
```

Given adjusted expenditure of `2,400 kcal`:

```text
Cut by 500:
daily_energy_adjustment = -500
daily_spending_allowance = 1,900 kcal

Maintain:
daily_energy_adjustment = 0
daily_spending_allowance = 2,400 kcal

Bulk by 300:
daily_energy_adjustment = +300
daily_spending_allowance = 2,700 kcal
```

If weekly weight-change options are offered, they must be labeled as estimates. The common `3,500 kcal per pound` conversion is a planning approximation; actual weight change is affected by metabolism, body composition, adherence, water changes, measurement error, and physiological adaptation.

## Data-Source Requirements

Bank inputs may come from:

- Supported calorie-intake integrations.
- Supported health-data or calorie-expenditure integrations.
- Approved manual fallback entry.
- Approved manual corrections.

Do not claim support for every application.

Planning Database entries are explicitly excluded from bank-calculation inputs. They may be used to compare estimated future calorie costs against Available Bank or estimated time-to-bank, but they must not create deposits, withdrawals, confirmed intake, or ledger transactions unless a later approved integration explicitly exports the consumed item to a supported intake source and that source syncs it back as confirmed intake.

Planned Treat progress is also excluded from bank-calculation inputs. The derived progress rules are:

```text
progress_ratio = available_bank_calories / required_calories
display_progress = clamp(progress_ratio, 0, 1)
remaining_calories = max(required_calories - max(available_bank_calories, 0), 0)
```

If the all-time Available Bank is zero or negative, the Planned Treat displays `0%` progress and the full required amount remaining. If the Available Bank exceeds the requirement, the visual progress displays `100%` while the real saved amount may remain visible in supporting copy. A ready Planned Treat does not spend from the bank. If the user later eats the planned item, the user's calorie tracker remains the source of truth for actual consumption; the next completed-day finalization automatically reflects the imported total intake.

Planned Treat progress must use `available_bank_calories` only. It must not include Emergency Bank calories.

For each data point, preserve enough provenance to identify:

- Data-source provider.
- Data-source record identifier.
- Timestamp.
- Effective date.
- Data type.
- Whether the value is imported or manual.
- Whether it is active or total expenditure.
- Synchronization status.
- Whether it has already been processed.
- Whether it replaces or corrects another record.

## Historical Bank Initialization

Approved V1 onboarding behavior:

1. After the user connects sufficient supported intake and expenditure data, CalorieBank attempts to retrieve up to the previous seven complete calendar days.
2. Each eligible historical day is calculated using the same approved V1 calculation policy, including the `0.80` expenditure credit rate.
3. If the sum of eligible historical daily contributions is positive, initialize the user's lifetime bank with that amount.
4. If the sum is zero or negative, initialize the lifetime bank at zero.
5. The user must not begin their CalorieBank journey with a negative displayed balance.
6. The history must clearly identify the amount as a historical initialization rather than pretending the user accumulated it after joining.
7. Do not selectively remove individual negative historical days merely to inflate the result. Calculate the approved historical window consistently, sum the eligible days, and then apply the zero floor to the final initialization result.
8. Avoid double counting historical records during later synchronization.

The zero floor is an onboarding and product-experience decision, not a claim that previous excess intake did not occur physiologically.

Historical calculations must snapshot the active goal mode, daily energy adjustment, adjustment source, desired weekly weight-change preference when applicable, expenditure-credit rate, and calculation-policy version for each effective date.

Completeness criteria for a historical day are not fully approved. Until resolved, a historical day should not be treated as complete unless both required daily intake and required daily total-expenditure inputs are available and source-labeled.

Fallback behavior for fewer than seven complete days is an open product decision. A conservative temporary implementation may show a pending or partial initialization state, but must not invent missing intake or expenditure as zero.

Emergency Bank allocation for historical initialization is not approved. Do not automatically split a historical initialization amount into Available Bank and Emergency Bank unless a later product decision approves that behavior.

## Lifetime Bank, Available Bank, And Emergency Bank

- Banked calories do not expire.
- There is no weekly, monthly, or 30-day expiration.
- There is no scheduled decay.
- There is no automatic periodic reset.
- The lifetime bank is the cumulative internal ledger-derived bank.
- Total Banked Calories represent accumulated calories available for allocation when no recovery amount exists.
- Available Bank and Emergency Bank are allocations of the same genuinely accumulated calories.
- When no recovery amount exists, `total_banked_calories = available_bank + emergency_bank`.
- The Available Bank is the primary displayed spendable balance for planned foods, meals, events, and other deliberate spending.
- The Available Bank must never display a negative value.
- The Emergency Bank is optional. It is a protected reserve for unexpected overages and unplanned life events, not free calories, forgiveness, or calories created by the system.
- Users may enable the Emergency Bank, decline it during onboarding, enable it later, disable future allocations, choose what percentage of new positive deposits is reserved, and change that percentage later subject to approved safeguards.
- The product should generally allow users to begin growing their Available Bank immediately. Priority reserve building is optional and should not delay the core reward loop unless the user deliberately chooses a more conservative strategy.
- Recovery Forecast activates only after Available Bank and Emergency Bank are exhausted and an uncovered recovery amount remains.
- Daily, weekly, and monthly values are timeline views or period changes, not separate expiring banks.
- The history must explain how the lifetime balance reached its current value.

Any conflicting reset or expiration concept in older prototype materials is superseded.

### Emergency Bank Deposit Allocation

Emergency Bank allocation applies only to positive daily bank changes.

If:

```text
daily_bank_change > 0
```

Then:

```text
emergency_allocation =
  daily_bank_change * emergency_allocation_rate

available_allocation =
  daily_bank_change - emergency_allocation
```

Example:

```text
Positive daily bank change: 500 kcal
Emergency allocation rate: 10%

Emergency Bank deposit: 50 kcal
Available Bank deposit: 450 kcal
```

The entire positive contribution remains part of the user's total accumulated bank. No calories are discarded or treated as a fee.

If the Emergency Bank is disabled or the allocation rate is `0%`:

```text
available_allocation = daily_bank_change
emergency_allocation = 0
```

Users may optionally choose to prioritize building an initial Emergency Bank before growing their Available Bank. This is an optional strategy, not the default for every user.

Example configuration:

```text
Initial Emergency Bank target: 5,000 kcal
Priority reserve building: Enabled
```

While the Emergency Bank remains below the selected target:

```text
100% of eligible positive deposits -> Emergency Bank
0% -> Available Bank
```

After the target is reached, the user's selected ongoing allocation rate applies.

Example:

```text
Emergency Bank target: 5,000 kcal
Current Emergency Bank: 4,700 kcal
Positive daily contribution: 500 kcal
Ongoing allocation rate after target: 10%
```

Conceptual result:

```text
300 kcal completes the target
Remaining 200 kcal is split according to the ongoing allocation policy
```

The `5,000 kcal` value is only a personal example. It is not a universal recommendation, requirement, or default.

### Emergency Bank Spending And Overage Order

Approved conceptual order for negative daily bank changes:

```text
1. Available Bank
2. Emergency Bank
3. Recovery Forecast
```

Example:

```text
Available Bank: 700 kcal
Emergency Bank: 5,500 kcal
Negative daily bank change: 1,400 kcal
```

Result:

```text
700 kcal withdrawn from Available Bank
700 kcal withdrawn from Emergency Bank

Available Bank: 0
Emergency Bank: 4,800
Recovery Forecast: not activated
```

If the overage exceeds both balances:

```text
Available Bank: 500 kcal
Emergency Bank: 1,000 kcal
Negative daily bank change: 2,100 kcal
```

Result:

```text
500 kcal covered by Available Bank
1,000 kcal covered by Emergency Bank
600 kcal becomes the recovery amount
```

Recovery Forecast is activated only for the remaining uncovered amount. The complete protection sequence is:

```text
Available Bank -> Emergency Bank -> Recovery Forecast
```

When the Emergency Bank fully covers an unexpected overage, use language equivalent to:

> Your Emergency Bank covered you.

> Life happened, and you were prepared.

> Your Available Bank is protected, and you can continue building normally.

Do not imply that calories disappeared or did not count. When the Emergency Bank partially covers an overage, explain how much was covered by Available Bank, how much was covered by Emergency Bank, and how much remains in Recovery Forecast.

Preferred Emergency Bank language includes protection, reserve, covered, prepared, flexibility, and recovery. Avoid emphasizing failure, punishment, debt, penalty, or owing calories.

### Emergency Bank Targets And Settings

An Emergency Bank target may be optional. Possible future or configurable behaviors include:

- Target-maintenance strategy: the user selects a target; once the target is reached, allocations pause; if the reserve is later used and drops below target, allocations resume until restored.
- Continuous-growth strategy: the Emergency Bank continues receiving the selected allocation percentage after the target is reached.
- No-target strategy: the user selects only an allocation percentage and allows the Emergency Bank to grow without a target.

No target behavior is authoritative until approved in a later product decision.

Users should eventually be able to manage Emergency Bank settings, including enabled/disabled state, allocation percentage, initial reserve target, priority reserve building, contribution behavior after the target is reached, whether automatic Emergency Bank coverage is enabled, and whether the Emergency Bank card is visible on Today. Exact settings screens and controls are not approved by this specification.

Emergency Bank is not automatically shown on Today. Users may choose whether its card is visible. A hidden Emergency Bank must remain accessible through an intentional menu or Settings route, and hiding the card must not change the reserve balance, contribution policy, or protection behavior.

Emergency Bank is excluded from ordinary Available Bank and Planned Treat progress.

## Recovery Forecast

When Available Bank and Emergency Bank are exhausted and a recovery amount remains, Recovery Forecast replaces a large negative bank number as the primary home-screen focus.

Its purpose is to answer:

- How long will recovery probably take?
- What does today's progress look like?
- What is the user's expected path back to a positive Available Bank?

When sufficient data exists, Recovery Forecast should include:

- Estimated recovery time.
- Estimated daily recovery target.
- Current recovery progress.
- Progress toward returning to a positive Available Bank.
- A short explanation of how the estimate was calculated.
- Messaging that encourages consistency rather than guilt.

Example:

```text
Estimated recovery: 6 days
Average daily recovery needed: 285 calories
Recovery progress: 22%
```

These values are planning estimates based on available data and current assumptions, not guarantees.

Forecast estimates should, when possible, use the user's own historical behavior. Preference should be given to patterns such as:

- Typical daily bank contributions.
- Typical weekly routine.
- Typical activity patterns.
- Consistency over recent history.

Avoid generic exercise prescriptions. Prefer language equivalent to:

> Based on your normal routine, you're likely to recover in approximately six days.

Avoid language equivalent to:

> Walk 30 minutes every day.

Recovery Forecast should reflect the user's existing habits rather than prescribing an entirely new lifestyle.

Preferred language:

- Recovery.
- Rebuilding.
- Restoring flexibility.
- Back on track.
- Estimated recovery.
- Progress.

Avoid emphasizing:

- Debt.
- Punishment.
- Failure.
- Owing calories.

The product should acknowledge that users intentionally spent calories from their bank to enjoy life. The Emergency Bank can protect unexpected overages before Recovery Forecast is needed. Recovery is simply the next phase of the banking cycle when both bank allocations are exhausted.

## Ledger-Based History

Bank changes must be explainable and auditable. The exact database schema may evolve, but each balance-changing event must preserve enough information to explain:

The current implemented finalized-bank read model uses `finalized_daily_bank_records` plus `calorie_ledger_transactions`. A finalized daily record snapshots the calculation inputs and outputs for one completed day. Its matching ledger transaction stores the immutable balance-changing amount.

Finalization rules:

- A user can have only one finalized daily bank record per `logDate`.
- Finalization and ledger creation happen in one database transaction.
- The ledger transaction amount must equal the finalized record's daily bank change.
- The ledger idempotency key is unique per user.
- Running development finalization twice for the same user and date returns the existing finalized result instead of creating another ledger transaction.
- Adjusted expenditure is rounded deterministically to the nearest integer calorie after applying the expenditure adjustment rate.
- The current development seed/finalization path is not a production ingestion endpoint.

- Effective date.
- Event type.
- Intake input.
- Raw imported total-expenditure input.
- Raw active-calorie input.
- Eligible active calories.
- Expenditure credit rate.
- Credited active calories.
- Goal mode.
- Daily energy adjustment.
- Adjustment source.
- Desired weekly weight change when applicable.
- Goal-adjusted spending allowance.
- Allowance savings.
- Daily contribution.
- Manual adjustment.
- Previous running balance.
- Resulting running balance.
- Total Banked Calories after the event when no recovery amount exists.
- Available Bank after the event.
- Emergency Bank after the event.
- Amount allocated to Available Bank.
- Amount allocated to Emergency Bank.
- Withdrawal from Available Bank.
- Withdrawal from Emergency Bank.
- Recovery amount created or changed.
- Emergency allocation rate active at the time.
- Reserve-policy version when applicable.
- Recovery Forecast state when applicable.
- Data source.
- Calculation-policy version.
- Calculation status.
- Correction or supersession relationship.

For V1 total-expenditure calculations, active-calorie fields may be `not_applicable` or explanatory-only when the source provides them. They must not be treated as extra additive credit.

The displayed balance should be reproducible from authoritative ledger entries or an equivalently auditable model.

## Daily Calculation Lifecycle

Conceptual lifecycle:

1. Synchronize supported intake records.
2. Synchronize supported expenditure records.
3. Normalize records.
4. Classify expenditure as active, resting, total, or unknown.
5. Deduplicate source records.
6. Determine the active goal mode, daily energy adjustment, adjustment source, and calculation-policy version for the effective date.
7. Determine whether active-calorie fields are applicable for explanation or future calibration.
8. Apply the V1 expenditure credit rate to imported total daily expenditure.
9. Calculate the goal-adjusted spending allowance.
10. Determine whether sufficient data exists to calculate the day.
11. Calculate or recalculate the daily contribution.
12. Record the ledger change.
13. Update the running lifetime bank.
14. Allocate positive changes between Available Bank and optional Emergency Bank under the active reserve policy.
15. Apply negative changes in order: Available Bank, Emergency Bank, Recovery Forecast.
16. Derive current Total Banked Calories, Available Bank, Emergency Bank, and recovery amount.
17. Generate an understandable history explanation.
18. Determine whether the morning notification can truthfully be generated.

Exact synchronization windows and cutoff times are not approved.

## Current-Day Awareness And Dashboard Visibility

Current-day expenditure and intake awareness are not part of the official bank until a day is complete and finalized.

Future `Today so far` data should be modeled as partial awareness with:

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
- Partial/current-day flag.

Rules:

- The primary burned value shown to users is adjusted current-day expenditure:

```text
adjusted_current_day_expenditure =
  imported_total_daily_expenditure_so_far * 0.80
```

- Raw imported device expenditure remains available as supporting context only, such as `2,000 from Fitbit x 80%`.
- Use source-attributed current-day total calorie intake for the eaten value.
- Do not double-count active calories. If the source exposes total daily expenditure, use that total once.
- Do not add current-day expenditure or intake to Available Bank before finalization.
- Do not show an estimated current-day deposit, withdrawal, calories remaining, or forecasted midnight balance on Today.
- Do not imply current-day expenditure is already banked.
- Do not display mock or hard-coded Today so far values as real data.
- Source and sync freshness should be visible where useful.
- The Today so far read model must not include projected bank result fields.

Today dashboard preferences must not allow Available Bank to be hidden. Available Bank is mandatory and always first. Optional cards may include Planned Treat, Today so far, Yesterday/latest finalized result, Current Goal, Emergency Bank, and future connection status cards. Simple visibility toggles are the preferred initial customization model; drag-and-drop ordering is deferred.

## Calculation Status

- Pending: required records or cutoff timing are not yet available.
- Complete: required data exists and the approved calculation policy has run.
- Incomplete: required intake, expenditure, goal-adjustment, or policy inputs are missing.
- Corrected: a previous calculation has been superseded or adjusted by late data, source correction, deletion, or manual correction.
- Estimated: source data or derived values are approximate and must be labeled as such.

Do not send a definitive balance notification for a day that lacks required data without clearly labeling it as pending, partial, or estimated.

## Morning Update

The primary V1 notification is one meaningful morning bank update.

It should communicate, when available:

- Yesterday's status.
- Yesterday's bank change.
- Raw imported activity where useful.
- Credited activity after applying the V1 conservative rate when applicable for explanation.
- Available Bank.
- Emergency Bank coverage or reserve change when relevant.
- Recovery Forecast state when both Available Bank and Emergency Bank are exhausted.
- Progress toward a selected food, meal, or event.
- Whether the selected target is now covered by the available bank.

The notification must not imply that the imported wearable number was exact. Generic engagement notifications are not part of the primary V1 loop.

Future notification categories are allowed only when they preserve trust and do not compete with the primary finalized bank update:

- Planned Treat progress milestone.
- Personalized activity opportunity.
- Positive momentum message.

Personalized activity opportunities are governed by `docs/product/adr-005-personalized-activity-opportunity-notifications.md`. They must use qualified estimated ranges, such as `may burn around 220-320 kcal`, and must not imply that estimated activity calories are banked, guaranteed, or actual expenditure.

## Missing, Delayed, Duplicated, And Corrected Data

Principles:

- Missing intake: do not treat as zero, do not substitute Planning Database estimates for confirmed intake, and mark the day incomplete or pending.
- Missing expenditure: do not treat as zero; mark the day incomplete or pending.
- Delayed synchronization: recalculate through traceable correction or supersession records.
- Duplicate source records: prevent double counting with provider, source record ID, timestamps, effective dates, sync batch IDs, and record type.
- Corrected source records: preserve the original calculation and create a correction/supersession relationship.
- Deleted source records: record that the source removed or revoked the data and recalculate through an auditable correction.
- Revoked integrations: stop future sync, preserve or delete prior data according to user consent and deletion rules, and display connection state.
- Partial days: do not confirm bank deposits or withdrawals without required inputs.
- Timezone changes: do not silently move historical records between days; behavior is an open decision.
- Manual corrections: label as manual and explain their effect on running balance.
- Retroactive goal-adjustment changes: open decision; do not silently recalculate history unless approved.
- Recalculation after late data: must preserve explanation of previous and resulting balance.
- Notification already delivered before a correction: open decision; requires user-visible correction messaging.
- Integration reconnects: resume sync with duplicate prevention and gap detection.
- Device changes: preserve data-source provenance and avoid double counting.
- Multiple expenditure sources reporting the same activity: open decision; do not sum overlapping sources unless approved.

Do not reward a user with a completed bank deposit based on data that may simply be absent.

## Trust And User Explanation

The user experience must distinguish:

- Imported intake.
- Planning Database estimates versus confirmed intake.
- Imported raw active calories.
- Credited active calories.
- The 0.80 expenditure credit rate.
- Goal mode.
- Daily energy adjustment.
- Adjustment source.
- Goal-adjusted spending allowance.
- Manual entries.
- Corrections.
- Estimated or incomplete calculations.
- Confirmed calculations.
- Pending calculations.
- Historical initialization.
- Current lifetime balance.
- Total Banked Calories.
- Available Bank.
- Emergency Bank.
- Emergency Bank allocations and withdrawals.
- Reserve-policy version when applicable.
- Recovery Forecast state when applicable.

The user should be able to inspect why their bank changed.

The Available Bank card should open read-only Bank History. The default view should stay simple: all-time Available Bank, latest finalized date, range filters, and a minimal history visualization or list. Selecting a finalized day should reveal imported total daily expenditure using consumer language such as calories burned, source labeling when useful, the `0.80` policy as `80% credited`, adjusted expenditure, goal mode, signed goal adjustment, daily allowance, calories eaten, daily bank change, prior balance, ledger/reconciliation records, current Available Bank, data freshness, and calculation status when those data exist.

Consumer UI must not expose raw internal identifiers, database field names, API field names, or variable names. Raw equations belong in technical documentation, not the default consumer interface.

Unavailable inputs must be shown as missing, pending, or incomplete. They must not be displayed as zero unless zero is a confirmed source value. If a source eventually provides resting and active expenditure components, those components may be displayed to explain the reported total expenditure, but they must not be added again after using imported total daily expenditure in the approved formula.

Goal configuration can be changed through settings, but changes must not silently rewrite historical calculations. Historical records must remain explainable with the goal mode, signed adjustment, adjustment source, expenditure-credit rate, calculation-policy version, and effective date that applied at the time.

Use language equivalent to:

> CalorieBank conservatively credits 80% of the reported daily expenditure from your connected source because calorie estimates are not exact.

Do not use language equivalent to:

> We calculated your true calorie burn.

## V1 Validation Plan

The first-10-user validation plan should evaluate:

- Whether users understand the 80% expenditure-adjustment rule.
- Whether users understand cut as a deficit, maintain as zero adjustment, and bulk as a surplus.
- Whether users understand weekly weight-change conversions as planning estimates, not promises.
- Whether they perceive it as fair.
- Whether they trust the resulting bank.
- Whether the bank broadly aligns with observed weight trends over sufficient time.
- Frequency and size of manual corrections.
- Differences across data sources.
- Cases where activity appears double counted.
- Cases where the policy appears too generous.
- Cases where the policy appears too conservative.
- Whether users make unsafe interpretations.
- Whether the morning update remains useful when data is delayed.
- Whether Recovery Forecast feels motivating, clear, and non-punitive.
- Whether users understand why Available Bank is zero when both Available Bank and Emergency Bank have been exhausted.
- Whether users understand the optional Emergency Bank as protected previously accumulated calories, not free calories or forgiveness.
- Whether users perceive Emergency Bank coverage as useful without encouraging unsafe restriction or compensatory behavior.

The first-10-user test does not scientifically validate universal metabolic accuracy. It validates product behavior and identifies whether further calibration is necessary.

## Future Calibration Path

Future possibilities, not V1 requirements:

- Device-specific expenditure credit rates.
- Activity-specific rates.
- User-selected conservative settings.
- User-specific calibration based on sufficient longitudinal intake and weight data.
- Confidence ranges.
- Automated anomaly detection.
- Adjustments based on data completeness.
- A/B or controlled evaluation of alternative rates.
- Personalized recovery recommendations.
- Emergency Bank target-maintenance strategy.
- Emergency Bank continuous-growth strategy.
- Emergency Bank no-target strategy.
- Alternative feature names such as Reserve Bank, Flex Reserve, Safety Reserve, or Backup Bank.
- Food or event planning.
- Optional activity suggestions.
- Partner experiences.
- Bookable activities.
- Adaptive recovery forecasting.
- Personalized confidence intervals.
- Activity Opportunity Engine based on explicit activity preferences.
- Curated population-based activity-energy estimates.
- Wearable-personalized activity opportunity estimates after enough consented history exists.

Any future personalized calibration must include safeguards against reacting to short-term weight fluctuations, hydration changes, or insufficient data.

### Activity Opportunity Estimate Requirements

Future activity opportunity estimates should be deterministic and versioned. A pure estimation service may accept:

- Activity code.
- Duration in minutes.
- Body weight in kilograms.
- Optional profile fields when voluntarily provided and scientifically relevant.
- Intensity assumption or range.
- Estimation method.
- Model version.

It should return:

- Estimated low calories.
- Estimated high calories.
- Duration.
- Activity code.
- Estimation method.
- Model version.
- Confidence level.
- Explanatory label.

Rules:

- Outputs must be integer calories with deterministic rounding.
- Low estimate cannot exceed high estimate.
- Invalid duration, weight, or coefficient inputs must be rejected.
- Estimates must never be negative.
- Estimates must preserve model version.
- Estimates must never be written into the calorie ledger.
- Estimates must never be treated as actual expenditure.
- A future opportunity's remaining gap must be calculated from Available Bank only and must exclude Emergency Bank.

## Safety Principles

- Do not describe wearable estimates as exact.
- Do not imply that every exercise calorie perfectly cancels a food calorie.
- Do not encourage extreme restriction or compulsive compensation.
- Avoid unsafe deficit or surplus selections.
- Weight-rate conversions are estimates, not promises.
- The common `3,500 kcal per pound` conversion is a planning approximation, not a guarantee.
- Actual weight change is affected by metabolism, body composition, adherence, water changes, measurement error, and physiological adaptation.
- CalorieBank must not promise that a selected deficit or surplus will produce an exact weekly weight change.
- The application should eventually consider minimum-intake and other safety protections before recommending or displaying an allowance.
- Users with medical or nutrition concerns should consult a qualified healthcare professional.
- Make incomplete data visible.
- Prevent expenditure double counting.
- Support corrections.
- Preserve data provenance.
- Include appropriate product disclaimers.
- Treat the bank as planning guidance rather than a medical measurement.
- Additional safeguards for unusually large balances or behavior suggesting unsafe use are unresolved and must be defined before broader beta.
- The Emergency Bank must contain only genuinely accumulated banked calories.
- The Emergency Bank must not create free expenditure credit, erase negative daily changes, or obscure how an overage was covered.
- Users should not be encouraged to accumulate extreme reserves through unsafe restriction.
- The product should avoid presenting unusually large reserves as inherently better.
- Allocation settings must not encourage compulsive compensation.
- Existing minimum-intake safeguard requirements remain applicable; exact numerical limits are unresolved.
- When both Available Bank and Emergency Bank are exhausted, use Recovery Forecast as planning guidance rather than punishment.
- Future activity opportunities must not frame movement as repayment for food. Avoid language such as `burn off what you ate`, `undo your meal`, `earn your food`, `compensate for overeating`, `you failed`, or `work this off`.
- Future activity opportunity estimates must be qualified ranges, not exact promises.

## Superseded Or Contradictory Rules

- The earlier PRD statement that the final calorie-banking formula was not approved is superseded by this specification's approved V1 formula.
- Earlier references to "eligible active calories" as a possible daily-calculation input are superseded for the primary V1 formula. V1 uses imported total daily expenditure and must not add active calories separately.
- The prompt that created this document included one conflicting acceptance bullet saying the 0.80 rate applies to eligible active calories. The same prompt also explicitly defined the approved V1 formula as applying 0.80 to imported total daily expenditure and said not to add imported active calories separately. This specification follows the explicit formula and records the conflict here.
- Weekly, monthly, 30-day expiration, scheduled decay, and automatic resets are superseded if found in older materials.
- Earlier guidance that would make a large negative bank balance the primary display is superseded. Available Bank displays zero while Recovery Forecast explains the path back.
- Earlier single-bank guidance that moved directly from Available Bank to Recovery Forecast is superseded. The approved V1 protection sequence is Available Bank -> optional Emergency Bank -> Recovery Forecast.
- Any guidance that would make Planning Database entries a bank-calculation input is superseded. Planning estimates are advisory only until confirmed intake syncs from a supported calorie-tracking source or an approved manual correction/fallback path.
- Any guidance requiring users to configure an absolute daily calorie target is superseded. V1 uses imported total daily expenditure, the `0.80` expenditure adjustment, and the user's signed daily energy adjustment.
- Any guidance requiring a manual `Use Bank`, `Spend Bank`, treat withdrawal, or confirm-consumption action is superseded. V1 bank usage is automatic through completed-day finalization.

## Open Product Decisions

- Which supported intake-data source is feasible for the first 10 users?
- Which supported total-expenditure source is feasible for the first 10 users?
- What minimum and maximum daily deficits and surpluses should be allowed?
- Should weekly weight-change preferences be included in V1 onboarding, and what exact options and copy should be used?
- What minimum-intake or allowance safeguards are required before broader beta?
- How should existing implementation fields, API contracts, and database columns with absolute-target names be migrated to goal-adjustment terminology?
- How are Recovery Forecast estimates calculated?
- Minimum history required before forecasts become available.
- How forecasts react to delayed or corrected data.
- Whether users can manually adjust recovery goals.
- How forecasts behave when insufficient historical data exists.
- Whether multiple recovery estimation strategies will exist in future versions.
- What allocation-rate range is supported for Emergency Bank?
- What is the default recommended Emergency Bank allocation rate?
- Is Emergency Bank suggested during onboarding or after initial use?
- Can users transfer calories manually between Available Bank and Emergency Bank?
- Is automatic Emergency Bank coverage mandatory when the feature is enabled?
- Can users disable automatic Emergency Bank coverage while keeping the reserve?
- Where should hidden Emergency Bank be accessible: Today overflow, Settings, or both?
- What exact copy explains that Emergency Bank is excluded from Planned Treat progress?
- Can Emergency Bank grow without limit?
- Is there a maximum reserve target?
- What happens when the user changes the allocation rate mid-day?
- How are fractional Emergency Bank allocations rounded?
- How are corrected historical deposits reallocated between Available Bank and Emergency Bank?
- Does historical initialization enter Available Bank by default?
- May the user allocate part of historical initialization to Emergency Bank?
- Does priority reserve building apply to historical initialization?
- Do allocation settings apply only to deposits earned after onboarding?
- Does an Emergency Bank target pause allocations or merely act as a milestone?
- Can users choose continuous growth after reaching an Emergency Bank target?
- What happens to the balance when Emergency Bank is disabled?
- How should unusually large Emergency Bank balances be presented?
- What safeguards prevent unsafe reserve-building behavior?
- What minimum sync freshness is required before showing Today so far values?
- Which sync statuses should Today so far display, and when should it show setup versus unavailable for expenditure, intake, or both?
- Should Today so far show when only expenditure or only intake is connected?
- Should Today card visibility preferences sync across devices or remain local?
- Which optional Today cards are visible by default before customization exists?
- When, if ever, should drag-and-drop Today card reordering be introduced?
- What is the rounding policy for adjusted expenditure, spending allowance, daily change, and running balance?
- What qualifies a historical day as complete beyond requiring intake and total expenditure?
- What happens when fewer than seven complete historical days exist?
- What data is required before a day becomes confirmed?
- What is the daily timezone boundary behavior when users travel or change timezone?
- When does the morning calculation run?
- How are late corrections communicated if a morning notification was already delivered?
- How are overlapping expenditure sources resolved?
- How are imported third-party goals or calorie targets handled if a connected source provides them?
- Can users inspect or change the expenditure credit rate in V1?
- Are historical ledger entries recalculated after a future policy change?
- What safeguards apply to unusually large balances?
- What safeguards apply to unusually large recovery amounts or repeated Recovery Forecast states?
- How should deleted source records affect already-confirmed ledger entries?
- What user consent and deletion rules apply after integration revocation?
- How should source records with no stable provider identifier be deduplicated?
- Which activity categories should be supported in explicit activity-preference settings?
- Which curated activity-energy source and model version should power initial population-based estimates?
- What minimum data confidence is required before wearable-personalized activity estimates can replace population estimates?
- What profile fields are required for estimates, and how should users consent to optional fields?
- Should Planned Treat store a future `plannedFor` date/time rather than only a date?
- What policy thresholds determine whether a remaining Planned Treat gap is realistically addressable?
- What quiet-hours, frequency-cap, cooldown, and duplicate-suppression policies govern activity opportunities?
- How long should opportunity candidates and notification-delivery history be retained?
- Which user controls are required for muting an activity or disabling goal-linked activity nudges?

## Implementation Requirements

- Bank calculation logic belongs in `packages/domain`.
- API schemas for calculation inputs, statuses, and ledger events belong in `packages/schemas`.
- The V1 policy must be represented as named, versioned configuration.
- Goal mode, daily energy adjustment, adjustment source, desired weekly weight-change preference when applicable, expenditure-credit rate, and calculation-policy version must be snapshotted for each effective date.
- Emergency Bank allocation and coverage rules must be represented as named, versioned reserve-policy configuration.
- Tests are required for calculation changes, historical initialization, missing data states, duplicate prevention, corrections, and rounding once approved.
- No production implementation is defined by this document; this is a product and architecture specification.
