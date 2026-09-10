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
- Banking Goal follows Available Bank, then Today so far. Banking Goal is the
  consumer name for existing Planned Treat functionality, not ADR 013 allocation
  implementation. Existing records, amounts, progress, and ledger neutrality stay
  unchanged. Internal Planned Treat names may remain for compatibility.
- An empty Banking Goal shows explicitly labeled example content, never saved
  user data: Crumbl cookies, 5,000 kcal, and a create action.
- History uses Banked and Deficit/Maintenance/Surplus. Current Goal becomes Fitness
  Goal. Onboarding may retain Lose/Maintain/Gain weight choices.
- Today so far orders Eaten, Burned, Steps. Its detail reuses existing rest-of-day
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
confirms the target on the Fitness Goal form, saving it before the Fitness Goal
so partial failure cannot save the goal without the target. Server onboarding
stages remain backward-compatible with existing TestFlight clients, which retain
the safe zero default. Target writes have an independent 60-per-15-minute limit.

The shared StepPlanningCards component calls the existing bidirectional domain
functions in both Today detail and Steps. Walking pace is a separate read-only
Today response field, based on the selected activity source. No native dependency
is added. Existing `showPlannedTreat` persistence is retained for compatibility,
but the Phase 1 Banking Goal card is always visible and follows Available Bank.

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
