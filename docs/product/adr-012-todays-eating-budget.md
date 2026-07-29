# ADR 012: Today's Eating Budget

Date: 2026-07-27

## Status

Accepted as a progressively discovered V1 product capability.

The user problem, terminology, conceptual boundaries, progressive-discovery treatment, and safety rules are approved. The production calculation is not approved because provider semantics, remaining-resting-expenditure methodology, and the relationship to the current signed goal-adjustment model remain unresolved. Those decisions block implementation of a numeric budget.

## Context

CalorieBank already distinguishes:

- Available Bank, which is finalized and ledger-backed.
- Today So Far, which reports confirmed current-day expenditure and intake.
- Today's Forecast and Projected Daily Burn, which estimate future expenditure without projecting the bank.

Some users adjust food decisions as confirmed activity accumulates. They currently have to translate expenditure, intake, the `0.80` adjustment, and their configured goal into an eating allowance themselves.

The approved consumer name for the new guidance capability is **Today's Eating Budget**. Do not rename it to `Today's Intake Target`, `Daily Intake Target`, `Projected Calories You Can Eat`, `Remaining Calories`, `Projected Bank`, or `Available Bank`.

## Decision

Today's Eating Budget answers:

> Based on confirmed expenditure so far today, how many total calories can I eat today and still satisfy my configured daily banking goal?

It is current-day planning guidance that may change as confirmed expenditure and intake change. It does not create a ledger entry, modify Available Bank, finalize the day, or determine the day's official result.

The product must keep these concepts separate:

| Concept | Meaning |
| --- | --- |
| Available Bank | Finalized, ledger-backed, persistent, non-expiring accumulated calorie savings from completed-day transactions. |
| Today's Eating Budget | Current-day guidance for the total intake that would satisfy the configured daily goal under the approved live calculation. It may change during the day and is not ledger-backed. |
| Remaining Today | Today's Eating Budget minus confirmed intake so far. It may be positive, zero, or negative and is not a bank balance. |
| Today's Forecast | Estimated future guidance based on projected end-of-day conditions and editable assumptions. |
| Projected Daily Burn | The estimated end-of-day expenditure produced by Today's Forecast. It is not a bank projection. |

These values must not be merged, labeled interchangeably, or visually presented as competing bank balances.

## Confirmed And Estimated Inputs

Today's Eating Budget should primarily use confirmed current-day data:

- Confirmed provider-reported expenditure can change the live guidance.
- Confirmed intake reduces Remaining Today.
- Projected future activity belongs to Today's Forecast.
- Projected expenditure must not silently increase the confirmed Today’s Eating Budget.

If future product design shows forecasted eating flexibility, it must be separately labeled and must not replace the confirmed guidance. For example:

```text
Today's Eating Budget
2,140 kcal

If your day follows the current forecast
Approximately 2,780 kcal
```

Whether forecasted eating flexibility is included in V1 presentation remains open.

## Provider Semantics Review

The currently implemented Apple Health adapter queries cumulative active energy and cumulative basal energy over a local calendar-day window. It composes:

```text
confirmed_provider_expenditure_so_far =
  cumulative_active_energy + cumulative_basal_energy

adjusted_expenditure_so_far =
  confirmed_provider_expenditure_so_far * 0.80
```

The API applies the centralized `v1-total-expenditure-80` policy once. Steps and workout calories are contextual records and are not added separately.

This implementation does not provide an approved estimate of resting expenditure for the unelapsed portion of the day. It also does not establish a universal semantic contract for every future provider.

Future provider behavior may differ:

- Accumulated expenditure only through the current moment.
- A live total that includes resting expenditure accumulated so far.
- An estimated full-day expenditure.
- Separate active and resting fields.
- Insufficiently reliable intra-day expenditure.

Every provider adapter must declare which semantic it supplies before it can support Today's Eating Budget. The product must show an unavailable or limited state when the semantic is insufficient.

## Calculation Model

The following confirmed calculation remains authoritative:

```text
adjusted_expenditure_so_far =
  confirmed_provider_expenditure_so_far * 0.80
```

The total eating-budget intent is:

```text
today_eating_budget =
  approved_adjusted_expected_expenditure_for_today
  adjusted for the user's configured daily banking goal
```

A possible decomposition for a provider that reports only accumulated expenditure is:

```text
approved_adjusted_expected_expenditure_for_today =
  adjusted_expenditure_so_far
  + approved_non_overlapping_estimate_of_remaining_expenditure
```

This decomposition is not an approved production formula. The source and treatment of remaining expenditure must be resolved first.

The proposed expression that subtracts `remaining_expected_resting_expenditure_for_today` from expenditure so far is not authoritative. It conflicts with the stated full-day budget intent and the conceptual examples, and it could undercount or double-count resting expenditure depending on provider semantics.

The repository's active goal model uses:

```text
daily_spending_allowance =
  adjusted_daily_expenditure + daily_energy_adjustment
```

where cut is negative, maintain is zero, and bulk is positive. It does not currently store a separate `desired_daily_bank_contribution`.

A candidate alignment is:

```text
today_eating_budget =
  approved_adjusted_expected_expenditure_for_today
  + active_daily_energy_adjustment
```

This candidate is not approved for implementation until product confirms whether the existing signed adjustment fully represents the requested daily banking goal. In particular:

- A cut adjustment of `-500` behaves like reserving `500 kcal`.
- Maintain currently applies zero adjustment and does not reserve a separate contribution.
- Bulk currently applies a positive surplus.
- A separate maintenance-oriented `bank 500` preference is not represented by the current goal model and must not be invented.

Product copy must not imply that `Maintain` and `reserve 500 for the bank` are the same configuration. Expenditure establishes the day's energy basis; the approved goal configuration determines the intentional adjustment to that basis.

The bank-calculation specification remains authoritative for the relationship between goal mode, adjustment, allowance, and finalized contribution.

## Total And Remaining Values

When a total budget can be calculated reliably:

```text
remaining_today =
  today_eating_budget - confirmed_intake_so_far
```

The interface must separately label:

- Total Today's Eating Budget.
- Confirmed intake already recorded.
- Remaining Today.

An unlabeled number that could be mistaken for any of these is prohibited.

If confirmed intake exceeds the live budget, Remaining Today may be negative. Use neutral copy such as:

> 220 kcal above today's current eating budget

Do not create or display a negative Available Bank, modify the ledger, imply that the final outcome is known, or use failure, debt, penalty, or exercise-compensation language. Later confirmed expenditure may still change the guidance.

## Conceptual Example

The following example illustrates product behavior only. It is not an approved production calculation:

```text
Expected adjusted full-day expenditure before additional activity: 2,000 kcal
Desired daily bank contribution:                              -500 kcal
Initial Today's Eating Budget:                               1,500 kcal

Incremental increase in provider total after a workout:        800 kcal
Adjusted incremental credit:                        800 * 0.80 = 640 kcal
Updated Today's Eating Budget:                              2,140 kcal

Additional non-overlapping increase in provider total:       1,400 kcal
Adjusted incremental credit:                      1,400 * 0.80 = 1,120 kcal
Updated Today's Eating Budget:                              3,260 kcal
```

The `3,260 kcal` result is valid only if `800` and `1,400` are independent, non-overlapping increases in the provider total on top of the baseline. Neither a workout record nor a step value is added directly. If `1,400` is a later cumulative total that already includes the earlier `800`, only the incremental difference may be considered. Cumulative provider snapshots must never be summed.

Production behavior depends on an approved method for separating baseline expenditure, accumulated resting expenditure, future resting expenditure, and non-overlapping activity. The example is not a physiological claim.

## Resting Expenditure

Today's Eating Budget may require an estimate for expenditure during the unelapsed part of the day. CalorieBank must not claim to know exact hourly resting burn.

Potential inputs requiring approval include:

- Historical full-day totals.
- Provider-supplied resting expenditure.
- Time-of-day patterns.
- Sleep periods.
- Missing or delayed provider data.

Any estimate must be labeled, versioned, explainable, and non-overlapping with resting expenditure already included in the provider total. Preferred language is equivalent to:

> Based on your recent data, your expenditure typically continues at approximately this rate during the remaining hours of the day.

## Double-Counting Guardrail

CalorieBank must not stack workout calories, step calories, active calories, resting calories, and provider total expenditure when those values overlap.

Provider total expenditure remains the default source of truth where approved. Activity and step data may explain, personalize, or simulate changes, but they must not be added on top of provider total expenditure without a documented non-overlapping methodology.

This guardrail applies to:

- Today's Eating Budget.
- Today's Forecast.
- Projected Daily Burn.
- Personalized activity averages.
- Activity Opportunity calculations.
- Future eating-flexibility calculations.

Personal activity averages remain explanatory or forecast inputs unless the system can establish that they are not already represented in confirmed provider totals.

## Progressive Feature Discovery

Today's Eating Budget belongs to V1 but is not required during onboarding or on the Foundation-stage dashboard. ADR 011 governs contextual relevance and ADR 014 governs user readiness and pacing.

Conceptual eligibility signals may include:

- Reliable intra-day expenditure and intake data.
- Familiarity with Available Bank.
- Repeated current-day expenditure or intake checks.
- Regular increases in activity during the day.
- User behavior suggesting that eating decisions respond to activity, without treating that signal as proof of motive.
- Engagement with Today's Forecast.
- Manual enablement through Customize Today.
- Relevance to an active meal, Planned Treat, or event plan.

These signals may establish relevance, but they do not by themselves establish familiarity or complementarity. A proactive introduction requires all three ADR 014 gates. Meaningful use of Available Bank, Today-so-far data, Planning, or a previously introduced forecast may be conceptual familiarity evidence; accidental taps, account age, elapsed days, and session count alone are not.

The feature should remain manually discoverable where practical. Manual enablement does not require the system to infer readiness. When another feature is simultaneously eligible, CalorieBank should recommend only the capability with the highest immediate value and delay the other introduction.

Preferred discovery copy is equivalent to:

> Your eating flexibility often changes as your activity increases. Today's Eating Budget can show how much you can eat today while still targeting your daily bank contribution.

Avoid `unlock more calories`, `earn food`, `burn this to eat that`, `work off your meal`, generic feature advertising, or language implying that exercise creates permission to eat.

## UX And Explanation

A potential compact card is:

```text
Today's Eating Budget
2,140 kcal total today

1,180 kcal eaten
960 kcal remaining

Increased by 640 kcal after confirmed expenditure changed
```

The exact visual design is not approved. The hierarchy should prioritize:

1. Total Today's Eating Budget.
2. Remaining Today.
3. Confirmed intake so far.
4. A concise explanation of what changed.
5. Freshness or synchronization status when needed.

Do not put detailed formulas on the default card. A read-only explanation view should show:

- Confirmed adjusted expenditure so far.
- Estimated remaining expenditure, if used.
- Configured goal and its effect.
- Confirmed intake so far.
- The `0.80` policy.
- Data sources and last synchronization.
- Which values are confirmed and which are estimated.
- That Available Bank will not change until completed-day posting.

Example:

```text
Today's Eating Budget

Expected adjusted expenditure today    2,640 kcal  Estimated
Reserved for your daily goal             500 kcal
Total eating budget                    2,140 kcal

Food recorded so far                   1,180 kcal  Confirmed
Remaining today                          960 kcal
```

## Planning Relationship

Today's Eating Budget may support planning without becoming a food log:

```text
Remaining Today: 960 kcal
Planned dinner:  780 kcal
Estimated room:  180 kcal
```

Planning entries are hypothetical. They do not reduce Remaining Today until confirmed intake arrives from the connected intake source.

The product must distinguish planned food, confirmed intake, Remaining Today, and Available Bank.

Banking Goals under ADR 013 organize finalized Available Bank calories and answer what those savings are reserved for. Today's Eating Budget answers how much current-day intake fits the configured goal. It must not automatically fund, consume, release, or reassign a Banking Goal.

A planning comparison may evaluate a hypothetical item against Remaining Today, Unassigned Available Bank, a specific Banking Goal, or total Available Bank, but the interface must label the source. A hypothetical item does not reduce Remaining Today or a goal allocation until confirmed intake and the separately approved finalized-withdrawal attribution policy apply.

## Notifications

Do not send frequent notifications whenever the budget changes. The morning finalized-bank update remains the primary V1 notification.

Potential future notifications, not approved by this ADR, include a meaningful increase after familiar activity, a planning threshold, a user-requested alert, or a significant correction. Thresholds, frequency, consent, and controls remain open. Notifications must not encourage compulsive activity or food compensation.

## Data States And Corrections

The capability must handle independently:

- Delayed or stale expenditure.
- Delayed or stale intake.
- A disconnected source.
- Missing resting-expenditure semantics.
- Insufficient partial-day data.
- Provider corrections.
- Duplicate activity records.
- Timezone and daylight-saving changes.
- Mid-day goal changes.
- Any future adjustment-policy change.
- Historical revisions after finalization.

When calculation is not reliable, show an unavailable, stale, or limited state rather than invented precision:

> Today's Eating Budget is temporarily unavailable because your expenditure data has not updated.

Provider corrections may decrease the budget. Whether and how to call attention to a decrease remains open.

## Day Finalization

Today's Eating Budget is temporary guidance. At completed-day posting:

- The approved bank formula determines the ledger contribution.
- Today's Eating Budget creates no transaction.
- Temporary estimates do not enter the ledger.
- Final intake and expenditure may differ from intra-day values.
- A concise reconciliation may explain why final results differ from live guidance.

For example:

```text
Live guidance
Today's Eating Budget used an estimated full-day expenditure input.

Completed-day result
Finalized contribution: +445 kcal

Why it changed
Late provider synchronization changed final intake or expenditure.
```

Do not show a live Projected Bank or call a temporary eating-budget difference a bank transaction.

## Health, Privacy, And Behavioral Framing

- Treat the feature as planning guidance, not permission to eat or a medical prescription.
- Do not imply that food must be earned through exercise.
- Do not encourage punitive exercise or compulsive compensation.
- Explain that expenditure estimates contain uncertainty.
- Do not claim exact metabolic accuracy.
- Do not diagnose eating disorders or infer disordered behavior from ordinary use.
- Use only health and behavior data available under approved permissions.
- Do not expose health values in generic analytics or feature-discovery copy.
- Any safety intervention requires a separate approved policy.

## Validation

V1 research should evaluate:

- Understanding of Today's Eating Budget as current-day guidance.
- Confusion with Available Bank, Remaining Today, Today's Forecast, or Projected Daily Burn.
- Understanding of total budget versus remaining amount.
- Whether the value is actionable and reduces manual arithmetic.
- Trust in changes during the day.
- Understanding of confirmed versus estimated values and the `0.80` policy.
- Whether it helps a real food decision.
- Whether it creates exercise-for-food pressure or unhealthy compensation.
- Understanding that finalized contribution is determined later.
- Progressive-discovery timing and manual discoverability.
- Stale and unavailable states.
- Separation of forecasted and confirmed values.

Increased app opens alone do not prove value.

## Open Product Decisions

- What exact provider fields support reliable intra-day expenditure?
- Does each provider total include resting expenditure accumulated so far, an estimated full day, or another semantic?
- How is remaining resting expenditure estimated?
- How is overlap and double counting prevented for each provider?
- What minimum history is required?
- How frequently may Today's Eating Budget refresh?
- What freshness threshold is acceptable?
- What rounding policy and display increment apply?
- Can the budget decrease after corrections, and how is that explained?
- What happens when the user changes the goal mid-day?
- Does a goal change apply immediately or on the following day?
- Does the existing signed `daily_energy_adjustment` fully represent the daily banking goal, including cut, maintain, and bulk?
- Is a separate desired daily bank-contribution preference required?
- Should the card show total budget, Remaining Today, or both by default?
- Can users hide confirmed intake from the card?
- What happens when intake data is missing?
- What happens when expenditure data is missing?
- Is a baseline full-day expenditure estimated before enough current-day data arrives?
- Is there a minimum time of day before the budget is available?
- How are overnight workers and non-midnight day boundaries handled?
- How are timezone and daylight-saving changes handled?
- Is the feature available without a wearable?
- Can manual activity affect the confirmed budget?
- Are step-based changes explanatory only or calculation inputs?
- Can Today's Forecast show a separately labeled forecasted eating budget?
- How are forecasted and confirmed eating budgets visually distinguished?
- Which behavioral signals make the feature eligible?
- Where is it manually discoverable?
- Can it trigger notifications?
- What safeguards prevent exercise-for-food framing?
- How should completed-day reconciliation be presented?
- How does an adjustment-policy change affect an open day's guidance?

These decisions block implementation of a numeric Today's Eating Budget. They do not block the finalized bank, Today So Far, Today's Forecast design work, or other approved V1 capabilities.

## Consequences

- Existing blanket prohibitions on `calories remaining` are narrowed. A generic remaining-calories or bank-remaining value remains prohibited; the explicitly labeled `Remaining Today` value is allowed only inside this capability.
- Existing current-day and finalized-bank read models remain unchanged until a separate implementation milestone approves contracts.
- Today's Eating Budget must be independently available, stale, or unavailable without changing Available Bank.
- No schema, API, calculation utility, dashboard card, notification, or analytics implementation is approved by this documentation-only decision.
