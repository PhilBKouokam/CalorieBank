# ADR 005: Personalized Activity Opportunity Notifications

Date: 2026-07-21

## Status

Accepted as future architecture. Not a first-10-user launch blocker.

## Context

CalorieBank helps users plan enjoyable foods and events from a real finalized Available Bank. Once Planned Treat, source-attributed intake, source-attributed expenditure, notification permissions, and current-day awareness exist, the product can identify useful moments when an activity the user already enjoys may help them make progress toward a self-selected goal.

These suggestions are not generic fitness tips and are not punishment after eating. They are optional, goal-aware opportunities tied to the user's explicit preferences, profile, active Planned Treat, remaining calorie gap, timing, consent, and eventually the user's own wearable history.

## Decision

CalorieBank will model this future system as the **Activity Opportunity Engine**.

The engine is responsible for producing structured recommendation candidates. Push delivery remains a separate notification-delivery layer.

The engine should eventually:

- Evaluate the active Planned Treat.
- Calculate remaining calories using Available Bank only.
- Evaluate time remaining before the planned date or time.
- Match activity suggestions to explicit user preferences or explicitly authorized behavior.
- Estimate a personalized calorie-burn range.
- Determine whether timing is useful.
- Apply fatigue controls and duplicate suppression.
- Produce a structured recommendation candidate with reason codes and delivery eligibility.

Estimated activity calories must never directly change the bank, create ledger transactions, mark a Planned Treat consumed, or become actual expenditure. The official bank continues to use imported intake, imported total expenditure, the approved `0.80` policy, and completed-day finalization.

## Activity Preferences

Activity interests must be explicit. CalorieBank must not infer activities from sex, age, ethnicity, or stereotypes.

Future onboarding or settings may collect:

- Activity categories such as dancing, fitness gaming, walking, running, cycling, swimming, strength training, recreational sports, hiking, home workouts, group activities, solo activities, indoor activities, outdoor activities, low-impact activities, and high-intensity activities.
- Preferred session durations.
- Preferred days or time windows.
- Activities the user does not want recommended.
- Notification opt-in.
- Maximum activity nudges per week.
- Quiet hours.

The first implementation should not redesign onboarding around this engine. Preference capture belongs after the core ingestion and notification foundation is stable.

## Estimation Strategy

Numerical activity suggestions must use qualified ranges, not exact promises.

Preferred language:

- `may burn around`
- `typically burns approximately`
- `estimated range`
- `based on your profile`

Avoid:

- `will burn`
- `guaranteed`
- `exactly`
- `earn this many calories`

### Initial Stage: Population-Based Estimate

The initial engine should use a curated, versioned activity-energy model based on reputable activity-intensity data, such as MET-based or equivalent documented expenditure models. The exact formula, sources, activity catalogue, and coefficients must be documented before production use.

The activity catalogue should support fields conceptually similar to:

- `activityCode`
- `consumerName`
- `category`
- `intensityLevel`
- `supportedDurations`
- `estimationMethod`
- `lowIntensityCoefficient`
- `highIntensityCoefficient`
- `modelVersion`
- `sourceReference`
- `isActive`

Do not scrape search results dynamically at notification time. Do not let an LLM invent calorie numbers. Deterministic, auditable services must provide all numerical estimates.

### Later Stage: Wearable-Personalized Estimate

When enough consented historical data exists, CalorieBank should prefer the user's own wearable history.

Example:

> Based on your recent dance sessions, you usually burn around 240-290 kcal in 30 minutes.

Personalized ranges may use prior activity sessions, connected-device expenditure, duration, recent body weight, activity classification, sample size, variability, and data freshness. The system must fall back to the population estimate when personal history is insufficient. Minimum data confidence remains an open decision.

## Timing And Scoring

The system should send only when the opportunity is likely to be useful and actionable.

Positive signals may include:

- Active Planned Treat with a future planned date.
- Planned date within a useful time window.
- Remaining gap is realistically addressable.
- Activity matches an explicit preference.
- Duration matches the user's preferred duration.
- Current time falls within an allowed notification window.
- Similar nudge was not sent recently.
- Activity is historically selected or completed often.
- Estimated range overlaps meaningfully with the remaining gap.

Blocking or negative signals include:

- Notifications disabled.
- Activity nudges disabled.
- Quiet hours.
- No active Planned Treat.
- Planned Treat is already ready.
- Event has passed.
- Missing profile data required for estimation.
- No matching explicit activity preference.
- Frequency cap reached.
- Similar recommendation sent recently.
- Repeated dismissal of similar recommendations.
- Stale or unreliable data.
- Explicit health, accessibility, or activity restrictions.

Scores may be used to rank candidates later, but arbitrary score values must not be presented as scientifically validated. Policy constants must be named and configurable rather than scattered through code.

## Notification Categories

The restrained notification taxonomy is:

- Daily completed-bank update: primary V1 notification. It must label a provisional contribution honestly; correction-notification behavior remains deferred under ADR 009.
- Planned Treat progress milestone: optional progress or ready notification; no withdrawal occurs.
- Personalized activity opportunity: optional, goal-aware activity suggestion.
- Positive momentum: optional combination of finalized bank progress and Planned Treat progress.

This ADR does not approve a large notification catalogue.

## Structured Candidate Model

A future activity opportunity candidate should preserve structured facts such as:

- `opportunityId`
- `userId`
- `plannedTreatId`
- `activityCode`
- `activityDisplayName`
- `durationMinutes`
- `estimatedLowCalories`
- `estimatedHighCalories`
- `estimationMethod`
- `estimationModelVersion`
- `remainingTreatCalories`
- `plannedTreatDate`
- `hoursUntilPlannedTreat`
- `opportunityReasonCodes`
- `opportunityScore`
- `generatedAt`
- `expiresAt`
- `notificationCategory`
- `suggestedTitle`
- `suggestedBody`
- `deliveryEligibility`
- `blockedReason`
- `deduplicationKey`

Generated notification copy should not be the source of truth when structured fields can regenerate it deterministically. Activity opportunities do not belong in the immutable calorie ledger.

## Notification History And Fatigue Controls

Future delivery history should be auditable enough to determine whether a similar message was recently sent, whether a cooldown applies, whether the opportunity expired, and whether the user engages with this category.

Conceptual delivery-history fields include:

- `userId`
- `opportunityId`
- `notificationCategory`
- `activityCode`
- `scheduledFor`
- `deliveredAt`
- `openedAt`
- `dismissedAt`
- `deliveryStatus`
- `suppressionReason`
- `deduplicationKey`
- `templateVersion`

Do not implement production analytics or push delivery as part of this ADR.

## Safety And Language

The feature must support autonomy, not guilt.

Avoid:

- `burn off what you ate`
- `undo your meal`
- `earn your food`
- `compensate for overeating`
- `you failed`
- `you need to exercise`
- `work this off`

Prefer:

- `an activity you enjoy`
- `one way to make progress`
- `may bring you closer`
- `based on your preferences`
- `your wearable will record the actual result`

The feature must include controls to disable activity suggestions, mute specific activities, reduce frequency, disable goal-linked nudges, and manage quiet hours.

## AI Boundaries

AI must not be responsible for calorie calculations, actual expenditure, ledger updates, activity ranges, policy override, food-consumption decisions, or unsupervised medical or fitness claims.

AI may later help rewrite approved structured facts into natural language, rank already-valid activities, adapt tone within strict templates, or classify a user-entered activity into a curated category. All numerical values must come from deterministic services. All delivery decisions must pass policy validation.

## Alternatives Considered

### Generic Activity Tips

Rejected because they are vague, poorly timed, and disconnected from user goals.

### Exact Calorie Promises

Rejected because calorie expenditure varies by person, duration, intensity, device, and conditions.

### Demographic Stereotypes

Rejected because activity selection should come from explicit preferences and authorized behavior, not assumptions.

### LLM-Generated Calorie Estimates

Rejected because numerical health-adjacent estimates must be deterministic, auditable, and sourceable.

### Punishment After Overeating

Rejected because it can create guilt and unhealthy product behavior.

### Estimated Activity Calories Deposited Into The Bank

Rejected because only connected-source data and completed-day finalization may affect the ledger.

## Consequences

- The full Activity Opportunity Engine is not a blocker for first-10-user V1.
- Production implementation should wait until real source-attributed intake and expenditure ingestion, current-day awareness, notification permission, stable Planned Treat dates, and user preference collection exist.
- Planned Treat may need a future `plannedFor` date/time field, not just a date, before timing-aware opportunities can be reliable.
- Future schemas should separate recommendation candidates, notification delivery history, preference settings, and activity catalogues.
- Tests for any pure utility must verify range estimates, version preservation, eligibility blockers, Available Bank-only gaps, forbidden language, and no ledger side effects.

## Privacy Considerations

Activity preferences, profile fields, notification history, wearable history, and Planned Treat names can be sensitive. The system should collect only what is needed, allow opt-out, avoid raw food names in analytics, preserve consent, and support deletion/export before broad beta.

## Rollout Sequence

1. Complete real source-attributed intake and expenditure ingestion.
2. Expose the Today-so-far read model without current-day bank forecasts.
3. Implement notification permission and the primary finalized bank update.
4. Stabilize Planned Treat dates and progress milestones.
5. Add explicit activity preference settings.
6. Add a curated, versioned activity-energy catalogue and deterministic estimate service.
7. Build the Activity Opportunity Engine as a candidate generator.
8. Add delivery history, fatigue controls, and push delivery.
9. Consider wearable-personalized estimates when sufficient consented history exists.
