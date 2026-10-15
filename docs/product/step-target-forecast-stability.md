# Step Target Forecast Stability

## Contract and Equations

Planning only; no changes to finalized accounting, source authority, Opening Bank,
Recovery, Daily Bank Target, ledger or History. Preserve the approved card order.

Let A = requested actual burn, f = adjustment factor (currently 0.8), B = observed
provider burn, r = historical provider resting calories/hour, H = hours remaining
at the persisted planning anchor, S = observed steps, c = calibrated provider calories/step.

- Provider target Q = A / f; 4,000 / 0.8 = 5,000.
- At-rest day projection P = B + r * H internally; display round10(P).
  H uses exact elapsed minutes from the persisted planning anchor to local midnight.
  Its provenance distinguishes verified coverage, reported horizon and assumption.
- Additional steps = max(0, (Q - P) / c).
- Total target T = max(S, ceil100(S + additional steps)).
- Remaining steps = T - S. Do not round this difference a second time.
- Forward projection for user target U = round10(P + max(0, U - S) * c).
  Adjusted result independently rounds the unrounded forward projection times f.
- Walking time = remaining steps / median walking steps/minute, using the
  existing 2-5 valid walking samples. Sessions = ceil(time / 25), with the existing
  rounded minutes/session. Time and sessions use the same remaining steps displayed.

## Evidence and Changing Inputs

| Input | Source/change cadence | Legitimate influence |
| --- | --- | --- |
| A | User input | Explicitly changes the target |
| f | Stored expenditure factor | Fixed at 0.8 in V1, not a volatility source |
| B | Selected provider cumulative total, refreshed during sync | Includes walking, rest and non-step exercise; +150 kcal lowers target 3,000 steps at c=0.05 |
| S | Selected activity provider, refreshed during sync | +3,000 steps without matching burn raises total target 3,000 |
| r | Resting model from historical basal/low-activity evidence | +10 kcal/hour with 10 hours left lowers target 2,000 steps at c=0.05 |
| H | Persisted planning anchor to local midnight, DST-aware | Must not shrink just because cached data is read later |
| c | Ratio of summed active workout calories to summed workout steps, latest up to 5 valid same-provider walking/running workouts over 30 days | New/revised workout evidence can change coefficient; never daily total burn divided by steps |
| Walking pace | Separate walking-only median, last 2-5 valid walks | Changes time, never changes target steps |

Without rounding: dT = dS - dP/c - (Q-P)*dc/c^2. With stable c and expected
walking/rest accrual, dB = c*dS + r*dt and dH = -dt, so T stays constant.
Cycling or other real non-step energy reduces T; do not smooth that away.
Sparse calibration (one workout is currently valid under ADR 021), revised workouts,
device under/overcounting, and provider-side delayed uploads remain real uncertainty.
No evidence proves the coefficient needs a new window or walking-only restriction.

## Proven Defects and Correction

1. The old read path combined cached B with H measured at request time. A later
   read manufactured a lower P without new evidence. At 80 kcal/hour and c=0.05,
   a 30-minute cache age creates 800 extra steps. Existing freshness expires at
   30 minutes: this defect alone does not establish the tester's full 3,000 swing.
   The earlier patch used providerUpdatedAt with an updatedAt fallback. Phase 2A
   supersedes that patch: neither field proves cumulative observation coverage.
   H now uses a persisted, expiring planning anchor with explicit provenance;
   retrieval is never relabeled as verified cumulative coverage.
2. Fitbit writes burn then steps then workouts, separately. Parallel independent
   reads could combine generations or consume a partially written session.
   Today now reads in one repeatable-read transaction, including selection and
   calibration. Planning additionally requires same provider, same non-null sync
   session, latest session, and a terminal completed/partially-completed session.
   Partial category success is acceptable only when both actual rows share that
   session. Missing proof means no new forecast, not invented continuity.
3. Remaining steps previously rounded the difference again. This could disagree
   with displayed total minus actual current steps by up to 50. It now subtracts
   exactly; time uses that exact same difference.

The mobile read hook replaces one complete response, rejects older request
generations and retains known data after request failure. Root account-keyed
remounts invalidate old account reads. Foreground/manual provider refreshes are
serialized/coalesced by the existing coordinator; it is unchanged.
Provider-internal timestamps may still lag a successful API query: session identity
proves our retrieval generation, not simultaneous measurements inside the wearable.

## Controlled Reproduction

These are synthetic inputs, not reconstructed tester health records. Earlier
tester input snapshots were not retained; no claim is made about their exact cause.

| Case | S | P | c | Q-P | Additional | T |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Earlier | 10,000 | 3,935 | .05 | 1,065 | 21,300 | 31,300 |
| Mixed newer steps / old burn | 13,000 | 3,935 | .05 | 1,065 | 21,300 | 34,300 |
| Coherent newer pair | 13,000 | 4,085 | .05 | 915 | 18,300 | 31,300 |

The mixed pair is now withheld until the matching completed generation exists.
No artificial cap on target movement is applied.

## Simulated 4,000-kcal Day

Same .05 kcal/step, resting rate 80/hour, walking pace 100 steps/minute throughout.
The 08:00 starting total is an illustrative observed baseline, not inferred solely
from walking. Last interval includes 500 additional non-step workout kcal.

| Time | Steps | Provider burn | Future rest | P | Target | Remaining | Minutes | Explanation |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 08:00 | 2,000 | 2,260 | 1,280 | 3,540 | 31,200 | 29,200 | 292 | Initial estimate |
| 11:00 | 5,000 | 2,650 | 1,040 | 3,690 | 31,200 | 26,200 | 262 | Expected walking/rest |
| 15:00 | 12,000 | 3,320 | 720 | 4,040 | 31,200 | 19,200 | 192 | Expected walking/rest |
| 20:00 | 16,000 | 4,420 | 320 | 4,740 | 21,200 | 5,200 | 52 | Real extra 500 kcal lowers target |

## Precision and Diagnostics

Keep the established approximate 100-step target display resolution (upward for
required total steps) and nearest-10-kcal burn display resolution; these are display rounding, NOT confidence bounds. At c=.05,
10 provider kcal already represent 200 steps, so individual-step precision for
the forecast itself is unjustified. No measured residual distribution supports a
new confidence range or a specific larger rounding/hysteresis threshold. The
existing "I'd need about" supplies qualification. Exact remaining steps are only
the arithmetic difference from the rounded target, not a claim of predictive accuracy.
Do not add arbitrary smoothing, daily locks or maximum movement caps.

No production health telemetry added. Deterministic reproduction and persistence
tests provide evidence without logging health values or account identifiers.

The step-target forecast may evolve as new activity data arrives, but changes must
be explainable by coherent new evidence. Do not introduce arbitrary smoothing or
silent model changes without product approval.

## Presentation Firewall

Step Planning presentation is founder-approved and locked independently of the
forecast model. Follow the canonical sequences and typography contract in
`phase-1-pre-android.md` under "Approved Step Planning Design Lock". Do not
reorder, flatten, resize, or restyle the cards without explicit product approval;
only necessary accessibility wrapping may adapt the layout. Both remaining-step
lines use the same dark bold emphasis. Total-step target, actual-burn result
within its equation, and walking time stay green; session text stays dark.
Compact inline inputs, initial-focus selection, spacing, and session copy remain
unchanged. Model maintenance is not authorization to redesign presentation.


## Phase 2A — Timestamp Correction (2026-10-14)

Founder approved timestamp correction, conservative rounding and midnight
feasibility. This does not approve a different active-plus-rest model.

### Initial coverage-only correction (superseded by provider-aware approval below)

- `importedAt` / persisted `retrievedAt`: retrieval/ingestion time, not a coverage claim.
- `forecastCoverageAt`: nullable, verified coverage of the particular cumulative
  expenditure observation. It must be inside its local date and no later than retrieval.
- `updatedAt`: database record update time. Legacy `providerUpdatedAt` stays in the
  ingestion ordering contract, but neither timestamp anchors the forecast.

No legacy timestamp is backfilled into verified coverage. A matching prior anchor
may survive a retrieval without coverage metadata only if provider, local date,
timezone, total and component energy values all match. Changed evidence without
coverage clears it; genuine verified coverage replaces it even when calories are
identical. An older retrieval cannot bypass the existing ingestion ordering guard.
Account ownership, source selection and completed matching sync-generation guards
remain in force.

Coverage ages independently of retrieval. After the existing 30-minute freshness
window, forecasts are withheld, not recomputed with a newer invented anchor.
The planning cards also expire cached coverage while open and recheck on foreground.
Unavailable numeric predictions are not interpreted as zero steps.

### Exact regression and proof

With Q=4000/0.8=5000, B=2260, r=80, c=0.05, S=2000 and verified
08:00 coverage, P=2260+80*16=3540. Remaining steps are 29200 and total
steps are 31200. Re-fetching at 08:30 without new coverage retains 08:00:
remaining steps stay 29200. Replacing coverage with retrieval would wrongly
produce P=3500 and 30000 remaining steps.

For fixed evidence and assumptions, P, S, Q and c are constant. Thus
N=max(S,ceil100(S+max(0,(Q-P)/c)))-S is constant while fresh. In the
already-on-track branch N=0. Forward fixed-U additional steps max(0,U-S)
and projected burn P+c*max(0,U-S) are also constant. Advancing only the
clock changes feasibility/freshness, never the numeric step requirement.

Genuine 08:30 evidence B=2300 gives 29200 remaining; B=2290 gives 29400;
a downward revision to B=2200 gives 31200. These changes are not capped.

### Conservative rounding

Nearest-100 could recommend only 100 remaining when 140 were needed (S=2000,
P=4993, Q=5000, c=.05). Upward rounding recommends 200. Preserve the
approximate hundred-step total display, then subtract actual S without a second
rounding. Use unrounded P internally: rounding 4996 up to 5000 would incorrectly
claim no walking was necessary. Rounded ten-kcal values remain presentation only.
Legacy API responses lacking the unrounded value use the lower bound of their
nearest-ten display (display minus 5) rather than an optimistic baseline.

For positive c, ceil100(S+n)>=S+n implies P+c*(T-S)>=Q. The result is
conservative with respect to the existing deterministic model, not a guarantee
of physiological expenditure. No resting calories are subtracted for walking:
personalized walking calories are active calories, added once to remaining rest.

### Midnight feasibility

Compare N/p minutes with the exact UTC duration to next local midnight, calculated
with the user's date/timezone. Equality fits. A longer walk keeps the same required
steps and adds: “At your estimated pace, these steps won’t fit before midnight.”
Both cards retain their approved ordering; the notice follows walking time/sessions.
No start-time advice, pace manipulation or change to the target is introduced.
DST 23/25-hour dates and timezone changes are covered by deterministic tests.

### Provider-aware implementation — founder-authorized continuation

The coverage-only limitation is resolved for planning through the founder-approved
reported-horizon / bounded-assumption architecture. Neither provider currently
proves complete cumulative coverage. `forecastCoverageAt` remains null on both
real adapters. No retrieval or sample end is written into that field.

**Persisted meanings**

- `retrievedAt`: provider query completion on the device/server, separate from
  ingestion `importedAt`, legacy ordering `providerUpdatedAt` and DB `updatedAt`.
  Apple uploads preserve their original retrieval time even after an outbox delay.
- `activeSampleEndAt`, `basalSampleEndAt`: Apple single-statistics-query `endDate`
  values. For HKStatisticsQuery these are latest included sample ends, unlike a
  statistics-collection interval boundary. Preserve both; use the later valid
  included horizon for combined active + basal expenditure. Dates must fall in
  the queried local day and not after retrieval or server receipt. Invalid timing
  expires planning without discarding authoritative expenditure ingestion.
- `reportedIntervalEndAt`: latest populated Google `total-calories:rollUp`
  60-second bucket end. This is reported-data metadata, not cumulative coverage.
- `planningAnchorAt`, `planningAnchorKind`, `planningExpiresAt`: calculation basis,
  provenance (`verified_coverage`, `sample_horizon`, `reported_interval`, or
  `retrieval_assumption`) and durable expiry. `planningProgressAt` is a high-water
  mark for qualifying temporal progress; replaying a historical correction cannot
  create new freshness.

Google daily `total-calories:dailyRollUp` stays the accounting authority. The
optional current-day minute query uses the existing activity read scope and the
same `users/me/dataSourceFamilies/all-sources` family. UTC query bounds come from
actual local midnight (including 23/25-hour DST days), ending at retrieval time.
Pagination fixes the range/family/window across pages, handles `nextPageToken`,
bounds page count, rejects cycles, invalid/overlapping/conflicting intervals and
future bucket ends. Explicit zero-calorie buckets count as reported observations;
missing intervals do not become zero and are never interpolated. Minute sums are
only a consistency check, never a replacement for daily expenditure: a horizon is
eligible only when its rounded sum matches the authoritative rounded daily total.
An unavailable/incomplete/mismatched minute query cannot renew planning. It does
not fail or alter otherwise valid daily accounting ingestion. Historical daily
imports do not add minute queries. No permission expansion or paired-device query.

Provider references: [Google rollUp](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/rollUp),
[calorie capabilities](https://developers.google.com/health/data-types/calories),
[true zeros and missing data](https://developers.google.com/health/data-presence-and-true-zeros),
and [Apple statistics endDate](https://developer.apple.com/documentation/healthkit/hkstatistics/enddate).

**Fallback, revisions and renewal**

1. Without a usable horizon, the first actual retrieval creates an assumption
   anchor once. Its expiry is anchor + 30 minutes, bounded by local midnight.
   Legacy rows are not backfilled from DB update time, and reads never create
   anchors. A first real refresh can initialize a legacy row.
2. Identical expenditure evidence retains anchor and expiry, including after
   expiry. Row writes, new sync sessions, successful requests, steps, pace and
   calibration cannot renew it. Apple upload fingerprints exclude retrieval but
   include both sample ends, so genuine horizon progress is uploaded. Current-day
   expenditure and steps bypass unchanged-upload suppression to keep the existing
   same-session planning guard valid; this does not renew their planning lifetime.
   Historical/intake unchanged-upload suppression remains in place.
3. Advancing valid temporal evidence renews expiry to horizon + 30 minutes,
   bounded by midnight, even when the calorie total is unchanged. An old horizon
   arriving late remains old; no new retrieval grace period hides its age.
4. A revision at the same/older known horizon recalculates expenditure but never
   extends expiry. Unknown-timing value/component revisions use a clearly marked
   retrieval assumption to avoid appending rest over newly included expenditure,
   **without extending the previous expiry**. Once expired, a changed total alone
   cannot revive numerical planning. A high-water mark prevents rewind/replay
   renewal. There is no historical-minimum step cap.
5. Expiry lives in the user/provider/local-date aggregate, not mobile memory.
   Restart, foreground return, remount and account switching cannot reset it.
   Existing source/session readiness and ordering checks remain. Conditional row
   updates retry concurrent changes before computing the persisted state again.
   A timezone mismatch with the stored aggregate withholds planning until a
   compatible ingestion; timezone edits themselves do not extend expiry.

**Numerical evidence**

With Q=5000, r=80, c=.05, S=2000:

| Evidence | Anchor | P | Remaining steps |
| --- | --- | ---: | ---: |
| Initial B=2260, timing unknown | Assumed 08:00 | 3540 | 29200 |
| Same evidence fetched 08:30 | Retained 08:00 | 3540 | 29200 |
| Incorrect retrieval retiming (regression) | 08:30 | 3500 | 30000 |
| Genuine B=2300 with 08:30 horizon | 08:30 | 3540 | 29200 |
| Genuine downward B=2200 at 08:30 | 08:30 | 3440 | 31200 |
| Same B=2260 but genuinely advanced horizon | 08:30 | 3500 | 30000 |
| Known delayed B=2260, horizon 07:00, retrieved 08:30 | 07:00 | 3620 | Withheld: expired 07:30 |

For unchanged evidence, anchor, calibration, goal, steps and other assumptions,
P and both cards' formulas are constant. Only expiry and midnight feasibility
change with the clock. Tests iterate 121 retrieval times through two hours; the
underlying formula stays 29200, while the UI/API stop presenting it after 08:30.
A forward target of 31200 remains 5000 provider / 4000 adjusted kcal while fresh.
An active/basal mismatch uses max(activeEnd, basalEnd): selecting an older active
end over already-included newer basal data would add resting calories twice.

**Consumer behavior and limitations**

Expired planning shows exactly “Waiting for newer activity data.” and hides
numeric predictions, including the resting projection. It retains editable target
inputs and safe confirmed Burned/Steps. Foreground and deadline timers recheck
cached responses; no remount is required. Planning expiry does not create a
“Review Health Connections” action; that action still depends on connection state.
Upward hundred-step rounding, exact total-minus-current steps, personalized pace,
real-time midnight feasibility and the locked card hierarchy remain unchanged.

Reported horizons are not proof of complete/continuous synchronization. Equal
minute/daily sums improve compatibility but do not provide an atomic provider
snapshot. Future/incomplete buckets or disagreement conservatively prevent renewal.
A retrieval assumption is not a guaranteed physiological maximum-step bound:
hidden coverage progress with an unchanged total can require more steps than an
older assumption predicts. That uncertainty cannot be inferred from equal values;
the explicit provenance and non-renewable 30-minute lifetime bound exposure.
Live provider availability and native device behavior remain physical-qualification
work after founder release review. No native dependency or permission changed.

**Files and migrations**

- Domain: `packages/domain/src/forecast-coverage.ts`, `packages/domain/src/index.ts`.
- Contract: `packages/schemas/src/index.ts`.
- Persistence: `apps/api/prisma/schema.prisma`, migrations
  `20261015000000_forecast_coverage` and `20261016000000_planning_evidence`;
  `apps/api/src/modules/today/today.repository.ts`, `today-ingestion.routes.ts`.
- Google: `apps/api/src/modules/google-health/google-health.provider.ts` and
  `google-health.service.ts`.
- Apple: `apps/mobile/lib/healthkit/apple-health-provider.ts`,
  `healthkit-connection.ts`, `rolling-sync-policy.ts`.
- UI: `apps/mobile/lib/today/use-planning-clock.ts`,
  `apps/mobile/components/caloriebank/StepPlanningCards.tsx`,
  `apps/mobile/app/(details)/today-burn.tsx`.
- Tests: new `provider-planning-evidence.test.ts`, `forecast-coverage.test.ts`,
  `forecast-coverage.persistence.test.ts`; extended `phase-one-presentation`,
  `apple-health-adapter`, `provider-selection-google-health`, `progressive-detail`,
  `resting-burn.persistence`, and `step-forecast.persistence` tests.

Both migrations only add nullable planning columns. No accounting backfill and
no destructive statement. Apply them before releasing the new API; new native
wire fields require that API before clients. They have only been applied to the
existing dedicated localhost test database. The API keeps new fields optional
for older clients. The live-text accessibility patch remains in the same batch.

**Validation**

Focused provider/formula/persistence/presentation regression run: 71 tests passed
in four files. These cover identical retrievals, metadata-only changes, Apple
mismatch/invalid ends, Google pagination/zeros/missing intervals/errors/mismatch,
delayed synchronization, revisions, expiry, account isolation, restart/remount,
foreground return, rounding, local midnight and DST/timezone behavior.

Visual review: synthetic React Native Web previews of both cards at 320px and
390px, ready, midnight-infeasible and waiting states. Input alignment, hierarchy,
spacing, result emphasis and copy wrapping passed without clipping. No card style
or navigation changes. This is not physical iOS/Android keyboard qualification.

Final complete release gate: **PASS**, Node v20.20.2, exit 0, 2026-10-14.
`VITEST_MAX_WORKERS=1 TEST_DATABASE_URL=postgresql://kouok@localhost/caloriebank_test_phase1b_20260923 npm run release:friends-family`
passed Prisma generation/validation, local migration deployment, all workspace
typechecks and lint, **1,030 tests in 99 files**, API compilation and
`git diff --check`. This retains the earlier 1,009-test suite and adds 21 cases.
The final run includes the current-day Apple upload-pair regression and the
40-kcal basal-overlap reproduction. An intermediate final run caught an optional
Date typing error in a newly added fixture; it was corrected before the successful
full rerun. Log: `/tmp/cb-phase2-provider-release-gate.log`.

No remaining local implementation blocker. Physical iOS/Android qualification and
live-provider minute-rollup compatibility remain release-review limitations, not
claims established by mocks or web rendering. No production migration, deployment,
mobile build or other feature was started.

**PHASE 2A: IMPLEMENTED — READY FOR RELEASE REVIEW**

Stop for founder review. Keep this correction and the pending live-text
accessibility patch together; neither builds nor backend deployment are authorized
until the next explicit release approval.


## Phase 2A supplementary Fitbit request isolation (2026-10-14)

Controlled release preflight found a previously untested failure: the optional
60-second request shared an HTTP handler that wrote `needs_reconnect` on 401.
The optional adapter caught the error, daily expenditure imported successfully,
and successful sync cleared the error code but left the false connection status.
A local database regression reproduced 2,000 kcal imported with this invalid state.
Release was stopped before production migrations, deployment, or mobile builds.

The correction extracts the existing rolling-sync HTTP boundary into
`google-health-request.ts`. Requests default to authoritative; only the minute
transport explicitly opts into `supplementary`. An authoritative 401 invokes the
same account-scoped invalidation callback and throws AppError-compatible 401.
A supplementary 401 retains an authentication classification but cannot mutate
connection status. Optional success also cannot repair a genuinely invalidated
connection. This makes status independent of request order. Production sequencing
remains unchanged; deterministic boundary tests additionally exercise reversed
and concurrent completions.

The boundary distinguishes authentication (401), authorization (403), rate limit
(429), provider outage (5xx), timeout, network, other HTTP, and malformed JSON.
Missing minute records and schema-invalid minute payloads remain distinct input
cases handled by the existing optional adapter as unavailable temporal evidence.
No provider payload, token, or new permission is exposed. OAuth refresh and other
provider integrations are untouched. This does not claim all optional failures
mean authentication is healthy: authoritative failures still win.

Daily totals remain authoritative. When minute evidence is unavailable, coverage
stays null and existing planning-only fallback rules apply: one assumed retrieval
anchor, original 30-minute deadline, no renewal from identical retries. Expiry
withholds planning numbers without invalidating the connected source or confirmed
Burned/Steps. No forecast equation, rounding, accounting, authority, or accessibility
code was changed by this correction. No new migration is required; the two pending
Phase 2A additive migrations remain unchanged and local-test-only.

Validation: the original failing service/database regression now passes. The
focused run passed 70 tests in four files, including the existing token rotation,
revoked-access, planning evidence, and connection-recovery UI policy tests.
New request tests cover optional 401/403/429/outage/timeout/malformed/missing data,
ordering/concurrency, account-local invalidation, daily imports and fallback expiry.
Live-provider endpoint and physical iPhone/Android qualification remain pending;
mock tests do not establish those outcomes. Production remains untouched.


Final correction gate: **PASS**, Node v20.20.2, exit 0, 2026-10-14.
**1,051 tests in 100 files** (previous baseline 1,030/99; 21 added cases).
Prisma generation and validation, safe local migration deployment (39 migrations,
none pending), all workspace typechecks/lint, domain/schema/API compilation, and
`git diff --check` passed. Logs: `/tmp/cb-phase2-isolation-original.log`,
`/tmp/cb-phase2-isolation-focused.log`, `/tmp/cb-phase2-isolation-release-gate.log`.
The new original-regression fixture also executes an expired-token refresh before
proving daily imports remain connected after the minute 401. Existing encrypted
refresh-token rotation and authoritative revoked-access assertions still pass.

Correction files: `apps/api/src/modules/google-health/google-health-request.ts`,
`apps/api/src/modules/google-health/google-health.service.ts`,
`apps/api/tests/google-health-request.test.ts`,
`apps/api/tests/provider-selection-google-health.test.ts`, and this document.
HEAD remains `6a9c060b8bf5bd8bb79abde829a665e17d118df2` on
`codex/private-beta-release`; the combined Phase 2A/accessibility/correction batch
is uncommitted. No clean release commit or deployment claim is made.

**PHASE 2A: CORRECTION VALIDATED — READY TO RESUME RELEASE QUALIFICATION**

Stop under the delivery hold. No production migration, deployment, builds,
credential change, permission expansion, or new roadmap feature is authorized by
this correction task. Live provider and physical qualification are still required.
