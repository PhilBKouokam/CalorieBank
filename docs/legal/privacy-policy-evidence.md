# Privacy and deletion evidence audit — internal, not published

Audit: September 18, 2026 against preparation commit fb0cdb1 and current source.
Documentation-only audit; no production data queried and no new physical tests run.
Founder supplies publishing organization **Near Future I-X**. September 19 update:
D-U-N-S issued/available to founder; no number requested or stored.
See [retention resolution](retention-resolution.md) and [publication holds](publication-readiness.md)
for current status, superseding September 18 unresolved entries below.

## Review package

- [Clean Privacy Policy draft](privacy-policy-draft.md)
- [Annotated Privacy Policy](privacy-policy-review.md)
- [Clean deletion page draft](account-deletion-draft.md)
- [Annotated deletion page](account-deletion-review.md)
- [Play declarations worksheet](../deployment/android-play-declarations-draft.md)

“Clean” means no inline audit commentary or unresolved placeholders. Publication
holds are recorded separately in publication-readiness.md; candidates are not live.
Review copies reproduce the clean text with added blockquote annotations.

## Material claim matrix

Paths below are relative to repository root; symbols/model names are stable search
anchors, not a claim that every deployed setting was inspected live.

| ID / claim in policy or deletion page | Evidence | Boundary / decision |
| --- | --- | --- |
| P1 Operator is Near Future I-X | Founder instruction in this task | Confirm legal spelling/jurisdiction; D-U-N-S issued per founder, not entered or stored |
| P2 Email and verified account identifiers; Clerk authentication/session | `apps/api/src/auth/current-user.ts` VerifiedIdentity, requireUser; `apps/api/prisma/schema.prisma` User; `apps/mobile/app/_layout.tsx` ClerkProvider/tokenCache | Internal DB stores auth subject/email, not its own password or session-ID table. Clerk processes verification/session credentials; mobile retains session credential. Extra Clerk telemetry/retention not audited live |
| P3 Imported calorie totals, activity summaries, source/date/update metadata | schema DailyIntakeAggregate, DailyExpenditureAggregate, DailyStepAggregate, CurrentDayWorkout; `apps/mobile/lib/healthkit/apple-health-provider.ts`; `apps/mobile/lib/native-health/intake.android.ts`; `apps/api/src/modules/fatsecret/fatsecret.service.ts`; `apps/api/src/modules/google-health/google-health.service.ts` | Workout type/display label, timestamps, duration and available energy/steps/distance persisted. No claim all metrics exist for every source |
| P4 Goals, preferences and derived bank/history | schema GoalConfiguration, UserProfile, PlannedTreat, DashboardPreferences, BankAccountInitialization, OpeningBankCalculationDay, FinalizedDailyBankRecord, BankCalculationSnapshot, CalorieLedgerTransaction, RestingBurnEstimate; `docs/product/bank-calculation-spec.md` | Available Bank/Recovery derived, not separate health uploads; Banking Goal name/target may contain user-entered text. Daily Bank Target planning-only. No new accounting behavior |
| P5 Timezone and technical metadata | schema UserProfile/aggregate timezone, IngestionSyncSession, PushDeviceRegistration, MorningBankUpdateDelivery; `apps/api/src/logger.ts` requestLogger | Device platform/push token stored, no IMEI/phone/model field in push model. Request path/status/duration/IDs logged. Error/account fingerprints may remain personal data; redaction not anonymization |
| P6 iOS energy/intake/steps/workouts read on device, normalized upload | `apps/mobile/lib/healthkit/apple-health-provider.ts` HEALTHKIT_READ_TYPES, AppleHealthIntakeProvider, workout mapping; `apps/mobile/lib/healthkit/apple-health-intake-writers.ts`; schema aggregate/workout models | Active/basal/dietary energy and steps/workouts, selected dietary writer. No claim HealthKit backend access or all raw samples persisted |
| P7 Android exact-origin Nutrition and historical/current-day totals | `apps/mobile/lib/native-health/intake.android.ts` refresh/discover/select; `apps/mobile/lib/health-connect/bridge.android.ts`; `apps/mobile/app.config.ts`; `apps/mobile/eas.json` | Consumer upload source, selection revision, observation/query timestamps, timezone and eight dated daily results; no food names/nutrient list upload. Discovery examines origins, not general installed-app inventory. Play READ_NUTRITION only; internal qualification can read six extra categories |
| P8 Direct Fitbit and FatSecret; stored delegated credentials | Google Health/FatSecret services above; schema GoogleHealthConnection/ExternalProviderConnection/OAuthAttempt; `apps/api/src/modules/provider-oauth/token-crypto.ts` | Provider responses temporarily processed server-side; normalized records persisted. External diary ownership unchanged. No direct Cronometer API integration claimed |
| P9 Cross-device export limitation | `docs/deployment/android-preview.md` Cronometer physical evidence; `docs/engineering/android-health-connect.md` | Same-device foreground success and cross-device export dependency are existing physical evidence, not newly retested |
| P10 Functional purposes | Data paths P2–P8; `docs/product/v1-prd.md`; `docs/product/bank-calculation-spec.md` | Planning estimates separate from finalized accounting; no unrelated health purpose added |
| P11 Authentication/hosting/push/build services | `render.yaml`; mobile package.json/eas.json; `apps/api/src/modules/morning-bank-update/morning-bank-update.service.ts` ExpoPushTransport; `docs/deployment/android-preview.md` FCM delivery qualification | Blueprint API/cron/PostgreSQL on Render Ohio; not proof of every third-party region/contract. EAS build input is source/config/assets, not normal user health upload |
| P12 Optional notification content and state | MorningBankUpdateService morningBankUpdateCopy/send/registerDevice; `apps/mobile/lib/notifications/morning-bank-update.ts`; schema preference/delivery/registration | Token, platform and delivery identifiers plus bank/contribution payload; lock-screen behavior OS-controlled; Expo then FCM/APNs |
| P13 Live retention and disconnect versus delete | schema cascades; account-safety service; provider disconnect methods | No universal elapsed-time purge identified. OAuth expiry bounds usability, not proof rows are physically purged. Ledger immutability does not override account deletion |
| P14 Controls | `apps/mobile/app/(tabs)/settings.tsx`; `apps/mobile/app/(settings)/delete-account.tsx`; notification helpers; Health Connect bridge openSettings; HealthKit connection helpers | Health OS permission separate from server authority. Sign-out/permission revocation does not delete account history |
| P15 Exact deletion UI | `apps/mobile/app/(settings)/delete-account.tsx` confirmation/remove | Settings → Delete Account → type DELETE → Delete Account. Failure/retry message; sign-out and /sign-in on success |
| P16 Ordered deletion and associated live records | `apps/api/src/modules/account-safety/account-safety.service.ts` performDeletion/resumePendingDeletions; schema User relations with Cascade; GoogleHealthService revokeForAccountDeletion | Persist intent, disable push, Fitbit revocation, Clerk deletion, user cascade. FatSecret credentials cascade locally; no universal remote revocation claim. Original external/OS records untouched |
| P17 Physical deletion evidence and limits | `docs/deployment/android-preview.md` “Token-aware Android account deletion — September 17: PASS”; `apps/api/tests/account-deletion-recovery.test.ts`; `apps/api/tests/pb2-account-safety.test.ts` | Prior physical Clerk404/user0/all user-linked rows0/token0 and reclaim1. That account had no FatSecret connection and zero scheduled deliveries; nonempty delivery cascade/physical FatSecret revocation not claimed. Founder reports prior iOS physical pass; shared code supports both, no new iOS test here |
| P18 Security | `apps/mobile/app.config.ts` assertHostedBuildEnvironment; `apps/api/src/auth/current-user.ts`; both provider token-crypto files; logger.ts | HTTPS API build guard; verified ownership; AES-256-GCM provider credentials; specified key redaction. Database TLS, backups, access controls and processor operations need confirmation; no blanket certification |
| P19 External request/contact | Current official Google account-deletion/User Data guidance below; founder must supply channel | No inbox/form created. No request handling SLA or verification flow invented |
| P20 Policy date/changes | Founder policy decision, not code | Founder-approved material-change notice wording; candidate date September 19,2026, reset at publication if needed |
| P21 Sale/current-ads/audience commitments approved September 19; jurisdiction review remains | Dependencies/source search and schema review; decisions below | Negative code finding is not a business-policy guarantee |

## Data lifecycle inventory

| Data | Device/temporary processing | Backend and persistence | Third-party handling |
| --- | --- | --- | --- |
| Email, identity, authentication | Clerk UI/browser, verification, local session credential | Verified subject/email retained; bearer verified per request, no CalorieBank password DB | Clerk handles authentication credentials and sessions; provider retains its own account |
| Apple Health samples | On-device energy/steps/food-writer/workout query and normalization | Daily aggregates, selected writer and normalized workout metrics retained | OS Health store remains outside CalorieBank account deletion |
| Health Connect nutrition | Records/energy/origins/revisions queried on-device, exact source selected | Daily totals, source, timezone, quality/timing retained; no raw food diary upload | Android HC store and original tracker remain separate |
| HC diagnostic activity | Explicit internal qualification read only; not Play consumer permissions | Not a supported authoritative burn upload | No new consumer use; diagnostics show safe counts/quality |
| Fitbit activity/expenditure | Device begins authorization | Server temporarily processes remote responses; daily totals/workouts/connection credentials retained | Google Health/Fitbit handles authorization and source data |
| FatSecret diary | Device begins authorization | Server temporarily reads diary responses; normalized intake and credentials retained | FatSecret owns original diary/account |
| Bank/goal/product information | User inputs and displayed calculations | Derived bank/Opening Bank/contributions/Recovery; persisted ledger/snapshots, goals/name/target, preferences, onboarding state, forecasts/cache | Render hosting/database; notification subset sent via push if enabled |
| Technical/push | Platform/token acquisition, timezone, local session/operation state | Token/platform/registration, preferences, receipts/attempts, sync state, request/error logs | Expo/FCM/APNs, hosting and auth operational logs; exact independent collection/retention unresolved |

No category is included solely because a dependency could access it. Source review
found no DOB/minimum-age gate or general device-identifier inventory. SDK/console
configuration and independent service telemetry are evidence gaps, not asserted absent.

## Service inventory (not legal processor classifications)

| Service | Purpose and exchange | CalorieBank retention / independent processing | Public policy? |
| --- | --- | --- | --- |
| Clerk | Email/sign-up/sign-in/verification/session; verified subject/email returned | Subject/email stored; Clerk manages auth account/session; deletion invokes Clerk user deletion, audit retention unknown | Yes |
| Render API + lifecycle + PostgreSQL | Hosts account APIs, jobs and live database | Persisted account/health/product data; runtime logs and backup policies separate/unverified | Yes; actual blueprint DB is Render, not inferred separate vendor |
| Expo Push | Push token + title/body/route; tickets/receipts returned | Token/delivery status retained; Expo transit/retention requires contract review | Yes |
| Firebase/FCM; Apple APNs | Platform notification routing/content | Delivery through Expo; independent platform handling, no app Firebase Analytics SDK found | Yes |
| Expo/EAS | App build/signing/distribution artifacts/configuration | Build service independently handles developer inputs; no ordinary health-record upload to EAS established | Briefly, separate from push/user data |
| Fitbit / Google Health | Delegated authorization and burn/activity API | Encrypted credentials plus normalized evidence stored; source account independent | Yes |
| FatSecret | Delegated diary API | Encrypted credentials and normalized daily intake stored; source diary independent | Yes |
| Apple Health/HealthKit | Device health access | Normalized backend evidence; OS data not deleted by CalorieBank | Yes |
| Android Health Connect | Device nutrition access | Exact-origin normalized totals; OS store independent | Yes |
| Cronometer/other selected writers | Write records to native health stores | No direct CalorieBank API contract; only qualified selected-origin data | Explain transport; do not imply direct integrations |
| GitHub / Google Cloud project administration | Source/build administration and FCM credentials | Not evidence of a separate runtime health-data recipient; do not list every development vendor as health processor | No separate consumer claim absent further evidence |

No advertising, analytics/paid-targeting SDK, data brokerage or sale workflow was
found in reviewed mobile dependencies and app/API source searches. This does not
establish contractual/business intent or all upstream SDK behavior. Founder must
approve any no-sale/no-advertising commitment; clean draft does not make one.

## Retention and publication blockers

- Live user-linked tables cascade on successful account deletion, including bank
  records, ledger, Opening Bank, aggregates/workouts, derived caches, selections,
  OAuth attempts/credentials, goals, preferences and push records.
- No universal age-based deletion period found. Some records have expiry/deletedAt
  fields; these do not prove a scheduled physical purge. Do not promise 30 days.
- FOUNDER/LEGAL REVIEW REQUIRED: Render logs/backup/PITR retention, deleted-data expiry,
  restoration controls, Clerk audit/account remnants, Expo/FCM/APNs retention and
  mechanisms for removing provider-processed copies. Original user-owned external
  diaries remain with their services; distinguish them from infrastructure copies.
- Public organization-controlled contact required; no home address/personal phone
  proposed. Jurisdiction may require further organization details; legal review.
- Confirm intended audience/age, operating jurisdictions, health-data consent/legal
  bases, individual rights/request process, international transfers and contracts.
  No COPPA/GDPR/CCPA boilerplate or age minimum invented. Live Clerk age settings and
  future Play audience declaration remain unverified.
- Confirm notice process and publication date. Clean drafts intentionally retain
  mandatory placeholders rather than pretending publication readiness.

## Current official Google cross-check — September 18, 2026

- [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en): an outside-app request path is required alongside account creation. A real monitored email or form may qualify; instructions to reinstall/use the app alone do not. No email-specific mandate.
- [User Data/privacy policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en): identify the app/operator, give a privacy contact/inquiry mechanism, explain data/recipients/security/retention/deletion. No inferred mandate to publish the founder's home phone/address in this policy.
- [Health Content and Services](https://support.google.com/googleplay/android-developer/answer/16679511?hl=en): the full policy requires a non-medical disclaimer in the description of other health/medical apps and a reminder to consult a healthcare professional. Track as a separate store/product/legal requirement; do not insert unrelated Terms into this privacy draft.

Data Safety cross-check: normalized totals are collected/retained, not ephemeral;
Clerk and notification recipients are disclosed; service-provider sharing exceptions
remain legal review, not a “never share” statement. Product fields/timezone are
included. iOS policy covers HealthKit while the Android worksheet covers Nutrition-only
Play plus direct Fitbit. Health Apps categories remain Nutrition and Weight Management
and Activity and Fitness. No HC burn support implied. No declarations submitted.

Proposed URLs, still unpublished: `https://caloriebank.philbk.dev/privacy` and
`https://caloriebank.philbk.dev/delete-account`. Replace draft-relative links at
publication. No DNS/website changes authorized here.

## September 19 founder resolution and consistency check

Current approved statements replace earlier approval gaps: no sale of personal health
information; no **current** third-party advertising or health-information advertising;
current app not designed for children/no supervised accounts; approved policy-change
notice. No permanent no-ad or18+ identity inferred. Public contact spelling approved,
operational status unverified. See [future review boundary](future-child-and-commerce-review.md).
P13/P19/P20/P21 must be read with the newer retention and operations documents.

Service descriptions remain factual, not legal classifications. Nutrition-only Play,
Fitbit direct activity and cross-platform HealthKit descriptions remain consistent.
FCM installation-ID retention is distinct from CalorieBank's server token deletion;
no complete third-party identifier purge promised. Clean drafts have no placeholders,
review copies reproduce them with explicit external publication holds. No new product
code or physical QA in this documentation task.
