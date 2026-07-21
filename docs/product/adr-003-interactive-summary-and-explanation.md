# ADR 003: Interactive Summary And Bank History

Date: 2026-07-20

## Status

Accepted.

## Context

CalorieBank V1 depends on user trust in an automatically calculated bank. The Today screen is the first place users see the state of that bank, but the ledger, intake import, expenditure import, and bank calculation records do not exist yet in the implementation.

The product also needs a clear distinction between read-only calculated data and editable user preferences.

## Decision

Today summary cards are approved V1 navigation gateways when they lead to history, explanation, or configuration.

- Tapping Available Bank opens Bank History.
- Bank History is read-only and shows the all-time Available Bank, finalized-day range filters, minimal history, and selected-day calculation detail.
- The default view stays visually simple. Calculation detail is revealed only after selecting a specific finalized day.
- Tapping Goal Mode opens Goal Settings.
- Tapping Daily Deficit, Daily Surplus, or Maintenance opens Goal Settings focused on goal-adjustment configuration.
- Available Bank must not be manually editable.
- Unavailable bank data must be presented as `Not calculated`, `Waiting for data`, `Pending`, `Incomplete`, or equivalent honest states rather than fabricated zero values.
- Consumer UI must use plain language and must not expose raw internal identifiers, API field names, database field names, variable names, or raw formula blocks.
- Consumer Today should not show infrastructure diagnostics or persistent current-day pending/forecast copy. Those states may exist in product rules and future detail surfaces without crowding the home screen.

## Rationale

Interactive summary cards make the home screen useful without increasing daily logging burden. They let users answer "how much is available?", "what happened over time?", "why did this day change?", or "how do I change my goal?" from the context where the question naturally appears.

Available Bank is calculated from imported expenditure, imported intake, goal configuration, and ledger/history data. Letting users edit it directly would undermine the ledger model and make the balance less trustworthy.

Goal mode and goal adjustment are user preferences, so they belong in editable settings. The same configuration model should be reused by onboarding and post-setup settings to avoid divergent validation rules.

## Consequences

- The mobile route tree includes public routes for `/bank-history` and `/goal-settings`.
- Today must refresh goal configuration when it regains focus after Goal Settings.
- Placeholder history screens may show unavailable states or clearly labeled examples before integrations exist, but they must not invent expenditure, intake, ledger transactions, timestamps, or bank values as real user data.
- Future ledger work must provide enough provenance for Bank History to show imported total expenditure as calories burned, the `0.80` policy as 80% credited, adjusted expenditure, goal mode, signed goal adjustment, daily allowance, imported intake as calories eaten, daily bank change, prior balance, reconciliation records, current Available Bank, freshness, and calculation status.
- Future analytics may measure `bank_history_opened`, `bank_history_range_changed`, `bank_history_day_selected`, `goal_settings_opened`, `goal_configuration_update_started`, `goal_configuration_update_completed`, and `goal_configuration_update_failed`.
