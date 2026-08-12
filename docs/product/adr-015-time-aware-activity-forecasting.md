# ADR 015: Time-Aware Activity Forecasting

Date: 2026-08-11

## Status

Accepted as an advanced, progressively revealed V1 capability within Today's Forecast.

This ADR approves the product purpose, boundaries, readiness gates, conceptual inputs, and user-facing principles. It does not approve a production formula, forecast-confidence threshold, data model, API, notification, provider field, or recommendation engine. The implementation-blocking decisions are listed below.

## Context

Today's Forecast and Projected Daily Burn currently describe estimated end-of-day expenditure using confirmed current-day data and editable assumptions. A useful forecast must also account for how much opportunity remains in the user's day.

The timing insight must be stated accurately:

> Earlier activity can increase the user's remaining flexibility because more time remains in the day for resting expenditure, incidental movement, additional steps, and optional activities.

CalorieBank must not claim that the same activity or identical step count intrinsically burns substantially more calories merely because it happened earlier. Timing changes the remaining planning window and the set of feasible actions, not the intrinsic expenditure of identical completed activity.

## Decision

**Time-Aware Activity Forecasting** is an advanced layer inside Today's Forecast. It converts a static end-of-day estimate into optional planning guidance that considers current pace, remaining time, and realistic alternative scenarios.

It may help answer:

- Whether the user is on track for a selected end-of-day expenditure target.
- What pace or approximate milestone could keep the current plan feasible.
- Whether walking alone remains a realistic path at the user's usual pace.
- Whether a familiar activity fits in the remaining day and could change the forecast.
- When the original plan may need to change.

It remains estimated, ledger-neutral planning guidance.

## Relationship To Existing Concepts

| Concept | Question answered | Authority |
| --- | --- | --- |
| Available Bank | What finalized calorie savings are available? | Finalized, ledger-backed historical balance. |
| Today's Eating Budget | How much can I eat today while still targeting the configured daily bank contribution? | Current-day guidance using confirmed inputs and any clearly labeled approved estimate; not ledger-backed. |
| Projected Daily Burn | Based on confirmed data and forecast assumptions, what expenditure might I reach by day end? | Estimated output inside Today's Forecast. |
| Time-Aware Activity Forecasting | Given the current time and pace, what might keep a selected forecast or burn target feasible, and by approximately when? | Advanced estimated guidance inside Today's Forecast. |

These concepts must remain visually and mathematically distinct.

Time-Aware Activity Forecasting must never produce or imply:

- A Projected Bank.
- Future deposited calories.
- A projected withdrawal.
- Projected Banking Goal funding.
- A guaranteed bank contribution.
- A guaranteed food allowance based on uncompleted activity.

Only confirmed provider data and completed-day posting under the bank policy may affect Available Bank or Banking Goals.

## Conceptual Inputs

When reliable data exists, the forecast may conceptually consider:

- Current local time and the approved day boundary.
- Confirmed provider expenditure so far.
- Adjusted confirmed expenditure under the `0.80` policy.
- Current steps.
- Historical step accumulation by time of day.
- Historical adjusted expenditure per 1,000 steps.
- Expected remaining baseline or resting expenditure.
- Historical expenditure accumulation by hour or time of day.
- Familiar activity ranges, duration, and typical timing.
- A user-selected activity assumption.
- An optional user-selected or otherwise explicitly approved end-of-day expenditure target.
- The current Projected Daily Burn.
- Remaining time in the active day.
- Provider freshness and uncertainty.

No provider is assumed to supply every input. Provider-specific fields must remain inside adapters, and unsupported inputs must produce simpler or unavailable guidance rather than invented values.

## Conceptual Forecast Model

The planning concept is:

```text
remaining_day_window =
  approved_user_day_end - current_time

projected_end_of_day_expenditure =
  confirmed_adjusted_expenditure_so_far
  + expected_remaining_baseline_expenditure
  + expected_remaining_activity_expenditure
```

This is not an authoritative production formula. The repository does not yet resolve:

- How remaining baseline or resting expenditure is estimated.
- Whether and how provider totals can support an hourly forecast.
- The user's active-day boundary beyond the existing local-calendar-day accounting boundary.
- How step-derived and activity-derived hypothetical increments avoid overlap with confirmed provider expenditure and with each other.
- The deterministic forecasting method and uncertainty model.

The approved `0.80` expenditure-credit policy remains centralized. Confirmed provider total expenditure is adjusted once. A future hypothetical increment must use one documented policy and rounding boundary; it must not receive duplicate credit or be stacked over expenditure that already includes it.

## Two Kinds Of Readiness

Time-Aware Activity Forecasting has two independent readiness requirements.

### Forecast Confidence Gate: Is CalorieBank Ready?

Before calculating precise-looking time-aware guidance, CalorieBank must determine conceptually whether:

```text
sufficient personal history
AND current provider data is sufficiently fresh
AND required inputs are available
AND uncertainty is acceptable
```

If this gate fails, the product should retain a simpler Projected Daily Burn or show an honest limited state:

```text
Projected Burn
~3,050 kcal

We need more of your activity history before showing
personalized time-of-day pacing.
```

No threshold, score, confidence label algorithm, or minimum history duration is approved.

### Progressive Familiarity Gate: Is The User Ready?

Sufficient data does not establish user readiness. Proactive introduction additionally requires all ADR 014 gates:

```text
Forecast confidence sufficient
AND feature relevant
AND user familiar enough
AND feature complements the current workflow
```

Likewise, user familiarity cannot compensate for inadequate data confidence. Both forms of readiness are mandatory for proactive introduction.

Potential relevance signals include repeated use of Today's Forecast, editing step or activity assumptions, checking current expenditure, comparing planned and actual burn, pursuing a user-selected burn target, using Today's Eating Budget alongside activity, or manually exploring advanced forecast controls.

Potential familiarity indicators include successful use of the basic forecast, understanding Available Bank versus current-day guidance, comfort editing assumptions, use of explanation views, and successful use of previously introduced planning capabilities.

These are conceptual signals, not proof of motivation or approved tracking logic. Account age, elapsed days, session count alone, and sufficient provider history do not prove user familiarity.

## Progressive Depth Within Today's Forecast

Today's Forecast may deepen without becoming separate gamified levels:

1. **Basic forecast:** a qualified Projected Daily Burn.
2. **Editable assumptions:** expected steps or activity duration scenarios.
3. **Familiar activities:** personal historical ranges for recurring activities.
4. **Time-aware pace guidance:** an approximate checkpoint tied to a selected target.
5. **Feasibility alternatives:** walking-only and familiar-activity scenarios when the current plan is below target.

These stages are conceptual. Users need not follow them in order, complete every stage, or see stage labels. Users may remain on the simpler forecast, dismiss the advanced introduction, manually explore it where practical, remove assumptions, change a target, and return to default assumptions.

The product should generally allow familiarity with the existing forecast before introducing advanced pacing. Closely related forecast capabilities may be introduced together only when that relationship is complementary, the prior concept is understood, and combining them reduces cognitive load. Exact pacing remains open.

## Burn-Target Feasibility

The advanced forecast may compare a current projection with an optional end-of-day expenditure target. It should use qualified states such as:

- On track.
- Ahead of current pace.
- Slightly behind current pace.
- Current walking plan projects approximately X.
- Target may require additional activity.
- Walking alone is unlikely to reach the target within the remaining day at the user's usual pace.
- Low confidence.
- Insufficient data.

Avoid `guaranteed`, `impossible`, `you must`, or claims that the final result is known.

If the user is on track, the product should be comfortable saying:

> You're currently on track. No additional activity is needed for this forecast.

The system must not continuously optimize toward higher expenditure or treat exceeding a selected target as a competition.

## Approximate Pace And Latest-Time Guidance

With sufficient confidence, the forecast may offer an approximate checkpoint:

```text
To stay near your current plan for ~3,500 kcal:

Reach approximately 21,000 steps by 4:30 PM
```

The checkpoint represents the point at which the user's typical remaining baseline and activity pattern may still support the selected target. It does not mean activity after that time stops burning calories, that 4:31 PM changes physiology, or that earlier identical steps receive more calorie credit.

Checkpoints must be personalized where possible and qualified with `approximately`, `around`, or a range. Universal milestones such as `10,000 steps by noon` are not approved.

## Walking And Familiar-Activity Scenarios

Walking-only feasibility should use the user's own historical step pace and step-to-expenditure relationship when sufficiently reliable. If walking alone is unlikely to close the gap within the remaining time at the user's usual pace, say so without declaring the target impossible.

The forecast may then show optional familiar-activity scenarios, for example:

```text
Current forecast                 ~3,050 kcal
Selected target                  3,500 kcal

+ 5,000 steps                   -> ~3,280 kcal
+ Usual evening walk            -> ~3,330 kcal
+ Familiar gym session          -> ~3,540 kcal
```

Familiar activities may use approximate historical adjusted-expenditure ranges, typical durations, and historical timing. They may be considered only when the activity realistically fits the remaining window. No minimum observation count, recognition policy, duration model, or ranking method is approved.

Scenarios are optional assumptions, not required actions or actual expenditure. The user must be able to remove them.

## Confirmed Versus Hypothetical Expenditure

The forecast must identify:

- Confirmed provider expenditure so far.
- The `0.80` adjustment applied to confirmed total expenditure.
- Estimated remaining baseline expenditure, if used.
- Hypothetical step or activity increments.
- Forecast range or estimate.
- Confidence and freshness.

Confirmed provider totals remain the source of truth. Hypothetical activity must be modeled as an unconfirmed scenario and must not be stored as actual provider expenditure or written to the ledger.

Do not independently add overlapping:

- Provider total expenditure.
- Active energy.
- Basal or resting energy.
- Workout calories.
- Step-derived expenditure.
- Familiar-activity averages.

A forecasting implementation must define non-overlapping baselines and increments before numeric output is approved. Steps and workout calories remain context in the existing ingestion and banking architecture.

## Relationship To Today's Eating Budget

Today's Eating Budget may change from confirmed current-day expenditure under its separately approved policy. Time-aware scenarios remain hypothetical and must not silently increase confirmed Today's Eating Budget or Remaining Today.

If a future forecasted eating-flexibility value is approved, it must be separately labeled from confirmed guidance. ADR 012 keeps that decision open.

## Relationship To Banking Goals

Forecasted activity cannot fund or allocate Banking Goals. A goal may eventually show qualified planning context about possible progress after finalization, but unconfirmed calories must never appear saved, allocated, or ready.

## Relationship To The Activity Opportunity Engine

The two systems are related but have different responsibilities:

- **Time-Aware Activity Forecasting** evaluates the user's selected forecast, current pace, remaining time, and optional scenarios inside Today's Forecast.
- **Activity Opportunity Engine** may later generate structured activity candidates based on a Planned Treat, preferences, timing, consent, and notification policy.

The forecast may consume an already valid familiar-activity estimate or present user-selected alternatives. It must not duplicate notification delivery, preference consent, fatigue controls, or candidate-generation policy. A future shared deterministic activity-estimation service may support both systems, but its numerical model and ownership remain open.

## Freshness And Provider Corrections

Specific time guidance requires sufficiently fresh current-day data. When stale, the product should fall back:

```text
Today's Forecast

Last activity update: 2h 18m ago

Time-aware pacing is temporarily unavailable
until your activity data refreshes.
```

Provider corrections may increase or decrease the projection, change pace guidance, or make a scenario no longer applicable. The product should explain meaningful changes concisely, for example:

> Your forecast changed after your activity provider updated today's expenditure.

A prior forecast must never be presented as a promise.

## Day Boundaries And Time Zones

Forecast calculations must use the user's approved local day boundary and preserve the timezone associated with source data. The existing banking pipeline uses local calendar dates and local midnight for provisional posting. That accounting rule does not by itself resolve the active-day window needed by this forecast.

Before implementation, product and architecture must resolve standard midnight behavior, overnight workers, activity across midnight, travel, timezone changes, and daylight-saving transitions. A timezone change must not rewrite finalized bank records.

## Consumer Presentation

A conceptual advanced card may show:

```text
Today's Forecast

Burn so far
2,180 kcal

Projected burn
~3,120 kcal

Goal
3,500 kcal

You're slightly behind your current walking pace.

To stay near your target:
Reach ~21,000 steps by 4:30 PM

Explore another activity
```

The exact design is not approved. The default surface should remain concise. An explanation view may disclose confirmed expenditure, adjustment policy, current time, expected remaining baseline, current steps, historical patterns, target, assumptions, familiar-activity estimates, forecast range, confidence, data freshness, and which values are confirmed versus estimated.

Avoid raw internal identifiers, provider payload fields, or unnecessary formula detail on the default card.

## Discovery And User Control

Preferred introduction copy is equivalent to:

> We now have enough of your activity history to make Today's Forecast more personal. See how your current pace and remaining time affect your end-of-day estimate.

Avoid `unlocked`, `advanced mode`, `power user`, `level up`, `maximize your burn`, or pressure to increase activity.

Users must be able to dismiss the recommendation, continue with the simpler forecast, manually explore advanced forecasting where practical, change or remove assumptions, change the selected target, and restore default forecast assumptions.

## Notifications

Time-aware guidance should be primarily in-app. This ADR does not approve forecast notifications. Any future notification requires explicit consent, a useful action window, freshness, both readiness gates, ADR 005 fatigue controls, and non-punitive language. It must not compete with the morning bank update or repeatedly pressure the user to exercise.

## Health And Behavioral Safety

Time-Aware Activity Forecasting is optional planning guidance, not medical advice or an exercise prescription.

Avoid:

- `Burn more so you can eat.`
- `Work off your meal.`
- `Earn another 600 calories.`
- `You must walk this much.`
- Punishment, debt, failure, or compensation framing.

Prefer:

- `Your current plan projects...`
- `If you want to explore a higher burn target...`
- `This activity could change your forecast...`
- `You're already on track.`
- `No additional activity is needed for your selected target.`

The product must not encourage extreme exercise, maximal calorie burn, or continuously increasing targets. Numerical safety limits and overexercise interventions require separate approved policy; this ADR does not infer medical risk from ordinary behavior.

## Validation

Research should evaluate whether users:

- Distinguish confirmed burn, projected burn, and selected target.
- Understand that checkpoints are approximate.
- Avoid the false belief that earlier identical activity intrinsically burns more.
- Understand why remaining time affects feasibility.
- Distinguish confirmed provider data from hypothetical activity.
- Understand familiar-activity ranges as estimates.
- Understand forecast confidence, insufficient-data, and stale states.
- Understand walking-only versus mixed-activity scenarios.
- Feel supported rather than pressured to exercise.
- Can remain on or return to the simpler forecast.
- Keep Today's Eating Budget, Available Bank, and Banking Goals distinct.
- Receive the advanced introduction at an appropriate familiarity level.
- Use the feature for a real planning decision.

Engagement alone is not evidence of value or understanding.

## Open Product Decisions

- What minimum historical data is required for advanced time-aware forecasting?
- How is forecast confidence calculated?
- What confidence threshold enables advanced guidance?
- How fresh must provider data be?
- What exact data supports hourly baseline expenditure?
- How is remaining resting expenditure estimated?
- How is step accumulation modeled by time of day?
- How is personalized step pace calculated?
- How are familiar activities recognized?
- What minimum repeated observations establish a familiar activity?
- How are activity duration and expenditure ranges calculated?
- Are forecasts expressed as a point estimate, range, or both?
- Can the user set a daily burn target manually?
- May CalorieBank infer a burn target from Today's Eating Budget behavior, or must targets always be explicit?
- Do burn targets persist across days?
- Can targets vary by day?
- What tolerance defines `on track`, `ahead`, and `behind`?
- How is a latest useful milestone time calculated?
- Should the app show one milestone or multiple checkpoints?
- How often may time-aware guidance update?
- Should guidance change continuously or only after meaningful changes?
- How much must the forecast change before the UI updates?
- How are provider corrections communicated?
- What happens when a familiar activity no longer fits in the remaining time?
- Can the forecast show multiple activity alternatives?
- How are alternatives ranked?
- Can users exclude activities from forecast alternatives?
- How are unusually intense activity days handled?
- What is the user's active-day boundary for forecasting?
- How are overnight users handled?
- What happens across timezone changes?
- How does daylight-saving time affect the remaining-day calculation?
- What happens when provider data is incomplete?
- Is advanced time-aware forecasting manually accessible before proactive eligibility?
- Which relevance signals are approved?
- Which familiarity signals are approved?
- How much familiarity with the basic forecast is required?
- What meaningful interaction should separate progressive forecast introductions?
- Can two closely related forecast capabilities be introduced together?
- How is overexercise risk handled without unsupported health inference?
- What shared estimation boundary, if any, connects this capability to the Activity Opportunity Engine?
- What retention, privacy, and deletion policy applies to hourly personal patterns and familiar-activity history?

These decisions block numeric production implementation and automated proactive introduction. They do not block continued use of current-day confirmed awareness, the simpler conceptual Today forecast, or finalized banking.

## Consequences

- Time-Aware Activity Forecasting remains part of Today's Forecast rather than a new bank or independent top-level product.
- Remaining time is a first-class planning input, while identical completed activity is not credited differently based only on time of day.
- System data confidence and user readiness are independent gates; one never implies the other.
- The `0.80` policy, finalized Available Bank, current-day ledger isolation, no-double-counting rule, and Projected Bank prohibition remain unchanged.
- Today's Eating Budget, Banking Goals, and the Activity Opportunity Engine retain their existing responsibilities.
- No production code, schema, migration, API, test, dependency, notification, or provider integration is approved by this ADR.
