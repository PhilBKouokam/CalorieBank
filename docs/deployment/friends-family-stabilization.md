# Friends and Family Stabilization - September 8, 2026

This is a P1 release-blocker fix, not a milestone or accounting change. The previous release PASS is revoked; automated success alone does not restore it.

## Proven causes

- Render application logs on September 7, approximately 21:04-21:25 America/Chicago, show HTTP 429 for notification preference PATCH, device PUT, and device DELETE. Sign-out DELETEs at 21:07:45, 21:07:49, and 21:08:00 completed in 4 ms with 429. No credentials or health payloads were needed for this diagnosis.
- All three operations shared a 12-write/15-minute account bucket. Enabling needed registration plus preference writes; loading Settings and foregrounding registered again. Exhausting that bucket also blocked mandatory sign-out cleanup.
- Settings had no synchronous mutation lock or stale-response generation guard. It labeled registration errors as settings-load failures and supplied no explicit reload action.
- Preparation caught an operation failure, fetched authoritative setup success, then unconditionally restored the earlier error. Successful refresh did not clear it. The client aborts API requests after 20 seconds; the server's synchronous provider orchestration is not cancelled by that client abort. Device preparation separately has a 45-second wait bound. Neither timeout proves accounting failed.

## Changes and boundaries

- Authenticated, independent per-account limits: preference 60/minute, registration 60/minute, device release 30/minute. Reads and hosted delivery do not consume these buckets. Limits remain process-local under the existing private-beta topology. No auth exemption was introduced.
- Settings reads do not register devices. The native switch is disabled while unresolved, with a synchronous lock before React renders. The latest accepted user action wins; taps on the locked control are not queued as additional intent. Values are acknowledged, not optimistic. Ambiguous writes are checked by an authoritative read, and successful reads clear old errors.
- Notification operations are serialized and account-generation guarded. Starting release rejects queued/later registration, waits for already-started work, and invokes the existing idempotent DELETE. Network/timeouts/5xx receive at most two retries, after 1 and 2 seconds. Persistent failure still blocks Clerk sign-out. Rate-limit/auth errors are not blindly retried. Account switching invalidates old operation continuations.
- Setup refreshes have generation ownership; navigation invalidates old responses. Successful refresh clears transient errors. Authoritative ready/complete suppresses preparation/load warnings but does not suppress an actual failure to complete onboarding. After a preparation attempt, at most three read-only status checks follow, spaced 2, 5, and 10 seconds after the preceding check. They stop on success/navigation/unmount; they do not repeat provider ingestion or accounting.
- Waiting data, retry-needed source rows, unavailable API, and ready state remain distinct. Existing API/preparation timeout constants, accounting formulas, Opening Bank policy, authority, lifecycle, notification delivery, and schema are unchanged. Token lookup now has a 15-second bound before registration, so a stalled Expo token lookup cannot indefinitely hold the device-release queue; a late lookup result never starts registration.

## Verification

Node 20.20.2. Regression coverage exercises separate rate buckets, twenty toggles then release, exhausted writes then cleanup, serialized operations, ambiguous write verification, retry bounds, account switching, and stale preparation response precedence. Full API/persistence tests use only the dedicated localhost database `caloriebank_rc_20260907`.

Automated result: 43 files / 388 tests passed, including 18 new resilience tests. Workspace TypeScript, API/mobile lint, Prisma generation/validation, API production build, and diff checks passed. The notification recovery screen was rendered through React Native Web at 320px with simulated 150% text; text and switch remained separate. Its content now scrolls so recovery controls remain reachable with larger text. This is not physical iOS permission, VoiceOver, or live-provider validation.

API deployment is required for rate-limit separation. The existing Blueprint may also rebuild lifecycle from the same commit; lifecycle behavior is unchanged. No migration or environment change is required. A new EAS preview is required for the mobile JavaScript changes; no native dependency/capability change is required.

## Required physical regression checklist

1. Install the corrected preview. Change Morning Bank Update On/Off 20 times, waiting for each enabled switch; also rapidly tap while saving. Confirm one stable acknowledged state, no permanent load error, and correct state after leaving/reopening Settings.
2. Sign out immediately afterward. Confirm completion, then sign into B on the same device. Confirm B's setting/token ownership is independent and no future A update is delivered to B.
3. Interrupt connectivity during a preference save. Restore it, tap Try again, and confirm the authoritative state replaces the warning. Repeat for sign-out: offline must not bypass cleanup, restored connectivity must allow retry.
4. Run fresh-account preparation with real connected sources. If a request is slow, verify bounded checking/retry presentation. When setup becomes ready, no red preparation error remains beneath success. Continue once to Today.
5. Navigate away/back during preparation and repeat a refresh. Confirm older requests do not restore old errors or leave a stuck spinner. Genuine missing data must remain a waiting/recovery state, not invented success.

Do not distribute as PASS until these physical regressions are re-tested.
