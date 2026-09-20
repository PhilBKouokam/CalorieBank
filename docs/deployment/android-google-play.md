# Android Google Play testing distribution

Status (September 20, 2026): Organization account ACTIVE; canonical CalorieBank app
created; declarations and approved listing saved; one-founder Friends & Family list
selected for Internal Testing. The first and only store AAB compiled successfully (1.0.0 / 2) and was uploaded.
Internal Testing is ACTIVE / available to internal testers. Pixel Play migration
and smoke testing remain pending; store listing/declarations are not yet reviewed. Current evidence is at the end of
this document; earlier dated findings are historical, not current blockers.
Frozen product qualification: `37dfad4`; implementation `5231b3d`; qualified APK
`7de86e07-019b-45b3-8e21-33edd6e94e23` retained.

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

## Organization enrollment — September 19, 2026

- Founder explicitly confirmed the existing Google account as the permanent owner.
  No new Google account was created; private credentials/contact details are omitted.
- Play Console displays **Near Future I-X**, **Organization account**. Organization
  details resolve to **Near Future I-X, Inc.**; founder confirmed legal name/address
  match the organization's records. D-U-N-S match is founder-confirmed; no number
  was requested, copied or retained.
- Founder personally completed organization/Payments profile screens, legal terms
  and registration payment. Google displayed a one-time USD25 fee; completion is
  founder-confirmed. Payments profile step is complete; no independent financial
  verification status is inferred from that step alone.
- Founder supplied identity/organization evidence directly. Final approval is not
  established by account creation. Console requires completing verification before
  creating apps; no ACTIVE/publishing-ready verdict yet.
- Organization website recorded by founder: `https://philbk.dev`. Founder separately
  authorized adding Google's DNS TXT ownership record and establishing Search
  Console domain ownership for the same Google account. Search Console showed
  **Ownership verified**; Play Console subsequently showed **Website verified**.
  Only an additive apex verification TXT was created; website, legal-page, Clerk and
  Zoho records were not edited. Retain this TXT to maintain ownership verification.
- Public support email remains `support@caloriebank.philbk.dev`; mailbox previously
  verified. The public profile's saved email was not independently re-inspected here.
- Remaining visible task: verify both private Google contact and public developer
  phone numbers. Founder asked to handle SMS/call codes directly. Google states
  identity-document approval must precede phone verification. Actual document-review
  status requires confirmation; no documents/numbers saved in evidence.
- Official requirements rechecked: organization legal name/address and developer
  email/phone are public; private contact details are distinct. The 12-testers/14-day
  rule is documented for newly created **personal** accounts. No organization-specific
  testing restriction is shown in the inaccessible app-creation flow; inspect actual
  account capabilities only after activation, without creating an app.
- Legal resources published separately in `9696904`: privacy and deletion pages at
  `https://caloriebank.philbk.dev/privacy` and `/delete-account`.
- No app/AAB created, no public release, no Render/TestFlight/product changes.

Sources checked September 19:
[Required account information](https://support.google.com/googleplay/android-developer/answer/13628312?hl=en),
[Identity verification](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en),
[Personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

Next: founder completes phone verification or reports Google's identity-review hold;
then inspect account status. Do not create CalorieBank until separately authorized.

## Enrollment completion — September 19, 2026

**GOOGLE PLAY ORGANIZATION ENROLLMENT: ACTIVE — READY TO CREATE CALORIEBANK**

This completion supersedes the intermediate pending observations above.

- Existing founder-approved Google owner used; no new Google account or credentials.
- Type: Organization. Developer name: Near Future I-X. Resolved legal entity:
  Near Future I-X, Inc. Founder confirmed D&B legal name/address match. No sensitive
  identifier, private phone/address, identity document or payment data retained here.
- Founder confirmed personally completing terms and the displayed USD25 registration
  payment. Organization Payments profile enrollment step completed; no merchant or
  monetization setup performed.
- Google notification explicitly stated **Your identity has been verified successfully**.
- Search Console domain ownership and Play organization website `https://philbk.dev/`
  verified using the separately founder-approved additive apex TXT record.
- Developer account summary shows **Website verified**, **Contact email address
  verified**, **Contact phone number verified**, **Developer email address verified**,
  and **Developer phone number verified**. Public developer email is the approved
  `support@caloriebank.philbk.dev`.
- Home no longer shows the finish-setup warning. **Create app** is enabled, and the
  account has no apps. This is the evidence for account activation/readiness; it is
  not app approval or public-release authorization.
- Official 12-testers/14-days requirement is scoped to new personal developer
  accounts, not this Organization account. No personal-account production-access
  gate is displayed. Testing tracks are app-level and were not opened because the
  founder expressly forbids app creation in this task. Internal/closed-track setup
  remains the next separately authorized phase; no universal review exemption is
  claimed for organizations.
- No Play app, AAB, upload, testing release or public release created. No Android/iOS
  build, Render deployment, TestFlight, Firebase, Clerk, accounting or product change.
  Health Connect burn remains disabled. Legal-page and Zoho mail DNS were unchanged;
  the sole DNS addition was the explicitly approved Search Console ownership TXT.

Next: await explicit founder authorization to create the CalorieBank Play application.
Then inspect app-level testing/declaration requirements before any AAB or release.

## Play application and reviewer-access preparation — September 19, 2026

Status: **in progress; no AAB or testing release created**. This supersedes the
previous instruction to await app-creation authorization: the founder subsequently
explicitly authorized app creation and Internal Testing preparation.

- Canonical CalorieBank Play application created, default language English (United
  States), App, Free. Play application ID: `4972476114053951321`. Intended Android
  package remains `com.caloriebank.mobile`; binary/package upload is still pending.
- Founder personally completed the app-creation declarations. Privacy URL saved:
  `https://caloriebank.philbk.dev/privacy`. Current ads declaration saved as No ads.
  Remaining declarations, target audience, signing and store assets are not complete.
- Dedicated reviewer identity uses the organization-controlled support mailbox.
  Founder privately established its password. Android production sign-in succeeded.
  Founder explicitly approved Clerk's **per-user Bypass Device Trust** for this
  reviewer only. A subsequent fresh-browser password sign-in did not require email
  verification. Global Device Trust and other accounts were unchanged. Credentials
  are not stored in this repository.
- Hosted web sign-in without an Android callback reached the website root's 404;
  this does not describe the Android callback result. Android sign-in was separately
  confirmed successful. No website/auth routing change was made.
- Founder created dedicated FatSecret and Google/Fitbit accounts for review, using
  the support identity, and completed the provider authorizations in CalorieBank.
  No founder diary or wearable account was attached for review.
- On the physical Pixel, normal onboarding continued through FatSecret, Maintain,
  Daily Bank Target 0, bounded preparation, and Today. With no completed-day paired
  history, Today truthfully showed an uncalculated bank. No database seeding,
  accounting bypass, invented wearable measurements or new app code was used.
- Founder authorized test diary fixtures in the dedicated FatSecret account. A
  clearly labeled review fixture totaling 72 kcal was saved for September 19,
  matching the Pixel's local date. FatSecret's website called this date Yesterday
  while the Pixel was still September 19 CDT; the explicit date was preserved.
  After unlocking, the physical Pixel displayed Eaten 72 kcal and Imported from
  FatSecret through the normal application flow. Current Fitbit burn was also
  present; Available Bank correctly remained uncalculated without completed-day
  evidence. This verifies the test fixture was ingested without direct database edits.
- Fitbit documents manual activity logging, but this is not equivalent to
  sensor-recorded paired steps/workout evidence. No fabricated Fitbit activity or
  steps were added. No supported provider sandbox/sample-data path was established.
- Founder completed the Play App access full-access confirmation. Saved the
  reviewer details; Google displayed Change saved and the dashboard marked Sign in
  details complete (3 of 11 setup tasks complete). This is saved configuration, not
  a submission for review. Instructions disclose limited completed-day history and
  device-dependent Health Connect evidence.
- Target audience now exposes 13–15, 16–17, and 18 and over. No range selected;
  current-release 18-and-over recommendation awaits explicit founder approval.
  This does not establish a permanent product age policy.
- No AAB, preview APK, iOS build, Render deployment, TestFlight change, Production
  release or Open Testing release. Health Connect burn remains disabled.

Relevant official guidance:
[Play reviewer access](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en),
[Clerk Device Trust](https://clerk.com/docs/guides/secure/device-trust),
[Fitbit manual activity logging](https://support.google.com/googlehealth/answer/14236402?hl=en).

### Declaration progress — September 19 evening

- Founder approved **18 and over** for this V1 release only; saved. Optional separate
  Google minor-blocking restriction was not selected. This is not a permanent age
  policy or a change to published privacy wording.
- Founder completed the IARC terms step and questionnaire. Corrected the current
  release's user-to-user sharing answer to No (future Social is not implemented).
  Saved questionnaire and summary: ESRB Everyone, PEGI 3; content ratings are
  separate from intended audience. No submission/publication performed.
- Health saved: Activity and fitness; Nutrition and weight management. Google
  requested no additional regional documentation. No medical category selected.
- Government apps saved No. Financial features saved None; calorie banking is not
  financial banking. Dashboard then showed 8 of 11 setup tasks complete.
- Store category saved Health & Fitness. Public listing support email saved as
  `support@caloriebank.philbk.dev`. No private phone published; optional website
  left blank rather than pointing users at the currently unavailable product root.
- Data safety draft saved with collection Yes, observed password/verification
  authentication methods and the published deletion URL. Encryption-in-transit
  and transfer-exception classifications remain pending evidence resolution; not
  submitted. Expo documents HTTPS forwarding to Apple/Google. Render documentation
  distinguishes mandatory external TLS from optional internal database TLS; do not
  infer live internal TLS solely from the Blueprint private connection URL.
- Founder asked to review Google's service-provider/user-initiated transfer
  exceptions; no approval recorded yet. This is separate from the published
  no-sale commitment and does not imply absence of third-party processing.

Sources checked: [Google Data safety definitions](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-AE),
[Expo notification transport](https://docs.expo.dev/push-notifications/faq/),
[Render database connection encryption](https://render.com/docs/postgresql-creating-connecting).

### Data safety saved; in-app policy-link blocker — September 19

Founder approved applying Google's service-provider and qualifying user-initiated
transfer exceptions only where supported. Data safety was completed and saved in
Publishing overview, not sent for review. Dashboard shows **10 of 11 complete**.

Collected, retained categories: email, user IDs, health information, fitness
information, diagnostics, app interactions, optional other user-generated content
(planning labels/content), and device/other identifiers. No advertising purposes.
Health/fitness purposes: app functionality. Identity purposes: functionality,
security/account management. Diagnostics/interactions include debugging analytics
and security. Optional push preference does not make every device identifier
optional: authentication/device identification also occurs. No independent security
certification claimed. Published privacy/deletion URLs are included.

Encryption answer Yes is scoped to Google's documented device-to-server transport
question, supported by the hosted-build HTTPS guard, Clerk encrypted transport,
Expo HTTPS delivery and Firebase HTTPS/TLS. It is not a blanket claim about live
internal PostgreSQL TLS; that separate operational uncertainty remains unresolved.
Sources: [Google definitions](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-AE),
[Clerk security](https://clerk.com/security),
[Firebase disclosures](https://firebase.google.com/docs/android/play-data-disclosure),
[FCM TLS](https://firebase.google.com/docs/cloud-messaging/encryption).

**Stop before AAB:** current Google Health Content and Services policy requires a
privacy-policy link or text inside the app in addition to the Play Console URL.
Repository audit found no consumer privacy-policy link/text in `apps/mobile`; the
Settings screen has no policy row. Proposed minimal change: Android Settings row
opening the already-published `https://caloriebank.philbk.dev/privacy`, preserving iOS
and frozen behavior. Founder subsequently authorized this exact minimal change; implementation and validation
are recorded below. No AAB has been created.

[Official health-app requirement](https://support.google.com/googleplay/android-developer/answer/16679511?hl=en)
also requires a non-medical disclaimer and healthcare-professional reminder in the
store description. Store listing remains unfinished; no assets submitted.


### Android privacy link and release preparation — September 19

Founder authorized the minimal Android-only Settings Privacy Policy row. It opens
the existing public HTTPS policy in the system browser, prevents repeat taps while
opening, and offers a calm retry message if launching the browser fails. iOS renders
no new row. Authentication, providers, accounting and notification logic are unchanged.

Validation on the final implementation:

- `release:friends-family`: PASS, 830 tests in 74 files; Prisma generation, validation
  and localhost-only test migrations, workspace TypeScript, API/mobile lint and
  API/domain/schema builds. One existing Today hook lint warning; no lint errors.
- Three new rendered component regressions cover the exact HTTPS URL, retry after
  failure and iOS absence. One intermediate full run hit an existing persistence-test
  five-second timeout; the final unmodified full rerun passed. No test limit was raised.
- Local RN-web rendering of the actual row at 320px and 390px, including enlarged
  text and browser-failure state: readable, wrapping, reachable control, no clipping.
  This is a component layout check, not physical verification of the new row.
- Public policy GET returned HTTP 200.
- Expo store/preview/iOS config resolved. Store package `com.caloriebank.mobile`,
  marketing version `1.0.0`. Store has READ_NUTRITION only; preview retains explicit
  qualification reads. Isolated Android prebuild passed; generated manifest includes
  only READ_NUTRITION positively and removal directives for the six diagnostic reads.
- Expo dependency compatibility check passed; Android module autolinking resolved.
  EAS remote Android versionCode read back as 1 (no mutation); the auto-incrementing
  build will allocate the next version. Final AAB merged manifest, signing and native cloud
  compile remain future gates, not claimed here.

Store description is saved as an unpublished draft, including current source
behavior, the non-medical disclaimer and professional-advice reminder. No unreleased
features are advertised. Founder reviewed the feature graphic and requested the exact replacement message
“Save calories for your favorite meals.” The revision is prepared. Asset upload is
blocked by the Chrome extension file-URL permission; no asset was uploaded. Real
Pixel screenshots await an unlocked device and approval. No store assets or declarations have been sent for review.

No AAB/APK/iOS build, Render deployment, TestFlight change or public release.
Health Connect burn remains disabled.

Full workspace `npm test` also passed 830 tests with DATABASE_URL and TEST_DATABASE_URL
explicitly set to the same dedicated localhost release database. An initial standalone
workspace invocation omitted the DATABASE_URL override and encountered the older
local development schema; no production database was contacted and no migration was
run there. The release gate itself always pins DATABASE_URL to its validated test URL.

Commit uses Render's documented `[skip render]` directive to preserve the backend
([official guidance](https://render.com/docs/deploys#skipping-an-auto-deploy)).


September 20: founder revised the feature-graphic message to “Enjoy your favorite
treats guilt free”. SVG/PNG updated; no app code, build or deployment changed.


### September 20 — listing assets uploaded, AI declaration pending

Chrome file uploads now work. Existing icon, revised feature graphic (“Enjoy your
favorite treats guilt free”), and two real Pixel screenshots were uploaded and saved
as an unpublished draft. Founder confirmed the dedicated support reviewer account
and approved the Today/History captures. Screenshots preserve the entire actual UI
with proportional scaling and neutral side padding to 1440 × 2560 (9:16).

Google's Review step introduced an AI asset declaration: “Don't label assets” or
“Label assets as created or edited using AI.” No option selected. The feature graphic
was code-composed by the assistant from existing branding and founder-directed copy;
screenshots were actual device captures. Original icon provenance awaits founder
confirmation. Founder review requested before declaring scope.
[Google's current asset-specific guidance](https://support.google.com/googleplay/android-developer/answer/17262077?hl=en).

Draft saved; nothing sent for review. No AAB, signing enrollment, testing release,
Production/Open Testing release, Render deployment or TestFlight change. Next: resolve
this declaration, complete listing, inspect Internal Testing signing, then create the
one authorized AAB from the validated product.


### September 20 — listing completed and signing inspected

Founder confirmed the original CB icon was AI-generated and explicitly approved
labeling both icon and feature graphic. Those two assets were selected; actual Pixel
screenshots remained unselected. Saved listing status: **Ready to send for review**.
No review submission or public release performed.

Created the first empty Internal Testing release draft. Its enhancements say releases
are signed by Google Play. App signing page reports an existing app signing key **In
use**; no key enrollment/change action was taken. Upload certificate is not yet
registered: Google says it will appear after first bundle upload. Signing compatibility
with the existing preview must be checked before Pixel installation.

The single `play-testing` AAB is next; final code remains the validated privacy-link
implementation (830 passing tests). Tester email requested for the Pixel's actual
Play Store account. Health Connect burn remains disabled.


### September 20 — single AAB build dispatched

Exactly one EAS store build dispatched using `play-testing` and the existing remote
keystore: `4dc1d697-266a-42a7-afd7-a3192daa20cf`, source `88bd631`, marketing version
1.0.0, remote versionCode incremented from 1 to 2.
[Build status](https://expo.dev/accounts/philbk/projects/caloriebank/builds/4dc1d697-266a-42a7-afd7-a3192daa20cf).
This is a build in progress, not an uploaded or available Play release.

Friends & Family email list created with only the founder-approved Pixel Play Store
Google account. List shows one user, is selected for Internal Testing, and was saved.
No other testers invited. The official opt-in link remains disabled until release.

Pending: cloud compile, final AAB manifest/package/version/signature checks, upload,
Google processing and physical Play installation. No second AAB or APK authorized
by this status entry.

### Private testing update workflow

Use the existing `com.caloriebank.mobile` Play app and EAS project. After validation,
build a store AAB with a greater remote Android versionCode, upload to Internal
Testing, review the release and confirm its private rollout. Approved Google-account
testers use the official opt-in link and install/update through Google Play. Device
account, track eligibility, rollout availability and the tester's Play auto-update
settings determine update availability; do not promise an immediate automatic update.

Maintain Friends & Family through the existing email list. Removing an address
removes future track eligibility; it does not remotely erase an installed app or
CalorieBank account. Promote an already-tested artifact to an authorized closed
track only after its applicable setup/review is complete. No Production/Open Testing
release or additional invitation is authorized by this document. Google's personal
account 12-testers/14-days production-access requirement is not automatically an
organization-account requirement. Record any account-specific Console gate before
claiming production eligibility.

### September 20 — native compile and final bundle inspection PASS

EAS build `4dc1d697-266a-42a7-afd7-a3192daa20cf` finished successfully.
[Store AAB](https://expo.dev/artifacts/eas/e4F3l1YJ4J2yyx0xl7LTt3gHYu3uCisOcFUTSYdJtck.aab),
source `88bd631ace0ab716e0e69adeaa2c2a1afd36e989`, version 1.0.0 (2).
SHA-256: `7bde05311eac084c13260e76dc4aa91625e3a166f4bf540620695535bfd4fc10`.

Inspected compiled `base/manifest/AndroidManifest.xml` from the actual AAB, decoding
AAPT2 protobuf XML using Android's official Resources.proto field definitions.
Package `com.caloriebank.mobile`; min SDK 26; target/compile SDK 36. Exactly one
Health Connect permission: `android.permission.health.READ_NUTRITION`. No Health
Connect steps, exercise, distance, active/total calories or BMR reads; no health
write/background/history permission. Health Connect burn remains disabled.

AAB contains the existing upload certificate (SHA-256
`F2:EE:9D:25:B3:E5:E5:54:74:72:50:B1:43:FC:42:2D:96:5A:CD:8D:08:BB:AD:59:87:FB:9B:B4:CC:9C:17:5C`).
Google's app-signing certificate differs; verify installed-preview compatibility
before migration. No signing secrets were exported or changed.

Uploaded this bundle to the existing first Internal Testing draft. Google reports
upload complete and optimization in progress. Release name: `1.0.0 (2) — Friends & Family`.
No second build, Production/Open Testing release, Render deployment or TestFlight change.

### September 20 — Internal Testing available, Pixel migration pending

Google accepted version 2 (1.0.0), min API 26+, target 36, with native debug symbols.
Only warning: no deobfuscation file; generated Gradle configuration defaults release
minification to false. No release error. Internal rollout confirmed at 13:59 local;
Console reports **Active / Available to internal testers / Not reviewed**. Production
is **Inactive**. The temporary listing name is `com.caloriebank.mobile (unreviewed)`.

Private eligible-tester opt-in URL:
https://play.google.com/apps/internaltest/4701187796213670867

Only the founder-approved Pixel Google account is in the selected one-user Friends
& Family list. The link does not authorize arbitrary users. No Open/Production or
Closed release was created. Closed-track assessment follows successful internal
installation; no personal-account tester-count rule is assumed for this organization.

The uploaded manifest triggered a Health Connect Nutrition permission justification.
Entered the prepared exact-origin Nutrition purpose plus explicit read-only/no-burn
scope; retained Activity and Fitness + Nutrition and Weight Management. Google said
no regional health requirements apply, and confirmed the declaration was saved.

Read the installed Pixel preview's v2 signing certificate: it matches the existing
EAS upload certificate, but differs from Google Play's app-signing certificate.
A direct update is not compatible. Requested founder confirmation to sign out, remove
the preview (local session/settings only), install through Play, and sign into the
same server-held account. No account/provider/server deletion is needed. Pixel was
locked; unlock requested. No preview removal or Play-install success is claimed yet.

After saving the Nutrition declaration, the dashboard no longer shows incomplete
app-setup tasks. Publishing overview still keeps **Send app for review disabled**;
listing/declaration changes remain unsubmitted. No review submission is claimed.
This does not prevent the already-active internal release. Follow the actual
Console gating when preparing an authorized closed test after the Pixel check.
[Official testing guidance](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en)
permits fast internal distribution and temporary first-upload listing information;
internal tests may not receive standard policy/security review.
