# ADR 011: Progressive Feature Discovery

Date: 2026-07-24

## Status

Accepted as V1 product and UX policy. Recommendation thresholds, persistence, and delivery mechanics remain open.

## Context

CalorieBank V1 includes banking, explanation, planning, current-day awareness, forecasting, optional reserve, recovery, and personalization capabilities. Showing every capability during onboarding or on a new user's first Today screen would increase cognitive load before the user understands the core bank.

Feature scope and first-use visibility are different decisions. A capability may be implemented and available in V1 without being immediately visible, automatically recommended, or activated for every new user.

## Decision

CalorieBank adopts **Progressive Feature Discovery** as a core product principle:

> Complexity should be earned, not imposed.

Capabilities should be introduced when they are likely to provide immediate, understandable value. Progressive discovery exists to reduce cognitive load, not to create artificial lockouts, maximize engagement, or manipulate users into returning.

The product must distinguish:

- **Available in V1:** implemented and supported within the approved V1 scope.
- **Initially visible:** shown during onboarding or on the first Today experience.
- **Eligible for recommendation:** enough relevant data or context exists to make an introduction useful.
- **Recommended:** an optional, explainable introduction has been presented.
- **Manually discoverable:** reachable through navigation or settings without waiting for a recommendation.
- **Enabled:** activated by an explicit user choice when activation is required.
- **Contextually activated:** shown because the current state requires it, such as Recovery Forecast.
- **Temporarily unavailable or irrelevant:** insufficient data or context currently prevents useful use.

These are conceptual product states, not an approved database schema. Recommendation presentation must be idempotent and must not repeatedly show the same introduction without an approved re-prompt policy.

## Initial Experience

The first-use experience should present the smallest understandable form of the banking loop:

- Available Bank.
- Latest finalized daily contribution.
- A concise, accessible route to the selected-day calculation explanation.
- Clear disclosure of CalorieBank's conservative `0.80` expenditure adjustment.
- Data source, freshness, missing-input, or calculation status when needed for trust.

Connection-first setup and required goal configuration remain onboarding requirements. Optional planning, forecasting, reserve, and personalization configuration should not crowd setup merely because those capabilities belong to V1.

Before recommending advanced features, CalorieBank should generally help the user understand:

1. Where imported calorie data comes from.
2. How a finalized daily contribution is calculated.
3. Why the `0.80` expenditure adjustment is applied.
4. What Available Bank represents.
5. Why the current day is incomplete until sufficient data is finalized.
6. Why planning estimates do not directly change the bank.

No universal familiarity period is approved. Elapsed time may be relevant, but sufficient data, user understanding, explicit interest, and contextual need are more important than an arbitrary day count.

## Contextual Discovery

Potential discovery signals include:

- Sufficient reliable history exists for a useful estimate.
- The user repeatedly opens current-day expenditure or relevant detail views.
- The user regularly increases activity during the day.
- A recognizable recurring activity appears in data the user authorized CalorieBank to use.
- The user creates, follows, searches for, or approaches a planned meal, treat, or event target.
- The user frequently uses most of Available Bank.
- An unexpected overage occurs.
- Recovery becomes necessary.
- The user explicitly expresses interest in a capability.

Signals are conceptual product inputs, not proof of intent and not approval for a machine-learning system. CalorieBank must not infer sensitive motives from weak or unrelated behavior.

An optional introduction should explain why the feature is relevant now and offer appropriate controls such as `Enable`, `Learn more`, `Not now`, or `Dismiss`. Declining a recommendation must not impair the core banking experience. Available V1 features should be manually discoverable where practical rather than permanently hidden behind recommendation logic.

Prefer contextual explanations such as:

> Based on your recent walking data, Today's Forecast can help estimate how that pattern may affect your Projected Daily Burn.

> Your planned meal is not fully covered yet. See how your normal activity may affect the remaining planning gap.

> Your Available Bank covered most of yesterday's overage. An Emergency Bank can reserve part of future deposits for unexpected changes in plans.

Avoid generic or manipulative copy such as `Unlock another feature`, `Try this new tool`, or `You have been selected`.

## Feature Treatment

### Today's Forecast And Projected Daily Burn

Today's Forecast, including Projected Daily Burn, is a V1 capability but is not required in onboarding or the initial Today experience.

It may become eligible after sufficient complete expenditure history exists and one or more relevant conditions apply, such as demonstrated interest in current-day expenditure, recurring activity patterns, or relevance to an active meal, treat, or event plan.

It may answer:

- What is my likely total expenditure by the end of today?
- How might an editable assumption about steps or a familiar activity affect that projection?
- How does today compare with my normal pattern?

It must remain an estimate. It must not be described as guaranteed expenditure, exact physiology, or a projected bank balance. No projected deposit, withdrawal, calories remaining, or midnight bank balance is approved.

Users should adjust grounded assumptions rather than enter an arbitrary projected-burn number. Potential assumptions include expected final step count, duration of a familiar activity, whether a recurring activity is expected, or planned walking, running, cycling, or another supported activity. Exact controls and supported activities remain open.

Personalized activity averages may be displayed only when sufficient reliable history exists. They must be labeled as approximate historical averages, not constants. Whether these averages use raw provider expenditure, CalorieBank-adjusted expenditure, or both with clear labels remains an Open Product Decision.

### Planning

The Planning Database and planned meal or Planned Treat capabilities remain in V1. They need not all appear during first use.

Planning may be introduced after the user builds an Available Bank, expresses interest in a future food or event, creates or searches for a planning item, or approaches a defined target. Planning remains separate from Food Tracking: planning estimates are not confirmed intake and do not directly change the bank.

### Emergency Bank

Emergency Bank remains optional. It may be introduced as a lightweight onboarding choice, later after the user understands Available Bank, after repeated near-zero balances or an unexpected overage, or when the user asks for more protection.

Discovery must frame Emergency Bank as optional preparation for unpredictable life events, not as a requirement or fear-based warning. Manual access through an intentional settings or navigation surface must remain possible under the final UX decision.

### Recovery Forecast

Recovery Forecast is contextually activated when Available Bank and any enabled Emergency Bank cannot fully cover a negative change. It is not a promotional feature that users must discover or enable beforehand.

Recovery continues to use a non-negative Available Bank display, a realistic path forward, the user's normal behavior when sufficient data exists, and progress-oriented rather than punishment-oriented language.

## Home Evolution

The home experience may evolve conceptually:

- **Foundation:** Available Bank, latest finalized contribution, calculation explanation, and current data status.
- **Familiarity:** Today-so-far intake and expenditure, simplified history, and Planned Treat or meal progress when useful.
- **Planning:** Planning Database, progress toward a desired food or event, and relevant planning guidance.
- **Forecasting:** Today's Forecast, Projected Daily Burn, editable activity assumptions, and personal activity averages.
- **Protection or recovery:** Emergency Bank when enabled or relevant, and Recovery Forecast whenever required.

These are not fixed chronological levels. Users may skip stages, enable features manually, or enter a contextually necessary state at any time. Available Bank remains mandatory, visible, and first.

## Notifications

The meaningful morning bank update remains the primary V1 notification.

Feature-discovery notifications are permitted only when the feature is highly relevant, notification permission covers the message, immediate planning value exists, and an in-app introduction would not be more appropriate. Generic feature advertising and frequent engagement prompts are not approved.

Exact category eligibility, notification limits, cooldowns, and re-prompt behavior remain open. ADR 005 continues to govern Activity Opportunity recommendations and their stronger consent, safety, estimation, and fatigue requirements.

## User Control And Anti-Manipulation

Progressive discovery must not:

- Require streaks to access useful capabilities.
- Hide essential explanations behind usage milestones.
- Make users earn safety information.
- Create false scarcity around ordinary V1 features.
- Use unpredictable rewards.
- Repeatedly prompt after dismissal.
- Optimize app opens or screen time as the primary measure of success.

Users should be able to dismiss optional introductions, retain the core experience, and manually find appropriate available features. The exact suppression and permanent-disable policies are open.

## Transparency And Safety

Progressive discovery does not apply to information required for safe, trustworthy use. CalorieBank must never withhold:

- How the bank is calculated.
- The `0.80` expenditure-adjustment policy.
- Data-source and synchronization status.
- Missing, incomplete, corrected, or erroneous data.
- Manual corrections.
- Safety disclaimers.
- The distinction between estimates and confirmed data.
- Recovery guidance when recovery is already active.
- Important integration failures.

## Privacy And Explainability

Behavior-based recommendations may use only data legitimately available under approved permissions. Explanations should refer to limited, visible evidence, such as `Based on your recent walking data`, rather than invasive claims.

CalorieBank must not claim access to activity types, health records, location, calendars, or other data without a supported integration and permission. Technical sources for unresolved signals must be approved before implementation.

## Validation

First-user validation should evaluate:

- Whether the initial experience feels simple.
- Whether users understand the bank before optional features appear.
- Whether recommendations feel relevant and explain why they appeared.
- Recommendation acceptance, dismissal, manual discovery, and later activation.
- Whether important capabilities feel hidden.
- Whether introductions become repetitive or annoying.
- Whether Today's Forecast appears only with sufficient data.
- Whether users understand personalized averages as approximate.
- Whether users distinguish Projected Daily Burn from a guaranteed result and understand that no Projected Bank exists.
- Whether progressive discovery improves trust and usefulness rather than engagement volume.

Engagement metrics alone do not prove product value.

## Consequences

- V1 scope lists feature availability; it no longer implies first-use visibility.
- Existing visible-by-default supporting-card guidance is superseded. Available Bank remains mandatory and first; initial optional-card visibility is governed by this ADR and more specific UX decisions.
- Existing broad rejections of all current-day forecasts are narrowed to projected bank results. A qualified Projected Daily Burn is approved for V1 progressive discovery, while the official bank remains finalized-only.
- Implementations may require later discovery-state persistence, recommendation policy, manual-discovery navigation, and dashboard-default migrations. This ADR does not approve a schema.
- Existing implemented features may remain manually accessible even when removed from the default first-use surface.

## Open Product Decisions

- What defines sufficient familiarity with the core bank?
- What minimum data is required for Today's Forecast?
- What minimum data is required for personalized activity averages?
- Which signals are approved for each feature?
- Which available features are manually accessible before recommendation?
- Where are undiscovered features visible, if anywhere?
- How long should a dismissed recommendation remain suppressed?
- Can users permanently disable feature recommendations?
- How many feature recommendations may be active at once?
- Can more than one feature be introduced during the same week?
- Which recommendations may use push notifications?
- How is recommendation relevance measured without treating engagement as the goal?
- How are false or inaccurate behavioral inferences corrected?
- How are discovery states stored?
- How do users reset or revisit feature introductions?
- How are returning users handled after long inactivity?
- How are users with imported historical data treated?
- Does imported history make a new user immediately eligible for advanced features?
- What happens when a forecast loses sufficient data?
- Which features, beyond Recovery Forecast and required transparency, are contextually mandatory?
- Do personalized activity averages show raw provider values, CalorieBank-adjusted values, or both with clear labels?
- What success metrics distinguish user value from engagement manipulation?

These decisions do not block continued implementation of the core banking loop. They block automated feature-recommendation behavior and production forecast discovery until resolved.
