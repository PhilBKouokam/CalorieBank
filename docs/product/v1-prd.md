# CalorieBank V1 Product Requirements

Date: 2026-07-16

## Overview

CalorieBank V1 is an iPhone-first mobile app that helps users intentionally save and spend calories over time. V1 prioritizes a trustworthy manual logging loop backed by an immutable calorie ledger. Apple Health, USDA FoodData Central, food photos, and advanced planning features come after the manual ledger experience is reliable.

## Target User

The target user is a calorie-aware adult who already understands basic calorie tracking but wants more flexibility than a strict daily reset. They may be cutting, maintaining, or bulking, and they want a simple answer to: "How many calories have I saved or overspent based on my plan?"

V1 is not for users seeking medical nutrition therapy, eating disorder treatment, pediatric nutrition guidance, or automated meal coaching.

## Problem

Traditional calorie trackers reset emotionally and mathematically every day. A user who eats below target on Monday gets little clear credit for that effort later, while a higher-calorie meal can feel like failure. Users need a transparent way to carry unused calories forward, understand overages, and make deliberate choices across days.

## Core Promise

CalorieBank tells the user where their calorie bank stands, why it changed, and what actions created every deposit or withdrawal.

Every balance change must be explainable from ledger transactions tied to food, activity, target, day finalization, or adjustment records.

## Primary Daily Loop

1. User opens CalorieBank and sees today's target, consumed calories, projected bank change, and current balance.
2. User manually logs food by name and calories.
3. Optional: user manually logs activity calories.
4. App updates today's projection immediately.
5. At day finalization, the app creates immutable ledger transaction(s) for that day.
6. User can review a ledger-style explanation of balance changes.

## Required V1 Screens

- Onboarding: account creation/sign-in, goal selection (`cut`, `maintain`, `bulk`), timezone confirmation, daily calorie target confirmation.
- Today: current date, daily target, consumed calories, optional activity calories, projected daily bank change, current balance.
- Add/Edit Food: manual food name and calories required; macros optional only if included without slowing the slice.
- Food Log: list of today's entries and historical daily entries with edit/delete controls.
- Activity Entry: simple manual activity calorie entry screen or modal.
- Bank Ledger: chronological deposits, withdrawals, adjustments, and explanations.
- History: day-level summary of target, consumed, activity, bank change, and finalization status.
- Settings: target history/current target, timezone, goal mode, sign out, privacy/account basics.

## Required V1 Functionality

- iPhone-first Expo React Native app with TypeScript.
- Node.js, Express, TypeScript API.
- PostgreSQL persistence.
- User authentication suitable for private beta.
- User selects `cut`, `maintain`, or `bulk`.
- User manually sets or confirms a daily calorie target.
- Food intake is manually logged during the first implementation phase.
- Manual activity calories are optional.
- Bank balance is backed by immutable ledger transactions.
- Historical days preserve the target, goal mode, timezone, and rules active on that day.
- Users can view the explanation for each balance-changing transaction.
- Users can edit prior food/activity records, but edits must create traceable reconciliation or adjustment records.
- Saved calories do not expire during initial beta.

## Explicitly Excluded From V1 Alpha

- Apple Health integration.
- USDA FoodData Central lookup.
- Food photo upload and recognition.
- Barcode scanning.
- Social features.
- Coach/AI recommendations.
- Meal plans.
- Macro targets as a required flow.
- Push notifications.
- App Store launch hardening beyond what private alpha/beta requires.
- Automatic activity calorie import.
- Calorie expiration rules.

## Banking Formula

For a finalized day:

```text
eligible_daily_calories = daily_target_calories + eligible_manual_activity_calories
bank_change = eligible_daily_calories - calories_consumed
new_balance = prior_balance + bank_change + adjustments
```

For today before finalization:

```text
projected_bank_change = daily_target_calories + eligible_manual_activity_calories - calories_consumed_so_far
projected_balance = finalized_balance + projected_bank_change
```

Only finalized ledger transactions define the official persisted balance. Today may show projections, but the UI must label them clearly.

## Definitions

- Daily target: the calorie allowance selected or confirmed by the user for a date, based on their `cut`, `maintain`, or `bulk` goal. It is snapshotted for each historical day.
- Deposit: a positive ledger transaction that increases the calorie bank. Example: ending a finalized day under eligible calories.
- Withdrawal: a negative ledger transaction that decreases the calorie bank. Example: ending a finalized day over eligible calories.
- Balance: the sum of immutable ledger transactions for the user, plus any opening balance if migration requires one.
- Eligible daily calories: daily target plus optional manual activity calories that are eligible for that day.
- Adjustment: a traceable ledger transaction created to reconcile late edits, corrections, or administrative fixes.

## Negative Balance Rules

- The balance may become negative.
- A negative balance means the user has consumed more than their eligible calories across finalized ledger history.
- The app must not block logging, editing, or day finalization because of a negative balance.
- UI language should be neutral: "negative balance" or "overdrawn by X calories", not shame-oriented.
- Saved calories do not expire in initial beta, so negative balances are recovered only by later positive bank changes or adjustments.

## Late Food-Log Edit Rules

- Users may edit food and activity entries for historical days.
- Historical edits must not mutate prior ledger transactions in place.
- Each late edit creates a reconciliation record showing:
  - original entry value,
  - new entry value,
  - affected date,
  - calorie delta,
  - created adjustment transaction,
  - timestamp of the edit.
- The ledger must preserve both the original finalization and the reconciliation transaction.
- The user-facing explanation must say why the balance changed, for example: "Adjusted July 14 dinner from 600 to 750 calories: -150 calories."

## Day Finalization Rules

- A day is finalized according to the user's stored timezone.
- Finalization creates immutable ledger transaction(s) using the target and rules active on that date.
- V1 should support idempotent finalization: running finalization twice for the same user/date must not duplicate balance changes.
- Today's day remains projected until finalized.
- If a user opens the app after missed days, the API should finalize any unfinalized past days that have enough data, using the historical target for each date.
- Days with no food entries still finalize as a deposit equal to eligible daily calories unless product testing shows this creates misleading balances. This rule must be visually explained because missed logging can inflate the bank.

## Time-Zone Behavior

- Each user has one authoritative timezone, confirmed during onboarding.
- `log_date` is derived from the user's timezone, not server timezone.
- Day boundaries, finalization, historical summaries, and target snapshots use the user's timezone.
- If a user changes timezone, future days use the new timezone. Historical days retain the timezone active for those dates.
- The app must avoid silently moving entries between dates when timezone changes.

## Manual Activity Entry

- Manual activity calories are optional.
- Activity entries require activity name/type, calories, and date.
- Manual activity calories increase eligible daily calories for that date.
- Activity entries must be included in day explanations and ledger reconciliation.
- V1 should avoid presenting manual activity calories as medically precise.

## Future Apple Health Behavior

- Apple Health is not required for internal alpha.
- Future Apple Health import should create source-attributed activity records, not directly mutate balance.
- Imported health data must be reviewable, deduplicated, and traceable to import batches.
- Manual activity and Apple Health activity must have clear source labels.
- The user must be able to disconnect Health access and understand what imported data remains.

## Internal Alpha Success Criteria

- A team member can create an account, set goal mode and daily target, log food, optionally log activity, and see projected balance.
- Past days finalize into ledger transactions without duplicate entries.
- Editing a finalized day creates a visible reconciliation adjustment.
- Ledger balance can be recomputed from transactions and matches displayed balance.
- Negative balances display correctly.
- Timezone-specific date behavior is covered by tests.
- No health integration is required.
- No unexplained balance change appears in the UI.

## 10-User Private Beta Success Criteria

- At least 10 invited users can complete onboarding without support.
- At least 7 of 10 users log food on 3 separate days.
- At least 7 of 10 users can explain what their balance means after using the app.
- No known duplicate finalization or ledger corruption bugs.
- Late edits remain understandable in user testing.
- Support can diagnose any balance discrepancy from ledger records.
- No critical privacy, auth, or data-loss incident occurs.

## Analytics Events To Measure Later

- `account_created`
- `signin_completed`
- `onboarding_goal_selected`
- `daily_target_confirmed`
- `food_entry_created`
- `food_entry_edited`
- `food_entry_deleted`
- `activity_entry_created`
- `day_finalized`
- `ledger_adjustment_created`
- `balance_explanation_viewed`
- `history_day_viewed`
- `settings_timezone_changed`
- `settings_target_changed`
- `negative_balance_seen`
- `beta_user_retained_day_3`
- `beta_user_retained_day_7`

Analytics must not include raw food names, free-text notes, passwords, precise health data, or unnecessary personally identifying information.

## Privacy and Safety Considerations

- Calorie and activity data is personal health-adjacent data and should be treated as sensitive.
- Use careful language: CalorieBank is a tracking and planning tool, not medical advice.
- Avoid shame, moralizing food, or punitive streak mechanics.
- Support account deletion and data export before broader beta.
- Use secure token storage on mobile.
- Store passwords only as strong salted hashes.
- Keep immutable ledger records auditable while respecting deletion requirements.
- Collect the minimum data required for the beta.
- Protect production secrets and rotate any secrets that may have been exposed.
- Ensure balance explanations are transparent enough that users can challenge or correct wrong data.
