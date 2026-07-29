# ADR 014: Progressive Familiarity

Date: 2026-07-28

## Status

Accepted as a governing CalorieBank product, UX, onboarding, dashboard, and recommendation principle.

Measurement thresholds, pacing intervals, prioritization, persistence, decay, and re-prompt behavior remain Open Product Decisions. This ADR defines product policy, not a schema, recommendation engine, or machine-learning system.

## Context

ADR 011 establishes Progressive Feature Discovery: V1 availability does not require immediate visibility, and optional capabilities should be introduced when relevant. Relevance alone does not establish that a user is ready to learn another concept or that the feature extends what they are already doing.

Introducing several relevant capabilities in rapid succession can recreate the cognitive load ADR 011 is intended to prevent. CalorieBank therefore needs a separate readiness and pacing principle without converting exploration into permissioned progression.

## Decision

CalorieBank adopts **Progressive Familiarity**:

> Features should be introduced only when they are relevant, complementary to the user's existing workflow, and the user has demonstrated enough familiarity to comfortably adopt them.

This principle applies throughout CalorieBank, not only during onboarding.

Progressive Feature Discovery asks:

> Is this feature relevant?

Progressive Familiarity asks:

> Is the user ready?

A proactive recommendation may occur only when three independent gates are satisfied:

1. **Relevance:** the feature addresses a problem the user is currently experiencing.
2. **Familiarity:** meaningful interaction indicates that the user can comfortably adopt another concept.
3. **Complementarity:** the feature naturally extends the user's current workflow instead of redirecting it.

If any gate is not satisfied, the proactive recommendation waits.

## Familiarity

Familiarity is not determined by:

- Account age.
- Days since signup.
- Session count alone.
- Arbitrary timers.

Potential conceptual indicators include:

- The user understands Available Bank.
- The user naturally revisits the same feature.
- The user successfully uses a previously introduced capability.
- The user demonstrates confidence with Planning.
- The user meaningfully interacts with Today's Eating Budget.
- The user uses Today's Forecast.
- The user reorganizes Banking Goals.
- The user opens explanation views when useful.

These are conceptual signals, not approved implementation requirements or proof of understanding. Accidental taps, passive exposure, isolated screen views, and raw session volume must not be treated as product mastery.

No universal familiarity score, event count, or time threshold is approved.

## Complementarity

A recommended feature should feel like the next natural step in an existing workflow.

Conceptual sequences include:

```text
Today's Eating Budget
-> Planning comparison

Planning
-> Banking Goals

Banking Goals
-> Move Allocation

Repeated priority changes
-> Default Withdrawal Source
```

These examples describe complementarity, not approved feature implementations. `Move Allocation` and `Default Withdrawal Source` remain subject to ADR 013's unresolved Banking Goals policies.

Do not recommend an unrelated capability merely because it is implemented, available, or generally useful. Complementarity requires a clear relationship to the user's current task, existing concept, or explicitly stated goal.

## Discovery Pacing

CalorieBank should prefer depth of understanding over feature exposure.

A newly introduced capability should generally have an opportunity to become familiar before another proactive introduction appears. This is not a fixed timer; the exact policy remains open.

When multiple features satisfy all three gates simultaneously:

1. Prioritize the feature with the highest immediate user value.
2. Delay the other recommendations.
3. Reevaluate them after familiarity with the selected feature increases or the user's context changes.

Do not stack introductions, compete with the core morning update, or present several new concepts as a setup checklist.

## Manual Discoverability

Progressive Familiarity governs proactive recommendations, not permission to use a capability.

Major available features should remain manually discoverable where practical. Users who intentionally explore navigation, Planning, settings, Available Bank details, or Customize Today must not be blocked by a familiarity gate.

Manual exploration may itself provide evidence of explicit interest, but it must not automatically prove understanding or opt the user into future recommendations.

Contextually mandatory experiences such as active Recovery Forecast, calculation errors, missing data, source failures, corrections, and safety information must never wait for familiarity.

## User Agency

Recommendations must be:

- Explainable.
- Relevant.
- Optional.
- Dismissible.
- Respectful of the user's pace.

Do not use `unlock`, completion levels, streak requirements, arbitrary progression, false scarcity, or gamified product mastery. The goal is confident use, not feature completion.

Declining or delaying a recommendation must not reduce access to the core banking experience. Repeated pressure after dismissal is prohibited unless a future re-prompt policy is explicitly approved.

## Feature Examples

### Today's Eating Budget To Planning

If a user meaningfully uses Today's Eating Budget and wants to evaluate a future meal, a Planning comparison may be relevant, familiar enough to understand, and complementary to the current eating-guidance workflow.

### Planning To Banking Goals

If a user understands Planning and has more than one user-confirmed purpose for finalized savings, Banking Goals may extend that workflow. An Available Bank balance or account age alone is not sufficient familiarity.

### Today's Eating Budget To Today's Forecast

Today's Forecast may be relevant when projected expenditure would help the user, but it should wait until the user can distinguish confirmed Today's Eating Budget guidance from estimated Projected Daily Burn.

### Contextual Recovery

Recovery Forecast remains contextually mandatory when required by the bank state. Familiarity does not delay recovery guidance.

## Onboarding And Dashboard Evolution

Onboarding remains focused on connection, required goal configuration, source understanding, and the core bank. Optional capabilities should not be introduced merely because the user completed setup.

Home evolution remains non-linear. Foundation, Familiarity, Planning, Forecasting, and Protection/Recovery describe possible product states, not levels to complete. Users may manually enter a later workflow, skip optional capabilities, or encounter a contextually necessary state.

The dashboard may expose manually enabled cards without proactively recommending them. Visibility eligibility and recommendation readiness are separate decisions.

## Privacy And Explainability

Familiarity and complementarity signals may use only data legitimately available under approved permissions and visible product interactions.

Recommendation explanations should cite limited, understandable context. Avoid claims that CalorieBank knows the user's motives, privately monitors behavior, or has inferred mastery from sensitive data.

No machine-learning system, hidden psychological profile, or sensitive intent inference is approved by this ADR.

## Validation

Research should evaluate:

- Whether recommendations arrive after users understand prerequisite concepts.
- Whether each recommendation feels like a natural extension of the current workflow.
- Whether users feel rushed by multiple introductions.
- Whether users can manually find features without waiting.
- Whether delayed recommendations improve understanding rather than merely reduce exposure.
- Whether the product distinguishes meaningful use from accidental interaction.
- Whether explanations for relevance and timing feel accurate.
- Whether accessibility needs are respected.
- Whether dismissal is honored.
- Whether product mastery, trust, and successful use improve without optimizing app opens.

## Open Product Decisions

- How should familiarity be measured?
- Which interactions represent genuine understanding rather than accidental use?
- Should familiarity decay after long inactivity?
- How long should the system wait between proactive recommendations?
- How should multiple eligible discoveries be prioritized?
- Should dismissed recommendations reappear?
- If re-prompting is allowed, what context change or evidence is required?
- How should accessibility needs influence pacing and evidence of familiarity?
- Should accessibility preferences permit slower pacing, alternate explanation formats, or user-selected pacing without being interpreted as lower understanding?
- Does explicit manual exploration satisfy familiarity, relevance, complementarity, or only signal interest?
- How should returning users be handled?
- How should imported historical data affect familiarity without implying product understanding?
- Can familiarity be capability-specific rather than global?
- How are prerequisite concepts defined for each recommendation?
- How should recommendation state be stored and reset?
- How many proactive recommendations may be active at once, and can more than one be introduced during the same week?
- Can users permanently disable proactive feature recommendations while retaining manual access?
- How should false familiarity or complementarity inferences be corrected?
- Which recommendations, if any, may bypass ordinary pacing besides contextually mandatory safety and recovery states?
- What validation measures distinguish product mastery from engagement?

These decisions block automated proactive recommendation behavior. They do not block manual feature access, the core bank, or contextually mandatory transparency and recovery.

## Consequences

- ADR 011 continues to govern relevance, V1 availability, first-use visibility, manual discovery, and contextual activation.
- This ADR adds readiness, complementarity, and pacing requirements to every proactive feature recommendation.
- Existing documentation that treats relevance alone as sufficient for proactive introduction is superseded.
- Existing statements that use account age, elapsed days, or sessions as familiarity proxies are not authoritative.
- No production code, schema, migration, API, analytics pipeline, or recommendation algorithm is approved by this decision.
