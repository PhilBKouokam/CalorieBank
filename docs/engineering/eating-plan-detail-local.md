# Intentional daily eating planning — local slice

Current whole-day Eating budget also supports the separately approved projected estimate in ADR012, dated2026-11-05. The verified-input and walking-plan qualification descriptions below remain applicable to those paths; they do not gate the new projected total estimate.

Daily Eating Budget / Eat Planning follows dependable step forecasting in the approved roadmap. This slice completes the inverse direction already supported by the accepted domain and API: a planned **whole-day intake total** can produce a hypothetical total/additional walking-step estimate. It is not an “add brownie” action, food logging, a meal-calorie lookup, a bank withdrawal, or a change to the forecast model.

Home's Eating budget metric intentionally opens Plan today. The existing bank → Today so far → walking card hierarchy and detailed burn/step cards remain intact. The new detail uses one shared keyboard-safe scroll host, session-only `eating-plan` draft, and existing owner-authenticated read APIs. Refresh reads existing models; it does not initiate a health sync.

The API/domain/schema and their numeric qualification rules are unchanged. Both existing Budget flags remain off. Disabled planning performs no feature HTTP requests, including no new Today/provider reads from this detail. No current-account or Google numeric availability is claimed. Missing common expenditure/step evidence continues to withhold a walking/eating plan; no timestamp is upgraded to coverage, and no provider or intake policy is invented.

Total Budget does not require observed-intake freshness. A separately qualified observed comparison is labelled Remaining Today. A manual whole-day estimate is labelled as a comparison with that estimate, never food already consumed. Its expiry is independent: stale food comparison does not erase an otherwise qualified total Budget. No food values are converted or adjusted again on the client.

Inverse results bind to the exact client-owned requested total, current owner-context token, local day/timezone, quiet-model/calibration versions, coefficient, current steps/cutoff and expiry. Refresh, source/goal changes, expired evidence, input edits and late responses suppress old numbers. A response cannot claim fewer total steps than already observed or inconsistent additional steps. A missing/legacy response remains unavailable; the active-energy coefficient is not a fallback.

Tests use synthetic fixtures only. They exercise qualified inverse rendering, flag-off zero calls, stale/generation rejection, manual/observed semantics, session drafts and keyboard input inventory. Rendered width/font-scale checks are not native/pixel/physical keyboard qualification. There is no demo-data injection or consumer flag switch. This local candidate must receive independent review/QA and separate shipping approval; it does not alter the active release or make a production-availability promise.
