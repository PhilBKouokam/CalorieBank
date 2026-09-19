# Google Play declarations — working worksheet, NOT SUBMITTED

Prepared September 18, 2026 for the proposed nutrition-only `play-testing` build.
Founder/legal review required before any attestation. These are engineering findings,
not a completed Play form. Health Connect permissions do not define the complete
app data inventory: direct Fitbit and FatSecret also process data.

## Data safety

“Collected” below means transmitted off-device under Google's definition. On-device
processing alone is separately noted. No category is assumed anonymous merely
because an internal ID or hash replaces an email. “Shared” is unresolved where a
processor-contract or user-initiated-transfer exception needs review.

| Data category / likely Play mapping | Collected / retained | Required or optional | Purpose | Shared? | Transit / deletion |
| --- | --- | --- | --- | --- | --- |
| Email; account/Clerk/provider IDs — personal info/user IDs | Yes, retained by account/auth systems | Account authentication required; provider ID conditional on chosen connection | Account management, functionality/security | Clerk and hosting processing; review service-provider exception and contracts | Hosted app API HTTPS enforced; verify full processor paths. App/Clerk deletion implemented |
| Daily calorie intake — health info | Yes, normalized exact-origin totals retained; raw HC records processed on device; FatSecret diary response transiently processed server-side | Intake source required for bank setup; HC vs direct provider is a choice | App functionality, user-selected bank/history | Hosting; selected providers; verify legal roles, no advertising purpose observed | API/provider HTTPS configured; verify database TLS operationally. Account cascade deletion |
| Expenditure, steps, workout evidence — fitness info | Yes, direct Fitbit normalized totals/session metrics retained | Qualified burn source required; HC activity is NOT requested in Play build | Functionality, forecasts/Step Planning | Hosting/selected provider processing; contractual review required | Same transport qualification; account deletion |
| Exact tracker package, provider selection and timestamps | Yes, retained provenance; no general installed-app inventory scan | Needed when chosen native intake path used | Source authority, history, troubleshooting | Hosting; classify under fitness/other personal data or app activity in final form with policy review | Same transport; account deletion |
| Fitness Goal, Daily Bank Target, Banking Goal and UI preferences | Yes, retained | Setup fields required as applicable; optional planning/customization | Functionality/personalization | Hosting; no social publication workflow | Same transport; account deletion |
| Expo push token, platform, registration timestamps — device/other IDs | Yes, retained with preference/delivery state | Optional Morning Bank Update | Notifications/functionality | Expo/FCM processing; payload can contain bank/contribution values. Review processor exception | HTTPS delivery requests; account-token cleanup/deletion implemented |
| Request/sync/error metadata — diagnostics/app interactions | Yes, server logs and sync records, not purely ephemeral | Operationally generated | Functionality, debugging/security | Hosting/SDK handling requires final inventory/contract review | Log redaction exists; log/backup retention and deletion not fully established |
| Authentication credentials | Clerk processes authentication; CalorieBank uses sessions, not a product password database. Delegated provider tokens stored encrypted | Required for selected auth/provider flow | Account management, functionality/security | Authentication/provider services; final form mapping requires review | Provider token encryption in code; no blanket encryption guarantee across infrastructure |
| Photos, contacts, precise location, medical records | No corresponding consumer collection found in this scope | Not requested | None in current product | Do not attest absent SDK collection without final SDK review | No invented permissions or categories |

All normalized account health records are retained, not “ephemerally processed.”
Remote read-only queries still count as processing; do not say no collection merely
because CalorieBank does not log foods itself. Food descriptions are not part of
native intake upload or persisted daily-intake models. No health-data advertising,
credit/lending, sale or social sharing workflow was found. Final “not shared” and
“encrypted in transit” form answers require operational/contract review across every
included SDK/service; no blanket box has been preselected here.

Evidence: Prisma models User/Profile, ProviderSelection, ExternalProviderConnection,
DailyIntake/Expenditure/StepAggregate, CurrentDayWorkout, IngestionSyncSession,
MorningBankUpdatePreference/Delivery, PushDeviceRegistration; account-safety deletion;
mobile native-intake upload; provider crypto; logger; ClerkProvider token cache.
No backend changes are part of this preparation.

Founder review: processor agreements/locations; hosting backups/log TTL and TLS;
Clerk/Expo/FCM telemetry; user rights/age/legal basis; final optionality under Google's
form definitions; external deletion request channel. See the
[privacy draft](../legal/privacy-policy-draft.md) and
[deletion page draft](../legal/account-deletion-draft.md).

Official definition reference: [Google Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).
Service-provider transfers can be excluded from Google's “sharing” only under the
stated conditions; this does not mean no third party processes data. Internal-only
form exemption does not remove health-data privacy obligations.

## Health Apps declaration

Recommended actual-function categories for founder review:

- **Nutrition and Weight Management:** imported calories eaten, calorie bank,
  weight-goal settings and food-related planning.
- **Activity and Fitness:** direct Fitbit burn, steps, exercise evidence and walking/
  step estimates. Include this because of product functionality even though Health
  Connect burn/activity permissions are absent.

Do not select medical/research categories or claim medical advice/device status.
Do not classify the calorie bank as financial banking. No declaration submitted.
[Google category guidance](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en).

Health Connect permission justification, draft for review:

> CalorieBank reads nutrition from the food tracker selected by the user to display
> calories eaten and calculate their calorie bank using completed-day intake and
> their separately connected burn source. Exact source identity prevents combining
> multiple food trackers. Recent history supports initial preparation and history.

Only READ_NUTRITION in the Play configuration. No writes, background access, broad
history permission, HC steps/exercise/distance/active/total energy/BMR. Fitbit remains
the qualified burn path. Do not justify diagnostic-only reads in a consumer declaration.
See [health permissions guidance](https://support.google.com/googleplay/android-developer/answer/12991134?hl=en).

## Hosting proposal — no publication or DNS changes

Proposed durable URLs (not claimed live):

- `https://caloriebank.philbk.dev/privacy`
- `https://caloriebank.philbk.dev/delete-account`

Use an isolated static subdomain on the founder's existing hosting/DNS provider,
with HTTPS and no app/account dependencies. Keep the portfolio and its routing
unchanged. The founder has identified philbk.dev as a candidate; DNS/hosting control
and legal-entity linkage have not been verified in this task. If subdomain hosting
is impractical, use clearly scoped `/caloriebank/privacy` and
`/caloriebank/delete-account` paths only after inspecting the existing site.
Do not replace the portfolio, create a new Firebase project or deploy the API for
static legal pages. Founder approval of content/operator/request handling precedes
any publication. Organization website verification is separate from publishing a
privacy page and must accurately represent the legal organization.

## Founder-review cross-check — September 18, 2026

Founder identifies **Near Future I-X** as publishing organization; September 19 update:
D-U-N-S issued/available to founder (no number requested/stored). No enrollment continued. See the [claim/evidence audit](../legal/privacy-policy-evidence.md)
and linked clean/annotated drafts. The audit additionally identifies persisted
timezone, onboarding state, Banking Goal name/target and derived bank/forecast records;
include them with product/health information rather than implying only imported data
is retained. Clerk verification/session processing is separate from CalorieBank's
persisted email/auth subject. No CalorieBank password database or DOB field found.

No factual conflict with Nutrition-only Play declarations: internal diagnostic builds
have broader read scope and are explicitly distinguished in the cross-platform policy.
Health Connect burn remains disabled. September 19 resolves no-sale/current-advertising and current non-child-directed wording.
Explicit age ranges, processor classifications, retention review, contact activation
and external deletion operations remain founder/legal decisions.
Google's non-medical health-app description disclaimer is a separate release review
item, not added Terms language in the privacy policy. Nothing submitted or published.

## September 19 publication-candidate alignment — NOT SUBMITTED

- Founder approves: “CalorieBank does not sell personal health information.” This is
  not a blanket Google Data Safety “no sharing” classification. Service-provider
  transfers/exceptions and contracts remain separately reviewed.
- Current V1 shows no third-party ads and does not use health information for ads.
  Proposed Contains ads: No for current build; no advertising purpose selected for
  health records. No permanent no-ad commitment or unreleased Commerce claim.
- Current audience not child-directed; no child/supervised system or numeric age gate.
  [Release-age recommendation and future review](../legal/future-child-and-commerce-review.md)
  requires founder approval before actual age-range selection.
- Health Apps remains Nutrition and Weight Management + Activity and Fitness;
  READ_NUTRITION only in Play, Fitbit direct burn/activity/steps; HC burn disabled.
- Public contact approved but not operationally verified. Clean candidates are proposed
  text, not live resources. [Publication holds](../legal/publication-readiness.md).
- [Retention findings](../legal/retention-resolution.md) distinguish live account
  cascades from backup/log/provider/installation-ID retention. Do not mark all data
  ephemeral or promise deletion of every provider copy on CalorieBank deletion.
- Existing worksheet rows are otherwise unchanged; security/contract uncertainties
  are not converted into affirmative attestations. No declarations submitted.
