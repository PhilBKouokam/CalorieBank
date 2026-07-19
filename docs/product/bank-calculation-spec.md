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
- `docs/architecture/current-state-audit.md`
- `README.md`
- `AGENTS.md`

Superseded ideas include manual-food-logging-first V1, weekly-bank framing as the primary model, mutable bank balances, and generic engagement notifications.

## Design Principles

### Lowest Friction

The normal connected experience should require almost no daily work inside CalorieBank.

### Automatic By Default

Supported intake and expenditure data should synchronize automatically, and the bank should update when sufficient data is available.

### Transparent Calculations

Users must be able to understand where their balance came from.

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

CalorieBank must not claim to measure a person's exact metabolism or exact physiological energy expenditure.

The Planning Database described in `docs/product/v1-prd.md` supports future meal and event planning only. Planning estimates are not confirmed intake, are not Food Tracking records, and must not directly change the bank.

## Required Terminology

- Base calorie target: the user's configured calorie goal context. In the approved V1 formula, the operative target input is `desired_daily_deficit` applied against imported total daily expenditure. If future flows introduce a fixed calorie target that already includes activity, double-counting rules must be explicitly defined before implementation.
- Imported calorie intake: calories consumed for an effective date from a supported intake source or approved manual fallback.
- Planning Database entry: estimated meal, food, drink, grocery product, restaurant item, homemade meal, or event calorie information used for future planning only. It is not confirmed intake and does not directly affect bank calculations.
- Raw imported active calories: activity-only calories reported by a source before CalorieBank adjustment. These are distinct from total expenditure and are not separately added in the approved V1 primary formula.
- Raw imported total expenditure: total daily calorie expenditure reported by a supported expenditure or health-data source for an effective date.
- Eligible active calories: active calories allowed to influence a calculation under an approved policy. In V1's primary formula, this value is recorded for provenance when available but is not separately added after applying the total-expenditure formula.
- Expenditure credit rate: named, versioned calculation parameter applied to the approved expenditure input. V1 uses `0.80`.
- Credited active calories: active-calorie credit after policy adjustment. In V1's total-expenditure formula, this value may be displayed for explanation only when source data supports it; it is not an extra additive input.
- Base-target savings: the amount left after comparing adjusted spending allowance to imported intake for a day.
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
- `deficit_input`: `desired_daily_deficit`
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

The approved V1 calculation is:

```text
adjusted_daily_expenditure =
  imported_total_daily_expenditure * 0.80

daily_spending_target =
  adjusted_daily_expenditure - desired_daily_deficit

daily_bank_change =
  daily_spending_target - imported_daily_calorie_intake
```

Equivalent form:

```text
daily_bank_change =
  (imported_total_daily_expenditure * 0.80)
  - desired_daily_deficit
  - imported_daily_calorie_intake
```

Interpretation:

- A positive `daily_bank_change` is deposited into the user's lifetime bank.
- A negative `daily_bank_change` is withdrawn from the user's lifetime bank.
- A zero result means the user consumed exactly the amount permitted while preserving their selected daily deficit.
- Banked calories do not expire.
- The lifetime bank represents the cumulative sum of confirmed deposits and withdrawals after initialization.
- Positive daily changes may be allocated between Available Bank and optional Emergency Bank under the user's active reserve policy.
- Negative daily changes are applied in this conceptual order: Available Bank, then Emergency Bank, then Recovery Forecast for any remaining uncovered amount.

The 0.80 adjustment applies to the complete imported total daily expenditure value used by CalorieBank. Do not add imported active calories separately after applying this formula. Do not combine this formula with a separate fixed calorie target that already represents estimated daily expenditure. Doing either would double count expenditure.

The imported expenditure source and imported intake source are the operational V1 sources of truth. Their values remain estimates and user-generated records rather than direct measurements of exact physiology.

Planning Database estimates are not operational sources of truth for intake. If a user plans a meal in CalorieBank and later eats it, the confirmed intake must come from the connected calorie-tracking application or an approved manual correction/fallback path before it affects the bank.

### Examples

```text
Imported total expenditure: 3,000 kcal
V1 expenditure adjustment: 0.80
Adjusted daily expenditure: 2,400 kcal
Desired daily deficit: 500 kcal
Imported intake: 1,900 kcal
Daily bank change: 0 kcal
```

```text
Imported total expenditure: 3,000 kcal
Adjusted daily expenditure: 2,400 kcal
Desired daily deficit: 500 kcal
Imported intake: 1,700 kcal
Daily bank change: +200 kcal
```

```text
Imported total expenditure: 3,000 kcal
Adjusted daily expenditure: 2,400 kcal
Desired daily deficit: 500 kcal
Imported intake: 2,200 kcal
Daily bank change: -300 kcal
```

## Data-Source Requirements

Bank inputs may come from:

- Supported calorie-intake integrations.
- Supported health-data or calorie-expenditure integrations.
- Approved manual fallback entry.
- Approved manual corrections.

Do not claim support for every application.

Planning Database entries are explicitly excluded from bank-calculation inputs. They may be used to compare estimated future calorie costs against Available Bank or estimated time-to-bank, but they must not create deposits, withdrawals, confirmed intake, or ledger transactions unless a later approved integration explicitly exports the consumed item to a supported intake source and that source syncs it back as confirmed intake.

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

Users should eventually be able to manage Emergency Bank settings, including enabled/disabled state, allocation percentage, initial reserve target, priority reserve building, contribution behavior after the target is reached, and whether automatic Emergency Bank coverage is enabled. Exact settings screens and controls are not approved by this specification.

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

- Effective date.
- Event type.
- Intake input.
- Raw active-calorie input.
- Eligible active calories.
- Expenditure credit rate.
- Credited active calories.
- Base-target savings.
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
6. Determine whether the base target or selected data source already includes activity.
7. Determine whether active-calorie fields are applicable for explanation or future calibration.
8. Apply the V1 expenditure credit rate to imported total daily expenditure.
9. Determine whether sufficient data exists to calculate the day.
10. Calculate or recalculate the daily contribution.
11. Record the ledger change.
12. Update the running lifetime bank.
13. Allocate positive changes between Available Bank and optional Emergency Bank under the active reserve policy.
14. Apply negative changes in order: Available Bank, Emergency Bank, Recovery Forecast.
15. Derive current Total Banked Calories, Available Bank, Emergency Bank, and recovery amount.
16. Generate an understandable history explanation.
17. Determine whether the morning notification can truthfully be generated.

Exact synchronization windows and cutoff times are not approved.

## Calculation Status

- Pending: required records or cutoff timing are not yet available.
- Complete: required data exists and the approved calculation policy has run.
- Incomplete: required intake, expenditure, target, or policy inputs are missing.
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
- Retroactive target changes: open decision; do not silently recalculate history unless approved.
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

Use language equivalent to:

> CalorieBank conservatively credits 80% of the reported daily expenditure from your connected source because calorie estimates are not exact.

Do not use language equivalent to:

> We calculated your true calorie burn.

## V1 Validation Plan

The first-10-user validation plan should evaluate:

- Whether users understand the 80% expenditure-adjustment rule.
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

Any future personalized calibration must include safeguards against reacting to short-term weight fluctuations, hydration changes, or insufficient data.

## Safety Principles

- Do not describe wearable estimates as exact.
- Do not imply that every exercise calorie perfectly cancels a food calorie.
- Do not encourage extreme restriction or compulsive compensation.
- Avoid unsafe calorie targets.
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
- Existing calorie-target and minimum-intake safeguards remain applicable.
- When both Available Bank and Emergency Bank are exhausted, use Recovery Forecast as planning guidance rather than punishment.

## Superseded Or Contradictory Rules

- The earlier PRD statement that the final calorie-banking formula was not approved is superseded by this specification's approved V1 formula.
- Earlier references to "eligible active calories" as a possible daily-calculation input are superseded for the primary V1 formula. V1 uses imported total daily expenditure and must not add active calories separately.
- The prompt that created this document included one conflicting acceptance bullet saying the 0.80 rate applies to eligible active calories. The same prompt also explicitly defined the approved V1 formula as applying 0.80 to imported total daily expenditure and said not to add imported active calories separately. This specification follows the explicit formula and records the conflict here.
- Weekly, monthly, 30-day expiration, scheduled decay, and automatic resets are superseded if found in older materials.
- Earlier guidance that would make a large negative bank balance the primary display is superseded. Available Bank displays zero while Recovery Forecast explains the path back.
- Earlier single-bank guidance that moved directly from Available Bank to Recovery Forecast is superseded. The approved V1 protection sequence is Available Bank -> optional Emergency Bank -> Recovery Forecast.
- Any guidance that would make Planning Database entries a bank-calculation input is superseded. Planning estimates are advisory only until confirmed intake syncs from a supported calorie-tracking source or an approved manual correction/fallback path.

## Open Product Decisions

- Which supported intake-data source is feasible for the first 10 users?
- Which supported total-expenditure source is feasible for the first 10 users?
- Is the base calorie target activity-exclusive?
- How should a fixed user calorie target coexist with the approved total-expenditure formula without double counting?
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
- Can users withdraw from Emergency Bank for planned spending?
- Is automatic Emergency Bank coverage mandatory when the feature is enabled?
- Can users disable automatic Emergency Bank coverage while keeping the reserve?
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
- What is the rounding policy for adjusted expenditure, spending target, daily change, and running balance?
- What qualifies a historical day as complete beyond requiring intake and total expenditure?
- What happens when fewer than seven complete historical days exist?
- What data is required before a day becomes confirmed?
- What is the daily timezone boundary behavior when users travel or change timezone?
- When does the morning calculation run?
- How are late corrections communicated if a morning notification was already delivered?
- How are overlapping expenditure sources resolved?
- How are imported calorie targets that already include activity handled?
- Can users inspect or change the expenditure credit rate in V1?
- Are historical ledger entries recalculated after a future policy change?
- What safeguards apply to unusually large balances?
- What safeguards apply to unusually large recovery amounts or repeated Recovery Forecast states?
- How should deleted source records affect already-confirmed ledger entries?
- What user consent and deletion rules apply after integration revocation?
- How should source records with no stable provider identifier be deduplicated?

## Implementation Requirements

- Bank calculation logic belongs in `packages/domain`.
- API schemas for calculation inputs, statuses, and ledger events belong in `packages/schemas`.
- The V1 policy must be represented as named, versioned configuration.
- Emergency Bank allocation and coverage rules must be represented as named, versioned reserve-policy configuration.
- Tests are required for calculation changes, historical initialization, missing data states, duplicate prevention, corrections, and rounding once approved.
- No production implementation is defined by this document; this is a product and architecture specification.
