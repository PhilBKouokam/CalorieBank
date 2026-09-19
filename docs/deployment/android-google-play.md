# Android Google Play testing distribution

Status: technical preparation complete; organization/legal/public-resource input
remains pending. No developer enrollment, app creation, signing enrollment, AAB build,
upload or release submission has occurred. Inspected September
18, 2026 (America/Chicago). Frozen product qualification: `37dfad4`; implementation
`5231b3d`; existing qualified APK `7de86e07-019b-45b3-8e21-33edd6e94e23` retained.

## Observed account state and immediate gates

Play Console redirected the currently authenticated Google account to
`/console/u/0/signup`, showing account-type selection. This establishes no accessible
developer account for that session, not that the founder has no account elsewhere.
Founder must identify/switch to an existing account or resolve legitimate enrollment.
No terms, payments, identity or health attestations were accepted. No duplicate app,
Google Cloud/Firebase project or credentials were created.

Google's [account requirements](https://support.google.com/googleplay/android-developer/answer/10788890?hl=en)
require organization registration for health apps. Its
[health categories](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en)
include nutrition/weight management and activity/fitness. CalorieBank's intended
classification falls within these categories; do not default to personal enrollment
merely to start testing. Resolve applicability with Play support if disputed.
Organization identity, D-U-N-S and payment-profile verification require actual founder
information; no legal identity has been inferred. [Account types](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en).

No public privacy-policy URL or external deletion-request page was found in the
repository search. Founder must supply an existing valid URL or review a proposed
policy before publication. The in-app Health Connect rationale is not a substitute
for a public policy. No legal policy language was invented or published.

## Current official requirements

- [New personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en):
  accounts created after November 13, 2023 need a closed test with at least 12 real
  testers continuously opted in for the preceding 14 days before applying for
  production access. Opting out interrupts that tester's consecutive period.
  Production access requires an application describing testing/readiness; it is not
  automatically granted after the clock expires. Applicability here remains unknown
  until the actual account is identified. Internal testing does not satisfy this gate.
- [Testing tracks](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en):
  internal testing supports up to 100 trusted testers and is the proposed first
  installation/signing check. Closed testing supports controlled email lists or Google
  Groups after app setup. Use a Friends & Family email list, not open testing; no
  testers have been added. Testers need an eligible Google account and the opt-in link.
  Internal availability can be fast but is not a promise of exemption from policy or
  first-release checks. Claim availability only when Console confirms it.
- [Target SDK](https://developer.android.com/google/play/requirements/target-sdk):
  from August 31, 2026 new ordinary Android apps/updates require API 36. Prior qualified
  build evidence targets 36; verify the final AAB rather than relying on source alone.
- [Health permissions](https://support.google.com/googleplay/android-developer/answer/12991134?hl=en):
  request minimum data for actual user-facing purposes, with accurate disclosure,
  consent, security and an accessible privacy policy covering use/storage/sharing,
  retention and deletion. No Health Connect burn support may be claimed.
- [Health declaration](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en):
  closed/open/production apps complete the health-app form. Declare nutrition/weight
  management and actual activity/fitness functionality; not medical/research features.
- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en):
  internal-only apps are exempt from the Data safety form; this does not waive health
  data obligations. Closed testing requires truthful disclosures. Service-provider
  transfers may be exempt from Google's technical definition of sharing only when
  processing solely on the developer's behalf; do not assume contracts meet that test.
- [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en):
  account-creating apps need both in-app deletion and an external web request route.
  A prominent support email/form on a functional app-branded page can qualify; it
  must not require reinstalling the app. Existing physical in-app deletion passed;
  a compliant public web route is not yet verified.
- [User data/privacy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en):
  policy must identify the app/developer and accurately describe practices. Founder
  review required; do not promise unverified retention, security or third-party terms.

## Original permission-minimization finding (resolved by preparation below)

`apps/mobile/app.json` currently declares these Health Connect reads:

| Permission suffix | Current use | Proposed Play consumer build |
| --- | --- | --- |
| READ_NUTRITION | Exact selected-origin consumer intake, discovery/history | Keep |
| READ_STEPS | B2 diagnostic qualification | Remove after approval/validation |
| READ_EXERCISE | B2 diagnostic qualification | Remove after approval/validation |
| READ_ACTIVE_CALORIES_BURNED | B2 diagnostic qualification | Remove after approval/validation |
| READ_TOTAL_CALORIES_BURNED | B2 diagnostic qualification | Remove after approval/validation |
| READ_BASAL_METABOLIC_RATE | B2 diagnostic qualification | Remove after approval/validation |
| READ_DISTANCE | B2 diagnostic qualification | Remove after approval/validation |

`lib/native-health/intake.android.ts` uses `nativeNutritionQualification`, whose
bridge port requests/reads nutrition only. `nativeHealthQualification` retains seven
categories; Settings exposes it for `__DEV__` **or beta environment**, so simply using
the qualified beta environment would ship that diagnostic entry. The rationale in
`plugins/with-health-connect.cjs` also describes broad qualification reads.

Proposed bounded release change (requires report/approval before touching frozen B4):
exclude broad qualification UI/permissions from the Play consumer build while keeping
nutrition and its rationale truthful. Preserve internal diagnostics separately if
needed. Verify no hidden route can request undeclared permissions. Regression-test
nutrition, Fitbit activity/burn and iOS; rerun the full gate and inspect merged AAB
manifest. No write, background or extended-history permission is currently declared.
Do not justify diagnostic-only sensitive permissions as consumer burn functionality.

Proposed nutrition justification for founder review: CalorieBank reads calorie
intake from the food tracker selected by the user to calculate and display their
calorie bank. Actual completed-day accounting remains server-authoritative.

A fresh installed-manifest/version read could not run because adb reported no device.
Source declarations above are verified; final binary manifest remains a required gate.

## Data safety working inventory — not submitted/attested

| Data | Evidence/use | Preparation status |
| --- | --- | --- |
| Email and account identifiers | Clerk authentication, internal account ownership | Collected; account management/functionality; required for account use |
| Nutrition, burn, steps, exercise evidence | Selected provider imports and normalized account records | Health/fitness collection for functionality; provider choices optional, usable source roles required for bank setup |
| Exact source package/provider identity | Independent role selection and provenance | Disclose alongside connected health functionality; never merge food writers |
| Provider OAuth credentials | Server-managed delegated access/revocation | Sensitive account integration data; not advertising |
| Expo push token/device registration | Optional Morning Bank Update; unique account ownership | Device identifiers/functionality; optional notifications |
| Goal/preferences/sync diagnostics | Persisted setup and operation state | Map exact Play categories after complete SDK/log inventory |

Known processors include Clerk, hosted API/database, Expo push and FCM, plus chosen
providers. Final sharing answers, SDK telemetry, transit encryption across all paths,
retention/backups and optionality require completed architecture/contract review;
not blanket “no sharing.” In-app deletion is physically verified, but that does not
substitute for the external request page or a retention-policy review.

## Build, signing and track plan

Identity remains CalorieBank / `com.caloriebank.mobile`; versionName `1.0.0` in source.
EAS project remains `85fa9667-67bb-4d6c-bbcf-8f4e492ae5f5`; Cloud/Firebase remains
`caloriebank-505623`. No keys read/exported/regenerated. EAS remote version state and
final versionCode have not yet been verified; do not assign a guessed value.

Existing preview profile is internal APK with beta/Clerk environment. Existing
`testflight` extends preview but inherits Android APK buildType; do not use it as
an Android AAB profile. Prepare an explicit Android testing/store AAB profile only
after gates are resolved, using the qualified hosted environment, correct environment
assertion and monotonically incremented remote versionCode. No marketing-version bump
is currently justified.

Inspect existing EAS upload-key and Play App Signing state without exporting secrets.
Pause for founder approval before irreversible signing enrollment. Compare actual
preview and Play signing certificates before attempting an in-place Pixel update.
Different app-signing keys may require uninstall/reinstall; preserve server account
and confirmed sync state, explain local session/permission consequences, and obtain
approval rather than uninstalling unexpectedly. No migration has been attempted.

After legal/privacy/permission gates: run release:friends-family using only dedicated
localhost TEST_DATABASE_URL plus requested type/lint/build/Prisma/Expo/dependency/
autolinking checks; build exactly one AAB; inspect package/version/manifest/signing;
upload internal first, then use the same artifact for a controlled closed track if
appropriate. Submit testing only. Never create a production rollout.

Future updates: validated higher versionCode AAB -> selected test track -> Google
processing/review -> eligible tester Play update (automatic updates subject to user
Play settings). Manage membership in the explicit email list; removal stops future
eligibility, not remote deletion of an already installed app. Promote the same
artifact between authorized testing tracks rather than rebuilding. No opt-in URL,
review status, test period or Play installation is yet available/started.

## Handoff

Pending: founder account/organization clarification, reviewed public privacy/deletion
URLs, reported permission-minimization decision, actual tester emails, signing and
reviewer-access preparation. No new full gate/build is claimed at this preflight
block. B4 app qualification remains valid; Phase C distribution is not live.


## September 18 — authorized release preparation completed

The subsequent preparation request authorized the bounded permission/config changes:

- `app.json` defaults to READ_NUTRITION. `app.config.ts` derives permissions from an
  explicit qualification flag; six diagnostic permissions are blocked with manifest
  removal directives in consumer builds, including transitive library declarations.
- `play-testing` extends the qualified beta/Clerk preview environment, uses store
  distribution + app-bundle, auto-incremented remote versioning, and forces
  `EXPO_PUBLIC_HEALTH_CONNECT_QUALIFICATION=0`. Hosted HTTPS/Clerk checks include this
  profile. This is a prepared profile, not a built/submitted AAB or allocated version.
- Development/preview explicitly set the flag to 1 to retain seven-category testing.
  Production/testflight force 0. Unknown/store profiles reject an attempted flag=1;
  local qualification must explicitly opt in. Merely being beta or __DEV__ does not
  unlock diagnostic reads. This intentionally separates distribution from API/account
  environment and preserves the qualified beta backend.
- Settings entry and direct diagnostic route are gated. Even a direct broad bridge
  call in a Play bundle requests/queries only Nutrition, ignoring old broader OS grants.
- Generated Health Connect rationale accurately describes the selected build.
  There is still no public policy URL; reviewed publication remains a legal gate.
- Fitbit/FatSecret adapters, nutrition normalization/upload/history, accounting,
  consumer onboarding and Step Planning files were not changed. iOS native facade,
  permissions and notification behavior remain unchanged.

Validation: release:friends-family passed on dedicated localhost
`caloriebank_rc_20260907` (Prisma generation/validation/migrations, workspace/API/mobile
TypeScript, API/mobile lint, 827 tests/73 files, API/domain/schema builds). Full workspace
`npm test` also passed 827 tests. Fourteen new permission/profile regressions cover
safe defaults, store escalation rejection, retained explicit qualification, profile
configuration and runtime request/read narrowing. Existing rendered diagnostics test
now verifies direct-route denial even under the beta API environment. Existing source,
onboarding, exact-origin/history and iOS suites passed. One pre-existing Today hook
lint warning remains; no lint errors.

Expo Play/preview/production/iOS configurations resolved using non-secret validation
placeholders (not changed production keys). Android prebuild completed in an isolated
/tmp copy, preserving the repository's native directories. Generated application
manifest has **READ_NUTRITION as its sole positive Health Connect permission**; six
other health entries have tools:node="remove". Generated rationale matches consumer
Nutrition. Preview config retains seven explicit qualification reads. Android Expo
module autolinking resolved. No final AAB merged manifest/native compile is claimed;
that is a gate on the future single AAB. Online Expo dependency validation reports
“Dependencies are up to date”; git diff --check passed. No tests accessed a production
database.

Artifacts for founder review:

- [Organization enrollment checklist](android-organization-enrollment.md)
- [Privacy policy draft](../legal/privacy-policy-draft.md)
- [Account deletion page draft](../legal/account-deletion-draft.md)
- [Data Safety, Health Apps and hosting worksheet](android-play-declarations-draft.md)

Recommended categories: Nutrition and Weight Management **and** Activity and Fitness
(the latter reflects direct Fitbit functionality, not Health Connect burn). D-U-N-S
and organization identity remain UNKNOWN. Proposed URLs are not live or verified:
`https://caloriebank.philbk.dev/privacy` and `/delete-account`; no portfolio/DNS change.
Founder must approve legal content and select a real monitored outside-app deletion
channel. No invented API, service email, legal entity or retention guarantee.

**ANDROID PHASE C PREPARATION: READY FOR FOUNDER ORGANIZATION/LEGAL INPUT**
