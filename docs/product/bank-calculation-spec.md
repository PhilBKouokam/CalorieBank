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

## Product Model

CalorieBank is an automatic interpretation and planning layer.

Existing applications may answer:

- What did I eat?
- How much activity did my device record?

CalorieBank answers:

- How much did my bank change?
- What is my available lifetime bank?
- Why did the balance change?
- Have I accumulated enough flexibility for a desired food, meal, or event?

CalorieBank must not claim to measure a person's exact metabolism or exact physiological energy expenditure.

## Required Terminology

- Base calorie target: the user's configured calorie goal context. In the approved V1 formula, the operative target input is `desired_daily_deficit` applied against imported total daily expenditure. If future flows introduce a fixed calorie target that already includes activity, double-counting rules must be explicitly defined before implementation.
- Imported calorie intake: calories consumed for an effective date from a supported intake source or approved manual fallback.
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
- Lifetime bank: cumulative non-expiring available bank after initialization and confirmed ledger events.
- Running balance: lifetime bank after a specific ledger event.
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

Active calories and total daily energy expenditure are distinct. V1's primary formula uses imported total daily expenditure. Do not add active calories on top of that formula.

## Calculation Policy Configuration

Approved V1 policy:

- `calculation_policy_version`: `v1-total-expenditure-80`
- `expenditure_input`: `imported_total_daily_expenditure`
- `expenditure_credit_rate`: `0.80`
- `deficit_input`: `desired_daily_deficit`
- `intake_input`: `imported_daily_calorie_intake`

The `0.80` rate is an authoritative V1 product policy. It must be stored as a named, versioned calculation parameter so later versions can adjust it without rewriting the bank model.

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

The 0.80 adjustment applies to the complete imported total daily expenditure value used by CalorieBank. Do not add imported active calories separately after applying this formula. Do not combine this formula with a separate fixed calorie target that already represents estimated daily expenditure. Doing either would double count expenditure.

The imported expenditure source and imported intake source are the operational V1 sources of truth. Their values remain estimates and user-generated records rather than direct measurements of exact physiology.

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

## Lifetime Bank

- Banked calories do not expire.
- There is no weekly, monthly, or 30-day expiration.
- There is no scheduled decay.
- There is no automatic periodic reset.
- The primary displayed balance is the cumulative lifetime bank.
- Daily, weekly, and monthly values are timeline views or period changes, not separate expiring banks.
- The history must explain how the lifetime balance reached its current value.

Any conflicting reset or expiration concept in older prototype materials is superseded.

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
13. Generate an understandable history explanation.
14. Determine whether the morning notification can truthfully be generated.

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
- Current lifetime balance.
- Progress toward a selected food, meal, or event.
- Whether the selected target is now covered by the available bank.

The notification must not imply that the imported wearable number was exact. Generic engagement notifications are not part of the primary V1 loop.

## Missing, Delayed, Duplicated, And Corrected Data

Principles:

- Missing intake: do not treat as zero; mark the day incomplete or pending.
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

## Superseded Or Contradictory Rules

- The earlier PRD statement that the final calorie-banking formula was not approved is superseded by this specification's approved V1 formula.
- Earlier references to "eligible active calories" as a possible daily-calculation input are superseded for the primary V1 formula. V1 uses imported total daily expenditure and must not add active calories separately.
- The prompt that created this document included one conflicting acceptance bullet saying the 0.80 rate applies to eligible active calories. The same prompt also explicitly defined the approved V1 formula as applying 0.80 to imported total daily expenditure and said not to add imported active calories separately. This specification follows the explicit formula and records the conflict here.
- Weekly, monthly, 30-day expiration, scheduled decay, and automatic resets are superseded if found in older materials.

## Open Product Decisions

- Which supported intake-data source is feasible for the first 10 users?
- Which supported total-expenditure source is feasible for the first 10 users?
- Is the base calorie target activity-exclusive?
- How should a fixed user calorie target coexist with the approved total-expenditure formula without double counting?
- Can ongoing lifetime balances fall below zero after initialization? Current PRD says yes, but implementation guardrails and presentation need approval.
- How exactly should withdrawals be described when the lifetime bank becomes negative?
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
- How should deleted source records affect already-confirmed ledger entries?
- What user consent and deletion rules apply after integration revocation?
- How should source records with no stable provider identifier be deduplicated?

## Implementation Requirements

- Bank calculation logic belongs in `packages/domain`.
- API schemas for calculation inputs, statuses, and ledger events belong in `packages/schemas`.
- The V1 policy must be represented as named, versioned configuration.
- Tests are required for calculation changes, historical initialization, missing data states, duplicate prevention, corrections, and rounding once approved.
- No production implementation is defined by this document; this is a product and architecture specification.
