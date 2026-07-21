# ADR 002: Expenditure-Relative Goal Adjustment

Date: 2026-07-19

## Status

Accepted.

## Decision

CalorieBank V1 does not ask users to enter an absolute daily calorie target.

The connected total-calorie-expenditure source is the operational source of truth for determining the user's daily allowance. CalorieBank applies the approved V1 conservative expenditure policy, then applies the user's signed goal adjustment:

```text
calculation_policy_version = v1-total-expenditure-80

adjusted_daily_expenditure =
  imported_total_daily_expenditure * 0.80

daily_spending_allowance =
  adjusted_daily_expenditure + daily_energy_adjustment

daily_bank_change =
  daily_spending_allowance - imported_daily_calorie_intake
```

Goal configuration uses:

```text
goal_mode:
  cut | maintain | bulk

daily_energy_adjustment:
  signed calorie adjustment relative to adjusted expenditure

adjustment_source:
  manual_calories | estimated_weight_rate

desired_weekly_weight_change:
  optional planning value
```

Signed adjustment behavior:

- Cut uses a negative adjustment, configured as a desired daily deficit.
- Maintain uses `daily_energy_adjustment = 0` and does not ask for a calorie target, deficit, or surplus.
- Bulk uses a positive adjustment, configured as a desired daily surplus.

## Why Absolute Targets Were Rejected

An absolute user-entered calorie target conflicts with the connection-first V1 thesis. V1 is intended to interpret supported expenditure and intake data automatically, not ask users to maintain a second static allowance that may drift away from the connected expenditure source.

Absolute targets also create double-counting risk. If a user enters a target that already reflects estimated activity, then CalorieBank also imports total daily expenditure, the system can accidentally mix two separate expenditure assumptions into one bank calculation.

## Why Expenditure-Relative Adjustments Were Selected

The expenditure-relative model keeps one operational source of truth for daily allowance: imported total daily expenditure from the supported expenditure source, adjusted by CalorieBank's named V1 policy.

The user's goal is represented as intent relative to that adjusted expenditure:

- Cut: spend below adjusted expenditure.
- Maintain: spend at adjusted expenditure.
- Bulk: spend above adjusted expenditure.

This preserves the low-friction automatic banking loop while still letting users express their goal.

## Why Maintain Has Zero Adjustment

Maintain means the user wants the goal-adjusted allowance to match adjusted imported expenditure. Asking for a manual calorie target, deficit, or surplus would reintroduce the absolute-target model this ADR rejects.

## Why The 0.80 Multiplier Remains

The `0.80` expenditure adjustment remains the approved V1 policy under `v1-total-expenditure-80`.

It is an intentional conservative product policy designed to reduce the effect of expenditure-estimation error and produce consistent calculations. It is not a claim that CalorieBank measures exact physiology or that every device overestimates expenditure by exactly 20%.

The multiplier must remain named, versioned, transparent, and configurable rather than scattered through implementation as an unexplained literal.

## Weight-Change Estimates

Onboarding may optionally translate weekly weight-change preferences into daily adjustments, but those conversions are estimates, not promises.

Planning approximations may include:

```text
0.5 lb/week ~= 250 kcal/day
1.0 lb/week ~= 500 kcal/day
1.5 lb/week ~= 750 kcal/day
2.0 lb/week ~= 1,000 kcal/day
```

The common `3,500 kcal per pound` conversion is a planning approximation. Actual weight change is affected by metabolism, body composition, adherence, water changes, measurement error, and physiological adaptation. CalorieBank must not promise that a selected deficit or surplus will produce an exact weekly weight change.

## Consequences

### Onboarding

Onboarding should ask for goal mode. Cut asks for a desired daily deficit or estimated weekly loss preference. Maintain asks for no calorie value and uses zero adjustment. Bulk asks for a desired daily surplus or estimated weekly gain preference.

### Persistence

Historical records must snapshot the active goal mode, daily energy adjustment, adjustment source, desired weekly weight-change preference when applicable, expenditure-credit rate, and calculation-policy version for each effective date.

Existing implementation or schema names that imply an absolute daily calorie target require a separate migration task.

### API Contracts

Future API contracts should expose goal mode and signed goal-adjustment fields rather than absolute daily calorie targets. Existing API endpoints or payloads that still use target terminology are transitional implementation debt and must not be treated as authoritative product behavior.

### Calculations

Bank calculations must use imported total daily expenditure, the `0.80` V1 adjustment, the signed daily energy adjustment, and imported daily calorie intake. Active calories must not be added separately after using total expenditure.

### Historical Snapshots

Historical initialization and later recalculation must preserve the calculation-policy version and goal-adjustment fields used for each effective date. Future policy changes must not silently rewrite historical ledger meaning.

### Safety

CalorieBank should guard against extreme deficit and surplus selections. The application should eventually consider minimum-intake and other safety protections before recommending or displaying an allowance. Users with medical or nutrition concerns should consult a qualified healthcare professional.

## Implementation Status

This ADR changes product direction only. Existing application code, database fields, API endpoints, tests, and migrations still require a separate implementation and migration task.
