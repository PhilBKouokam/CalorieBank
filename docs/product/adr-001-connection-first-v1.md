# ADR 001: Connection-First CalorieBank V1

Date: 2026-07-16

## Status

Accepted.

## Decision

CalorieBank V1 for the first 10 users is a connection-first automatic calorie-banking product, not a food-logging-first product.

The first-user mission is:

> Validate whether users can connect their existing health and calorie data, understand and trust an automatically updated calorie-bank balance, and use the morning bank update to plan enjoyable foods with less friction and guilt.

## What Changed

Previous V1 planning emphasized a manual food logging loop: set target, log food, calculate daily result, update ledger, explain balance.

That loop is now superseded by:

1. Connect supported calorie-intake data source.
2. Connect supported calorie-expenditure or health-data source.
3. Configure goal, target, timezone, and optional saved food/meal/event.
4. Sync data automatically.
5. Calculate and explain bank changes.
6. Deliver one meaningful morning bank update.

Manual food logging remains allowed only as fallback, correction, supplementary input, or future expansion. It should not dominate onboarding, home-screen actions, retention metrics, or first-10-user success criteria.

V1 includes a Planning Database for future meal and event estimates. This does not reverse the connection-first decision: Food Tracking remains the responsibility of the connected calorie-tracking application, and Planning Database estimates must not directly update the bank.

## Why

The product thesis is lowest-friction calorie banking. Users should keep using tools they already use for intake and expenditure tracking. CalorieBank creates value by interpreting that data, maintaining a transparent lifetime bank, and helping users plan enjoyable foods while staying aligned with their goal.

If CalorieBank requires daily manual logging, it competes directly with established calorie trackers and weakens the core differentiation.

## Deprecated Assumptions

- V1 is primarily a manual food logger.
- Apple Health and other integrations can wait until after manual logging works.
- The smallest vertical slice is add-food-entry -> ledger withdrawal.
- Success is measured by number of meals logged or daily app-opening streaks.
- Generic engagement notifications are part of the V1 loop.
- Weekly bank framing is the primary balance model.
- Planning Database entries are confirmed intake records.

## Implementation Impact

- Prioritize integration feasibility investigation before building food-logging features.
- Build connection state, sync batches, imported record storage, duplicate prevention, and source-labeled history early.
- Keep Planning Database records separate from imported intake and manual correction/fallback records.
- Treat notification generation as part of the core product path.
- Keep banking logic in `packages/domain` and schemas in `packages/schemas`.
- Follow `docs/product/bank-calculation-spec.md` for all bank-calculation behavior.
- Use Available Bank as the normal planned-spending balance, optional Emergency Bank as a protected reserve for unexpected overages, and Recovery Forecast as the primary experience only after Available Bank and Emergency Bank are exhausted.
- Preserve immutable ledger transactions and traceable corrections.
- Mark unsupported third-party integrations as investigation or aspiration until API access, permissions, and terms are confirmed.

## Open Decisions

Open decisions are tracked in `docs/product/v1-prd.md` and `docs/product/bank-calculation-spec.md`. The most urgent are the first feasible intake source, first feasible total-expenditure source, completeness/cutoff rules, rounding, and duplicate-source handling.
