# ADR 004: Automatic Bank Usage And Dashboard Awareness

Date: 2026-07-21

## Status

Accepted.

## Context

CalorieBank V1 is an automatic banking layer powered by supported calorie-intake and total-expenditure data. A user may plan a desired food, meal, restaurant order, or experience, but actual consumption remains recorded in the user's connected calorie-tracking application.

If CalorieBank adds a separate manual `Use Bank` or `Spend Bank` action, planning can diverge from actual intake and the product can double-count a withdrawal.

## Decision

Bank usage is automatic. At completed-day finalization, CalorieBank calculates:

```text
daily_bank_change = daily_allowance - imported_calorie_intake
```

Positive completed-day changes create positive immutable provisional ledger transactions. Negative changes create negative immutable provisional transactions and immediately reduce Available Bank. Provider corrections during ADR 009's two-day window append compensating delta transactions; no existing transaction is edited.

CalorieBank must not include a manual bank-spending, treat-withdrawal, or `Use Bank` workflow in V1.

Planned Treat is planning awareness only. It compares required calories with real all-time Available Bank. It does not log food, confirm consumption, create ledger transactions, or deduct calories. The user's calorie tracker remains the source of truth for consumed intake.

Available Bank remains all-time and finalized. It excludes the current incomplete day and excludes protected Emergency Bank calories. Planned Treat progress must use Available Bank only, not Available Bank plus Emergency Bank.

Current-day expenditure and intake may appear later as live awareness in one `Today so far` card. The card should show adjusted calories burned so far today and calories eaten so far today. These values are partial until the day ends. They must not be added to Available Bank or shown as an estimated bank deposit or withdrawal before finalization.

The primary burned value uses the approved V1 expenditure policy:

```text
adjusted_current_day_expenditure =
  imported_total_daily_expenditure_so_far * 0.80
```

For example, if the connected expenditure source reports `2,000 kcal` so far, CalorieBank displays `1,600 kcal burned` with supporting copy such as `2,000 from Fitbit x 80%`.

Current-day intake should show the source-attributed total calorie intake so far, such as `Calories eaten · 1,500 kcal · Imported from MyFitnessPal`.

The user may interpret these live values themselves. CalorieBank must not show current-day calories remaining, an official or projected bank change, a forecasted midnight balance, or recommendations to eat less or exercise more.

Emergency Bank is optional and protected. It is separate from Available Bank, excluded from normal planned spending, excluded from Planned Treat progress, and not automatically shown on Today. Users may later choose whether its card is visible. Hiding the card must not change the balance or reserve rules.

Today dashboard customization should start with simple visibility toggles. Available Bank is mandatory, always visible, and always first. Optional cards may include Planned Treat, Today so far, Yesterday/latest finalized result, Current Goal, Emergency Bank, and future connection status cards. Drag-and-drop ordering is deferred.

## Rejected Alternative

Manual `Use Bank` action.

Reasons rejected:

- It duplicates calorie-tracker behavior.
- It adds friction to the low-effort V1 loop.
- It can diverge from actual consumed intake.
- It risks double withdrawal when the same meal later appears in imported intake.
- It confuses planning with consumption.
- It weakens the automatic product promise.

## Consequences

- No API endpoint, mobile route, or UI action should manually spend the bank for a Planned Treat.
- Planned Treat readiness and bank spending remain separate.
- Future food/treat/restaurant catalogue records are planning estimates until actual intake is imported from the source of truth or entered as an approved correction/fallback.
- Source-attributed intake and expenditure aggregates are the next required architecture milestone.
- The future `Today so far` read model must include adjusted current-day expenditure, raw source expenditure for explanation, current-day intake, source labels, sync freshness, and partial/current-day labels.
- The `Today so far` read model must not include projected bank result fields.
- Dashboard preferences must enforce Available Bank as non-hideable.
- Emergency Bank detail and visibility controls can be built later, but the hidden state must not alter reserve behavior.

## Deferred

- Live health or expenditure integration.
- Background synchronization.
- Full dashboard customization or drag-and-drop ordering.
- Emergency Bank persistence, allocation, and detail screens.
- Treat spending or withdrawal flows, unless a future product decision explicitly changes the automatic-bank-usage model.
