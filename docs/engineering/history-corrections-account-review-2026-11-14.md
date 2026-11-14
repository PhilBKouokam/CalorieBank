# Recent History corrections and account email review — 2026-11-14

This local mobile integration follows 18d3a14 and Settings commit adb9a57. It is not a native build, store submission or public launch.

## Changes

- Settings displays the current Clerk account’s primary email, with explicit loading, signed-out and unavailable states. The synthetic review uses preview@example.com only.
- History exposes a 44-point Eaten edit action for eligible yesterday/day-before-yesterday records. Eligibility uses the record’s timezone, provisional status and lock time. Opening Bank, older and locked records remain excluded; the server remains authoritative.
- The existing keyboard-safe calorie editor reads and writes the exact historical date. Addition, replacement and removal use the historical endpoint only, never a fallback to Today. Returning refreshes History while preserving the selected day, including grouped views.
- Successful corrections use the existing append-only reconciliation backend. No formula, ledger, migration, provider-authority or capability changes were made.
- Independent review identified two interrupted-save cases. Navigation completion now belongs to the original focus, while acknowledged saved state belongs separately to the dated route. Leaving/refocusing during a pending save cannot pop newer navigation; a retained editor receives the saved revision and removal state. Failed drafts remain available for retry.
- Narrow or enlarged-text History detail rows wrap vertically without clipping goal, burn or intake values. Normal-width columns remain intact. The Eaten edit target remains reachable.

## Verification

- Node 20.20.2: final selected integration suite passed **388 tests across 36 suites**. Coverage includes Settings identity states, History ranges and ownership, the exact-date editor, real editor/route deferred-save flows, existing Today/planning/share behavior, keyboard/drafts, capability boundaries and persistence.
- All eight historical persistence tests passed against the existing isolated localhost test database on port 55439. They cover add/replace/remove, duplicate retry, timezone/lock boundaries, other-user and invalid-date rejection, source identity/revisions, provider updates, missing-source removal rejection, Opening Bank exclusion and transaction rollback. No production data or migrations were used. The database was stopped after testing.
- Repository lint, repository typecheck and git diff whitespace checks passed on frozen source.
- Independent read-only review approved the final navigation/state changes and the final wrapping-only delta.
- Actual-component synthetic browser checks cover D-1/D-2 editing, add/replace/remove, exact-day retention, unchanged neighboring dates, recalculated sample totals, stale/locked rejection, older-day exclusion, Settings sample email and interrupted-save completion before/after refocus. The final 320px/2x History detail view no longer clips values. These checks do not establish physical-device keyboard, native blur, notification delivery, health sync or OS share-sheet behavior.

Evidence: /private/tmp/caloriebank-history-email-final-{tests,lint,typecheck}-20261114.log. Synthetic review source is maintained separately in /private/tmp/caloriebank-private-review-20261113 with fail-closed live-network adapters and owner-only hosting.

## Live API evidence and limits

At 2026-11-14 00:07 UTC, a freshly reloaded authenticated Render dashboard confirmed the API Live on ba09e402ea78016c2223eb4364de9a2f489ae237, which contains GET and PUT /v1/me/intake-adjustment/history/:localDate. Relevant API implementation and schemas are unchanged by this mobile integration. Both intake-authority-v2 and intake-adjustment-v1 request capabilities remain enforced; manual-source selection flags do not gate historical corrections.

Deployment: https://dashboard.render.com/web/srv-dabhml4s728c739ut0k0/deploys/dep-dbo6jhrl550s738s1mog . It was marked succeeded, deployed November 8 at 12:23:36 UTC and live at 12:26:41 UTC; deployment readiness logs returned 200. Auto-deploy remained disabled.

Applied production migration metadata was not queried; available deployment logs had no migration matches. This commit introduced no schema or migration changes. No real-account historical correction was attempted. Native qualification remains required before release.

## Review and source boundaries

The hosted review is synthetic and owner-private. Sample edits persist only within the review session and do not change a real account. Browser evidence is not native installation/QA. User review still precedes any native build. Existing installed builds do not yet contain these mobile changes.

The mobile checkout has no configured Git remote. This task does not claim an app-source push, CI result, backend deployment, store release or public distribution. The review Site is separate from the app release.
