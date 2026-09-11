# Phase 1: Pre-Android Product Coherence

Status: implementation and local release validation complete; deployment and the
founder preview are recorded in the release report. Physical iPhone QA is required
before TestFlight promotion. This document does not claim physical QA occurred.

## Daily Bank Target Contract

Daily Bank Target is a user's preferred amount of additional calorie flexibility
to bank on a typical day. It is planning metadata only. It is not the fitness
deficit, a guaranteed deposit, a requirement, an accounting adjustment, or a
historical rewrite. Existing users default to zero (no active target). New users
explicitly choose or accept a displayed target after configuring their Fitness
Goal; zero is allowed. Settings must permit changing it later.

No accounting calculation may read this preference. Identical expenditure,
intake, fitness adjustment, completed dates, Opening Bank inputs, and historical
source authority must produce identical contributions, ledger transactions,
Available Bank, Recovery, Opening Bank, and History for every Daily Bank Target.
Changing the preference must not restart Opening Bank preparation.

For future design only: 3,000 kcal adjusted burn minus a 500 kcal fitness deficit
minus a 200 kcal Daily Bank Target gives a 2,300 kcal planning point. Phase 1
does not expose this as an Eating Budget or intake recommendation. Later planning
must establish feasibility and safety constraints before translating a target
into intake or activity prescriptions. A target is not a medical recommendation.

## Consumer Presentation

- Available Bank remains dominant; the latest completed contribution becomes
  supporting banked/enjoyed/on-target copy within that card.
- Conditional Recovery immediately follows Available Bank; Banking Goal follows
  Recovery when active, otherwise Available Bank, then Today so far. Banking Goal is the
  consumer name for existing Planned Treat functionality, not ADR 013 allocation
  implementation. Existing records, amounts, progress, and ledger neutrality stay
  unchanged. Internal Planned Treat names may remain for compatibility.
- An empty Banking Goal shows explicitly labeled example content, never saved
  user data: Crumbl cookies, 5,000 kcal, and a create action.
- History uses Banked and Deficit/Maintenance/Surplus. Current Goal becomes Fitness
  Goal. Onboarding may retain Lose/Maintain/Gain weight choices.
- Home Today so far orders Burned, Eaten without duplicating the dedicated Steps
  card. Detail groups Burned, Eaten, Steps in its first summary and reuses existing rest-of-day
  and bidirectional step planning without changing calculations or removing Steps.
- Apple Health food-tracker help explains how to enable calorie sharing using
  verified tracker instructions; unknown trackers receive generic guidance.
  Missing samples are not proof that sharing is disabled. Direct providers must
  never receive Apple Health recovery instructions.
- Morning Bank Update preserves Available Bank first and contribution second.
  Only positive contributions add the single celebration emoji to the title.
  Delivery window, eligibility, retry, and account privacy remain unchanged.

## Walking-Time Contract

Use the most recent two to five valid walking workouts in a bounded recent
history, with directly observed duration and steps. Do not reuse running samples
from the separate step-calorie estimator. Exclude duplicate, non-walking,
non-positive, non-finite, and clearly unusable samples. Use median steps per
minute. Insufficient evidence omits the estimate rather than inventing a pace.
The initial evidence filter uses 30 days, one current selected source, completed
walks, and a broad 10-250 steps/minute corruption guard. This is an input-quality
guard, not a recommended pace. Requests exceeding 24 hours of estimated walking
are omitted rather than presented as a useful daily plan.

For a positive estimated duration, use the minimum session count
`ceil(totalMinutes / 25)`, dividing time evenly with approximate human rounding.
No suggested session exceeds 25 minutes. These are optional planning suggestions,
not scheduled events, health prescriptions, or calorie-accounting inputs.

## Implementation and Release Gates

1. Inspect existing preferences, onboarding, Home, source guidance, steps, tests.
2. Record this contract before implementation; add only necessary additive
   preference persistence with a zero default and persistence coverage.
3. Implement Home/Banking Goal and History/Fitness Goal presentation.
4. Reuse Today detail planning, add verified tracker help and push copy polish.
5. Add platform-neutral walking-time calculation and compact presentation.
6. Extend `npm run release:friends-family` coverage, including an accounting
   before/after persistence fixture, source matrix, and rendered journeys.
7. Run full API tests against the dedicated localhost test database, TypeScript,
   lint, production build, Prisma/migration and Expo checks, and diff checks.
8. Inspect changed UI at 320 and 390 pixels and enlarged text where practical.
9. Commit/push only intended changes; deploy required backend services through
   existing Render migration machinery and verify the exact commit and health.
10. Create one final preview build after all gates. Do not submit to TestFlight.
    Founder physical QA and explicit promotion approval remain required.

## Implementation Notes

The release gate includes `phase-one-presentation.test.ts`, `walking-time.test.ts`,
and the Daily Bank Target before/after fixture in Opening Bank persistence tests
through its full-suite invocation. The local run passed 52 files / 641 tests.
Rendered React Native Web fixtures were inspected at 320 and 390 pixels, plus
30% enlarged text at 320. Home, target input/Settings, planning detail, and help
had no horizontal overflow. Native keyboard, permission, and notification behavior
remain physical QA, not claims established by web rendering.

Daily Bank Target uses additive `user_profiles.daily_bank_target_calories` (zero
default) and `daily_bank_target_chosen_at` fields. The authenticated target
endpoint updates only these fields. Values are whole kcal from 0 through 2,000;
this storage/input bound is not a recommendation. Completed onboarding users
remain complete regardless of whether they have chosen a target. The new app
uses five steps: burn source, food source, Fitness Goal, Daily Bank Target, then
bank preparation. The target is a separate screen resumed from its persisted
chosen marker; source steps cannot satisfy it. Server onboarding stages remain
backward-compatible with existing TestFlight clients, which retain
the safe zero default. Target writes have an independent 60-per-15-minute limit.

### Physical-QA Corrections

#### Approved Step Planning Design Lock

Founder-approved presentation is locked: information hierarchy, emphasis,
spacing, compact input pattern, input behavior, and result ordering must not
change without explicit product approval. Necessary accessibility wrapping may
adapt the layout without changing the semantic order. The shared implementation
is `apps/mobile/components/caloriebank/StepPlanningCards.tsx`.

Canonical burn-card sequence (illustrative values, not calculation fixtures):

```text
If I want to burn...
[ 3500 ] calories
~4,380 Fitbit calories
I'd need about
22,100 total steps
4,157 steps remaining
About 43 min
2 × ~22 min walks
```

Canonical walk-card sequence (illustrative values, not calculation fixtures):

```text
If I walk...
[ 20000 ] steps
Projected Total Daily Fitbit burn
~4,200 kcal
Estimated Total Daily Actual Burn
4,200 × 0.8 = 3,360 kcal
About 2,057 more steps
About 21 min
1 × ~22 min walk
```

The title is bold; inputs remain compact with inline units and select-all on
initial focus. Source translations and supporting headings stay readable and
semibold. Total steps remain the largest green result (26px/800). Only the
actual-burn result inside the preserved equation uses green (21px/800).
Both remaining-action lines share `remainingSteps`: dark `colors.text`,
20px/700, subordinate to the total-step target. Time stays green 21px/700;
sessions stay dark 16px/600 with natural accessibility wording. Preserve the
existing card padding, dimensions, result gaps, and input/unit wrapping; do not
flatten this hierarchy or introduce full-width inputs.

Future explicitly approved activity equivalents use this semantic template:
question -> compact editable input -> translated/projected outcome -> primary
result -> remaining action -> time -> sessions. Adapt activity-specific labels
truthfully rather than mechanically copying Fitbit or walking labels. This
contract does not authorize new activity cards or Android implementation.

The Step Planning cards ("If I want to burn..." and "If I walk...") have an
approved consumer hierarchy and must not be visually restructured, reordered,
or flattened without explicit product approval. This order supersedes earlier
Phase 1 presentation experiments. Future Android adaptations must preserve the
same semantic hierarchy while using native layout conventions.

"If I want to burn...": compact bold number with inline "calories" -> approximate
source calories (for example, "~5,000 Fitbit calories") -> "I'd need about" ->
large bold green total steps -> remaining steps -> green semibold walking time ->
dark semibold session suggestion. Preserve the existing already-on-track state.

"If I walk...": compact bold number with inline "steps" -> "Projected Total
Daily [source] burn" -> approximate provider kcal -> "Estimated Total Daily
Actual Burn" -> provider kcal x adjustment = actual kcal -> remaining steps ->
walking time -> session suggestion. Never move the source estimate below time,
or replace the equation with a standalone actual-burn value.

Use readable semibold headings and generous separation between groups. Inputs
stay compact and the input/unit row may wrap at accessibility text sizes. Time
and sessions are appended at the bottom, never interleaved with source math.
Source names must remain truthful, not hard-coded to Fitbit. All calculations,
insufficient-data behavior, and walking evidence requirements are unchanged.

Home order is Available Bank -> Recovery (only when positive) -> Banking Goal ->
Today so far -> supporting cards. Recovery copy and calculations are unchanged.

Final planning polish restores compact, wrapping number/unit rows. Input width
scales with system text size; total steps and adjusted burn are the primary
answers. Walking duration and sessions use stronger typography. All existing
planning and walking calculations are reused unchanged.

The Fitbit callback regression was caused by the pending-deletion middleware
resolving a bearer-authenticated user on an intentionally public callback.
Render recorded GET `/v1/me/integrations/fitbit/callback` returning 401 at
19:01:12, 19:01:32, and 19:02:09 CDT on September 10. The canonical GET callback
allowlist is now shared with that guard. Account ownership still comes only from
the persisted OAuth attempt; an unavailable/deleting owner is rejected. Failed
callbacks return a fixed CalorieBank deep link without provider error contents,
and mobile checks the explicit outcome before selecting Fitbit. This failure
does not establish any Google OAuth test-user configuration problem.

Correction validation: `release:friends-family` passed 55 files / 664 tests
against the dedicated localhost test database, including persistence, source
journeys, refresh concurrency, and deletion recovery. Changed component fixtures
were rendered at 320px and 390px, plus enlarged text at 320px, with no detected
horizontal overflow. These checks do not substitute for physical iPhone QA.

Contribution sentences emphasize the amount while retaining a coherent spoken
sentence. Planning-card primary step results use prominent green typography;
their calculations and the walking estimator are unchanged.

The authenticated root alone owns background/inactive-to-active refreshes,
including initial active entry. Screen mounts only read models. Overlapping
automatic calls coalesce, manual calls serialize, account generations discard
stale completions, and sign-out pauses work before device release. Foreground
requests bypass the old five-minute provider cooldown; scheduled execution keeps
its existing policy. The authenticated refresh allowance is 60 per 15 minutes.
Read-only detail subscribers retain known data through transient failures.

Deletion evidence: the physical request at 15:32:10 returned 502 in 194 ms;
there was no identity-deletion event. The old provider revoker rejected every
non-200 result without recording its reason, so the exact historical remote
error cannot be recovered from those logs. Its confirmed idempotency defect is
that Google's documented `invalid_token` (expired/already revoked) blocked
deletion. The fix accepts only that exact 400 response, verifies the cached
access credential too when necessary, and retries transient failures boundedly.
Other rejections still block destructive cleanup and receive safe diagnostics.

The additive `users.deletion_requested_at` marker persists explicit deletion
intent before external cleanup. Pending accounts cannot use normal account APIs
or send notifications. The hosted worker retries up to 50 pending accounts per
run; provider revocation still precedes Clerk deletion and database cascades.
Clerk 404 and an already-absent internal account are idempotent success. This
prevents a process/database interruption after Clerk deletion from stranding
local records with no authenticated retry path. No extra health data is stored.
The deletion request alone has a 60-second client timeout for bounded multi-step
cleanup; ordinary networking timeouts are unchanged. Apple Health remains
iOS-managed; FatSecret credentials still cascade under its existing contract.

The shared StepPlanningCards component calls the existing bidirectional domain
functions in both Today detail and Steps. Walking pace is a separate read-only
Today response field, based on the selected activity source. No native dependency
is added. Existing `showPlannedTreat` persistence is retained for compatibility,
but the Phase 1 Banking Goal card is always visible and follows the bank's
conditional Recovery presentation, or Available Bank when Recovery is inactive.

Apple documents that the notification system supplies its app-name and icon
header: [notification appearance](https://developer.apple.com/documentation/usernotificationsui/customizing-the-appearance-of-notifications).
Expo's name remains CalorieBank and the existing icon and native identities remain
unchanged. Only a positive contribution adds the celebration emoji to the title.

Cronometer instructions were checked against its official
[Apple Health guide](https://support.cronometer.com/hc/en-us/articles/360020734212-Apple-Health-Apple-Watch).
The exact verified `CRONOMETER-GOLD` identity receives its menu-specific help.
Other identities use durable generic instructions rather than guessed menu paths.
An explicitly chosen Cronometer onboarding option may show the same help before
samples exist. No-sample guidance does not assert a permission diagnosis.

## Deferred Work and Android Boundary

Android is next, but is not implemented here. New planning models must be
platform-neutral; Apple Health permission and tracker guidance remain iOS-specific
and will need a separate Health Connect integration. Do not assume iOS permission
or writer identities exist on Android.

Automatic bank protection is a future audited adjustment design problem, not
permission to lower historical fitness goals. Future historical correction must
retain original values, an adjustment event, its reason/source, resulting bank
adjustment, and auditability. No History pencil editing is added here.

Favorite-activity intelligence follows Android and Burn / Eat / Bank foundations.
Running, cycling, hiking, boxing and other activity-specific planning are deferred.
No Emergency Bank, full Burn / Eat / Bank, Eating Budget, social, CB Coins,
automatic historical edits, or additional notification behavior is authorized.
# Forecast Stability Addendum

The canonical forecast equations, coherent-snapshot requirement, precision policy,
and accounting firewall are recorded in [Step Target Forecast Stability](step-target-forecast-stability.md).
