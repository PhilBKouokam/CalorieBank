# ADR 003: Interactive Summary And Bank History

Date: 2026-07-20

## Status

Accepted.

## Context

CalorieBank V1 depends on user trust in an automatically calculated bank. The Today screen is the first place users see the state of that bank, but the ledger, intake import, expenditure import, and bank calculation records do not exist yet in the implementation.

The product also needs a clear distinction between read-only calculated data and editable user preferences.

## Decision

Today uses progressive detail: the bank-first summary remains minimal, while the existing Steps and Today-so-far cards may open focused explanatory views. These views are read-only activity context. They do not calculate a projected bank, create contributions, or alter provider authority, reconciliation, finalization, Recovery, or the ledger.

Steps planning reuses ADR 021's personal walk/run rate and ADR 023's provider-level rest-of-day projection. The forward calculator adds only provider calories from steps above the current count to that resting-day baseline. The inverse calculator solves the same model for total daily steps. Neither calculator re-adds current steps or changes accounting. Today rest-of-day prediction uses a personalized provider resting rate and the remaining duration of the user's current local day. It is withheld when that evidence is genuinely unavailable.

The `Why 80%?` affordance opens a short modal over Today with the accepted founder-story explanation. It remains beside the first `× 80%` presentation, retains the full provider-reported burn for transparency, and does not claim that every wearable has a precisely measured 20% error. It does not navigate away from Today or appear again in Today Detail.

Today summary cards are approved V1 navigation gateways when they lead to history, explanation, or configuration.

- Tapping Available Bank opens Bank History.
- Bank History is read-only and shows the unsigned all-time Available Bank, completed-day range filters, signed daily contributions, and a selected-day calculation under ADR 009. Lifecycle, correction-count, and version metadata remain available to internal accounting and diagnostics but are not permanent primary consumer content.
- The default view stays visually simple. Calculation detail is revealed only after selecting a specific finalized day.
- Tapping Goal Mode opens Goal Settings.
- Tapping Daily Deficit, Daily Surplus, or Maintenance opens Goal Settings focused on goal-adjustment configuration.
- Available Bank must not be manually editable.
- Unavailable bank data must be presented as `Not calculated`, `Waiting for data`, `Pending`, `Incomplete`, or equivalent honest states rather than fabricated zero values.
- Consumer UI must use plain language and must not expose raw internal identifiers, API field names, database field names, variable names, or accounting lifecycle mechanics. The selected-day presentation uses `Provider burn`, then `Estimated actual burn` with the visible `raw × 0.8 = adjusted` relationship. It does not require the user to learn `Credited` as an accounting term. The goal effect, intake, and resulting signed contribution remain self-evident in one compact equation.
- Consumer Today should not show infrastructure diagnostics, persistent current-day pending copy, or projected bank outcomes. ADR 011 permits a progressively introduced, clearly estimated Projected Daily Burn, but it must not crowd the initial home experience or look like an official bank result.
- Today's Eating Budget may later open a read-only explanation that distinguishes confirmed expenditure, estimated remaining expenditure, goal effect, confirmed intake, total budget, and Remaining Today. It must not reuse Bank History or imply that the guidance is ledger-backed.

## Rationale

Interactive summary cards make the home screen useful without increasing daily logging burden. They let users answer "how much is available?", "what happened over time?", "why did this day change?", or "how do I change my goal?" from the context where the question naturally appears.

Available Bank is calculated from imported expenditure, imported intake, goal configuration, and ledger/history data. Letting users edit it directly would undermine the ledger model and make the balance less trustworthy.

Goal mode and goal adjustment are user preferences, so they belong in editable settings. The same configuration model should be reused by onboarding and post-setup settings to avoid divergent validation rules.

## Consequences

- The mobile route tree includes public routes for `/bank-history` and `/goal-settings`.
- Today must refresh goal configuration when it regains focus after Goal Settings.
- Placeholder history screens may show unavailable states or clearly labeled examples before integrations exist, but they must not invent expenditure, intake, ledger transactions, timestamps, or bank values as real user data.
- Ledger and calculation records must retain enough provenance for Bank History to show provider burn, `Estimated actual burn` as `raw × 0.8 = adjusted`, goal mode and adjustment, imported intake, and signed daily contribution. Prior versions, reconciliation records, correction counts, freshness, and lifecycle status remain internally auditable without appearing as permanent noise in the normal History experience.
- Future analytics may measure `bank_history_opened`, `bank_history_range_changed`, `bank_history_day_selected`, `goal_settings_opened`, `goal_configuration_update_started`, `goal_configuration_update_completed`, and `goal_configuration_update_failed`.
- Summary-card availability does not make every supporting card initially visible. Progressive Feature Discovery and first-use visibility are governed by ADR 011; ADR 014 governs readiness, workflow complementarity, and pacing for proactive card introductions. Manual navigation to available details remains unaffected.
