# ADR 024: Provider-Aware Historical Day Authority

## Status

Accepted for V1.

## Decision

CalorieBank may let a user change the expenditure source or intake source for one completed local date only while that date remains inside its existing provisional correction window. A valid explicit date-and-role override takes precedence over global provider selection. Expenditure and intake overrides are independent.

Only usable normalized aggregates already persisted for the authenticated user and exact accounting date are eligible. Provider totals are never combined. Apple Health intake remains the compound authority `apple_health + writerBundleIdentifier`; legacy all-writer aggregates are ineligible. Choosing among multiple Apple Health writers on one date remains deferred because current aggregate identity cannot retain those alternatives side by side.

Historical eligibility is independent of current global selection and current connection state. A disconnected direct provider may remain selectable while the day is provisional when its persisted exact-date aggregate is still usable. Conversely, a provider connected today is omitted when it has no usable aggregate for that historical date. Any option returned as selectable must remain acceptable to the mutation endpoint unless its underlying state changes after the read.

The override records user intent separately from immutable calculation snapshots. Every reconciliation path resolves override-first authority. A changed contribution uses the existing date lock, immutable calculation version, and append-only correction delta. A zero-delta authority change creates no ledger transaction or calculation snapshot.

Locked days and immutable Opening Bank calculation days remain read-only. Today, future dates, global provider selection, the expenditure adjustment, bank formulas, and correction-window duration are unchanged.

## Consumer presentation

History shows `Change` only when a provisional completed day has a genuinely different eligible source for that role. The selector contains consumer provider names only. Locked and Opening Bank days show normal attribution without disabled controls or lifecycle explanations.

Expected mutation failures use consumer-safe reason codes for missing date data, unavailable Apple Health writer data, expired correction windows, stale selections, and unknown options. Mobile treats the committed mutation response as success independently from a best-effort History-list refresh; a refresh failure must never be presented as a failed source change.
