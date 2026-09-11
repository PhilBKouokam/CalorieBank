# Step Target Forecast Stability

## Contract and Equations

Planning only; no changes to finalized accounting, source authority, Opening Bank,
Recovery, Daily Bank Target, ledger or History. Preserve the approved card order.

Let A = requested actual burn, f = adjustment factor (currently 0.8), B = observed
provider burn, r = historical provider resting calories/hour, H = hours remaining
at the burn observation, S = observed steps, c = calibrated provider calories/step.

- Provider target Q = A / f; 4,000 / 0.8 = 5,000.
- At-rest day projection P = round10(B + r * H).
- Additional steps = max(0, (Q - P) / c).
- Total target T = max(S, round100(S + additional steps)).
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
| H | Burn observation timestamp to local midnight, DST-aware | Must not shrink just because cached data is read later |
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
   H now uses providerUpdatedAt (query observation time for current supported
   adapters), falling back to persisted updatedAt for legacy rows.
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

Keep the established approximate 100-step target display resolution and 10-kcal
burn resolution; these are display rounding, NOT confidence bounds. At c=.05,
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
