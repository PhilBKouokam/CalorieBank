# Phase 1B pre-enablement safety checkpoint — September 25, 2026

**Protocol/schema pre-enablement checkpoint: PASS. Manual Intake remains DISABLED.**

This is not full Phase 1B PASS, the post-enablement real-account gate, or physical
qualification of the pending native Back correction. No enrollment change, new
binary, backend deployment or Phase 2 work was performed.

## Repository delivery

Founder explicitly approved pushing `419fa29` and its calorie-evidence payload
to the existing private `PhilBKouokam/caloriebank` repository on
`codex/private-beta-release`. Push succeeded (`4fd624f..419fa29`). GitHub reported
the canonical repository spelling as `PhilBKouokam/CalorieBank`; no destination
or remote configuration was changed. Google support submission was not authorized
and the support draft remains unsent.

## Required checkpoint matrix

| Requirement | Evidence | Result |
| --- | --- | --- |
| Feature clients emit capability | Central authenticated transport sets `X-CalorieBank-Capabilities: intake-authority-v2` after caller headers. Previously inspected exact build-7 IPA and versionCode-6 AAB contain the capability/recovery code; artifact/source IDs are in the deployment index. This artifact evidence is retained, not claimed as re-extracted today. | PASS |
| Server recognizes capability | Deployed compiled middleware tested with otherwise equivalent supported/unsupported requests in a temporary loopback-only Express harness. | PASS |
| Unsupported requests distinguishable | Missing/invalid capability returns 426 / `UPDATE_REQUIRED`; malformed tokens fail closed in focused tests. Clerk ownership remains separate. | PASS |
| Unsupported source-bearing read rejected | Fresh local persistence tests exercise actual manual records and real routers, including selection, Today, connections, onboarding and historical snapshots. Deployed compiled serialization guard separately passed synthetic manual/current-history checks. | PASS |
| Conflicting write rejected before mutation | Fresh local persistence tests retain selection/preference/timezone state after rejected writes; deployed compiled guard rejected before an in-memory write counter advanced. No production conflicting mutation was attempted. | PASS |
| Provider-only unsupported client still works | Ten existing accounts' compiled provider-selection reads returned HTTP 200 both with and without capability: 20 checks. No response health values or account identifiers recorded. Prior store-binary physical baseline remains qualified. | PASS |
| Manual schema deployed | Read-only production inspection found applied `20260923000000_manual_intake`. | PASS |
| Migration changed no existing accounting | Contemporaneous September 23 before/after production fingerprints matched all seven models. Fresh isolated populated-database migration/invariance suite: 9 passing cases. Current unrelated lifecycle activity is not misrepresented as a migration replay. | PASS |
| No existing account assigned manual | Fresh production counts: zero manual authority periods, selections, states, usual boundaries and overrides. | PASS |
| Safe rollback documented | Disable new enrollment only; retain capable-client service for existing records, request guards, effective-dated resolution and finalization. Fix forward; no destructive schema downgrade, relabeling or history rewrite. | PASS |

## Fresh server evidence

At **2026-09-25T22:10:31.662Z**, a repeatable-read, read-only transaction confirmed:

- Deployed commit: `bad1750ae997f434c878b33b091ca3b678e70b5f`.
- `MANUAL_INTAKE_SELECTION_ENABLED=0`; `AUTH_MODE=clerk`.
- Applied manual migration and preceding intake-authority migration.
- All five manual-data counts above were zero.

Public `/health` and `/health/ready` returned successful status, with database
ready. At **22:11:39.521Z**, the temporary loopback harness passed **25 checks**:
20 provider reads across ten accounts plus five synthetic capability/read/write
checks. It used existing compiled modules, bound only to `127.0.0.1`, then closed.
Its provider repository reads did not invoke refresh or lifecycle. It performed
no production mutations and created no manual production account or record.

This harness proves deployed protocol and repository behavior, not an end-to-end
Clerk/device request. Synthetic deployed manual responses do not substitute for
the mandatory later real manual-account capability stripping checkpoint.

## Fresh local validation

Node 20.20.2; isolated `caloriebank_test_phase1b_20260923` on localhost:

- Capability, manual persistence, effective-dated authority, forward compatibility,
  manual mobile behavior and date rollover: **62 tests / 6 files passed**.
- Populated Opening Bank/source-change/migration invariance: **9 tests / 1 file passed**.

The initial command set only `TEST_DATABASE_URL`; the legacy authority suite uses
`DATABASE_URL` and therefore reached its default local database with an older
schema. Eleven cases failed before account creation because a column was absent.
Rerunning with BOTH variables explicitly targeting the dedicated test database
passed all 62 cases. No production database was used and no code change was needed.

Domain/schema builds ran with the test commands. No product code changed, so the
previous full 936-test release gate is retained as prior evidence, not falsely
claimed as rerun. `git diff --check` is required for this documentation update.

## Remaining sequence and hold

The next consolidated feature binaries must include the pending iOS native Back
correction and complete the appropriate release/build checks. Verify exact private
artifacts and their existing-provider baseline before controlled enrollment.
Do not create an arrow-only binary. Existing qualified private artifacts remain
iOS 1.0.0 (7) and Android 1.0.0 versionCode 6; neither includes the held correction.

Then retain all real manual onboarding/edit/reset/source-switch, accessibility,
offline/account isolation, cross-device, capability stripping/rejected-write
invariance and first completed-day finalization gates. No such gate is waived by
this checkpoint. Recovery-message physical evidence remains unavailable without
a natural missing-data day. No destructive fixture is authorized to manufacture it.

Manual Intake is still disabled at this checkpoint. No public release, support
case submission, endpoint/accounting change or Phase 2 work occurred.
