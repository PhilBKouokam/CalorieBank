# ADR 011: Progressive Feature Discovery

Date: 2026-07-24

## Status

Accepted as V1 product and UX policy. ADR 014 extends this policy with familiarity, complementarity, and pacing requirements. Recommendation thresholds, persistence, and delivery mechanics remain open.

## Context

CalorieBank V1 includes banking, explanation, planning, current-day awareness, forecasting, optional reserve, recovery, and personalization capabilities. Showing every capability during onboarding or on a new user's first Today screen would increase cognitive load before the user understands the core bank.

Feature scope and first-use visibility are different decisions. A capability may be implemented and available in V1 without being immediately visible, automatically recommended, or activated for every new user.

## Decision

CalorieBank adopts **Progressive Feature Discovery** as a core product principle:

> Complexity should be earned, not imposed.

Capabilities should be introduced when they are likely to provide immediate, understandable value. Progressive discovery exists to reduce cognitive load, not to create artificial lockouts, maximize engagement, or manipulate users into returning.

Progressive Feature Discovery determines when a capability is relevant. Progressive Familiarity under ADR 014 determines whether the user is ready to learn it and whether it complements the current workflow.

Every proactive introduction requires three independent gates:

1. **Relevance:** the feature solves a current problem.
2. **Familiarity:** meaningful interaction indicates the user can comfortably adopt another concept.
3. **Complementarity:** the feature extends the current workflow rather than redirecting it.

If any gate is not satisfied, the recommendation waits. Manual discovery and contextually mandatory information remain available.

The product must distinguish:

- **Available in V1:** implemented and supported within the approved V1 scope.
- **Initially visible:** shown during onboarding or on the first Today experience.
- **Relevant:** enough data or context exists for the feature to solve a current problem.
- **Familiar enough:** the user has meaningfully interacted with prerequisite concepts; account age, elapsed days, and session count alone are insufficient.
- **Complementary:** the capability is a natural next step in the current workflow.
- **Eligible for proactive recommendation:** relevance, familiarity, and complementarity are all satisfied.
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

No universal familiarity period is approved. Familiarity is not account age, days since signup, session count alone, or an arbitrary timer. Meaningful use, successful use of prior capabilities, natural revisits, appropriate explanation-view use, and explicit exploration may be conceptual evidence, but no score or threshold is approved.

## Contextual Discovery

Potential discovery signals include:

- Sufficient reliable history exists for a useful estimate.
- The user repeatedly opens current-day expenditure or relevant detail views.
- The user repeatedly reviews confirmed current-day intake or manually enables eating guidance.
- The user regularly increases activity during the day.
- A recognizable recurring activity appears in data the user authorized CalorieBank to use.
- The user creates, follows, searches for, or approaches a planned meal, treat, or event target.
- The user frequently uses most of Available Bank.
- An unexpected overage occurs.
- Recovery becomes necessary.
- The user explicitly expresses interest in a capability.

Signals are conceptual product inputs, not proof of intent, familiarity, or understanding and not approval for a machine-learning system. CalorieBank must not infer sensitive motives from weak or unrelated behavior.

Relevance alone is insufficient. Before recommending a relevant capability, product policy must also identify the prerequisite concept the user appears familiar with and explain how the recommendation complements the current workflow.

An optional introduction should explain why the feature is relevant now and offer appropriate controls such as `Enable`, `Learn more`, `Not now`, or `Dismiss`. Declining a recommendation must not impair the core banking experience. Available V1 features should be manually discoverable where practical rather than permanently hidden behind recommendation logic.

Prefer contextual explanations such as:

> Based on your recent walking data, Today's Forecast can help estimate how that pattern may affect your Projected Daily Burn.

> Your planned meal is not fully covered yet. See how your normal activity may affect the remaining planning gap.

> Your Available Bank covered most of yesterday's overage. An Emergency Bank can reserve part of future deposits for unexpected changes in plans.

Avoid generic or manipulative copy such as `Unlock another feature`, `Try this new tool`, or `You have been selected`.

## Pacing And Prioritization

CalorieBank should prefer depth of understanding over feature exposure. A newly introduced capability should generally have an opportunity to become familiar before another proactive recommendation appears.

If several features satisfy all three gates:

1. Recommend the one with the highest immediate value.
2. Delay the others.
3. Reevaluate after familiarity increases or context changes.

This is not approval for a fixed waiting period. Exact pacing, priority policy, and familiarity evidence remain open under ADR 014.

## Feature Treatment

### Today's Forecast And Projected Daily Burn

Today's Forecast, including Projected Daily Burn, is a V1 capability but is not required in onboarding or the initial Today experience.

It may become relevant after sufficient complete expenditure history exists and conditions apply, such as demonstrated interest in current-day expenditure, recurring activity patterns, or relevance to an active meal, treat, or event plan. Proactive introduction must also wait until the user can distinguish confirmed current-day values from an estimated Projected Daily Burn and the forecast complements the workflow already in use.

It may answer:

- What is my likely total expenditure by the end of today?
- How might an editable assumption about steps or a familiar activity affect that projection?
- How does today compare with my normal pattern?

It must remain an estimate. It must not be described as guaranteed expenditure, exact physiology, or a projected bank balance. No projected deposit, withdrawal, generic calories remaining, or midnight bank balance is approved. ADR 012's explicitly labeled `Remaining Today` is separate confirmed eating guidance, not a forecast result.

Users should adjust grounded assumptions rather than enter an arbitrary projected-burn number. Potential assumptions include expected final step count, duration of a familiar activity, whether a recurring activity is expected, or planned walking, running, cycling, or another supported activity. Exact controls and supported activities remain open.

Personalized activity averages may be displayed only when sufficient reliable history exists. They must be labeled as approximate historical averages, not constants. Whether these averages use raw provider expenditure, CalorieBank-adjusted expenditure, or both with clear labels remains an Open Product Decision.

### Today's Eating Budget

Today's Eating Budget is a V1 capability governed by ADR 012. It is not required during onboarding or on the Foundation-stage Today screen.

It may become relevant when reliable intra-day expenditure and intake exist and conditions apply, such as repeated current-day data checks, recurring increases in activity, engagement with Today's Forecast, relevance to an active plan, or manual enablement through Customize Today. Proactive introduction also requires familiarity with Available Bank and confirmed-versus-estimated data, plus a complementary current-day or planning workflow.

It must remain manually discoverable where practical. Eligibility signals are not proof that a user exercises to change food intake and do not approve a recommendation algorithm.

Discovery copy should explain that confirmed expenditure can change current-day eating flexibility while the finalized bank remains separate. It must not use `unlock calories`, `earn food`, `burn this to eat that`, or exercise-punishment language.

### Planning

The Planning Database and planned meal or Planned Treat capabilities remain in V1. They need not all appear during first use.

Planning may become relevant after the user builds an Available Bank, expresses interest in a future food or event, creates or searches for a planning item, or approaches a defined target. Proactive introduction must also fit a workflow the user already understands. Planning remains separate from Food Tracking: planning estimates are not confirmed intake and do not directly change the bank.

Banking Goals is a post-foundation V1 Planning capability governed by ADR 013. It may become relevant when the user has finalized Available Bank calories to organize, creates more than one plan, wants to prioritize an upcoming event without abandoning a longer-term plan, or manually opens Planning, Available Bank details, or Customize Today. A proactive introduction additionally requires familiarity with Available Bank and Planning and must complement an existing multi-plan workflow.

Banking Goals must not be mandatory onboarding. A recommendation may explain that the capability reserves portions of one Available Bank for user-created purposes, but it must not imply separate banks, extra calories, or inferred private intentions. Goals should remain manually discoverable where practical; exact placement is open.

### Emergency Bank

Emergency Bank remains optional. It may be offered as a lightweight onboarding choice only when that does not overload required setup, or later after the user understands Available Bank, after repeated near-zero balances or an unexpected overage, or when the user asks for more protection. Proactive introduction requires all three ADR 014 gates.

Discovery must frame Emergency Bank as optional preparation for unpredictable life events, not as a requirement or fear-based warning. Manual access through an intentional settings or navigation surface must remain possible under the final UX decision.

### Recovery Forecast

Recovery Forecast is contextually activated when Available Bank and any enabled Emergency Bank cannot fully cover a negative change. It is not a promotional feature that users must discover or enable beforehand.

Recovery continues to use a non-negative Available Bank display, a realistic path forward, the user's normal behavior when sufficient data exists, and progress-oriented rather than punishment-oriented language.

## Home Evolution

The home experience may evolve conceptually:

- **Foundation:** Available Bank, latest finalized contribution, calculation explanation, and current data status.
- **Familiarity:** Today-so-far intake and expenditure, Today's Eating Budget when reliable and useful, simplified history, and Planned Treat or meal progress.
- **Planning:** Planning Database, progress toward a desired food or event, and Banking Goals for organizing finalized Available Bank calories when relevant.
- **Forecasting:** Today's Forecast, Projected Daily Burn, editable activity assumptions, and personal activity averages.
- **Protection or recovery:** Emergency Bank when enabled or relevant, and Recovery Forecast whenever required.

These are not fixed chronological levels. Users may skip stages, enable features manually, or enter a contextually necessary state at any time. Available Bank remains mandatory, visible, and first.

The stages do not establish familiarity automatically. Moving between them is not an unlock system, and users do not complete levels.

## Notifications

The meaningful morning bank update remains the primary V1 notification.

Feature-discovery notifications are permitted only when all three ADR 014 gates are satisfied, notification permission covers the message, immediate planning value exists, pacing permits another introduction, and an in-app introduction would not be more appropriate. Generic feature advertising and frequent engagement prompts are not approved.

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

Users should be able to dismiss optional introductions, retain the core experience, and manually find appropriate available features. Progressive Familiarity governs proactive recommendations, not permission to use a feature. Intentional exploration must not be blocked by a familiarity gate. The exact suppression and permanent-disable policies are open.

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
- Whether recommendations arrive after prerequisite concepts are understood and extend the user's current workflow.
- Whether multiple eligible recommendations are paced rather than stacked.
- Recommendation acceptance, dismissal, manual discovery, and later activation.
- Whether important capabilities feel hidden.
- Whether introductions become repetitive or annoying.
- Whether Today's Forecast appears only with sufficient data.
- Whether users understand personalized averages as approximate.
- Whether users distinguish Projected Daily Burn from a guaranteed result and understand that no Projected Bank exists.
- Whether users distinguish Today's Eating Budget and Remaining Today from Available Bank and forecasted expenditure.
- Whether users understand Banking Goals as allocations within one Available Bank rather than independent balances.
- Whether progressive discovery improves trust and usefulness rather than engagement volume.

Engagement metrics alone do not prove product value.

## Consequences

- V1 scope lists feature availability; it no longer implies first-use visibility.
- Existing visible-by-default supporting-card guidance is superseded. Available Bank remains mandatory and first; initial optional-card visibility is governed by this ADR and more specific UX decisions.
- Existing broad rejections of all current-day forecasts are narrowed to projected bank results. A qualified Projected Daily Burn is approved for V1 progressive discovery, while the official bank remains finalized-only.
- Implementations may require later discovery-state persistence, recommendation policy, manual-discovery navigation, and dashboard-default migrations. This ADR does not approve a schema.
- Implementations may also require capability-specific familiarity and complementarity evidence, but ADR 014 does not approve a scoring system or machine-learning model.
- Existing implemented features may remain manually accessible even when removed from the default first-use surface.

## Open Product Decisions

- What defines sufficient familiarity with the core bank?
- How should familiarity be measured without relying on account age, elapsed days, or session count alone?
- Which interactions represent genuine understanding rather than accidental use?
- Should familiarity decay after long inactivity?
- How long should the system wait between recommendations?
- How should multiple eligible discoveries be prioritized?
- How should accessibility needs influence pacing?
- What minimum data is required for Today's Forecast?
- What minimum data is required for personalized activity averages?
- What minimum confirmed data and provider semantics are required for Today's Eating Budget?
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
- What happens when Today's Eating Budget loses sufficient intake or expenditure data?
- Which approved signals make Banking Goals eligible, and where is it manually discoverable?
- Does dismissing a Banking Goals introduction use the general suppression policy or a capability-specific policy?
- Which features, beyond Recovery Forecast and required transparency, are contextually mandatory?
- Do personalized activity averages show raw provider values, CalorieBank-adjusted values, or both with clear labels?
- What success metrics distinguish user value from engagement manipulation?

These decisions do not block continued implementation of the core banking loop. They block automated feature-recommendation behavior and production forecast discovery until resolved.
