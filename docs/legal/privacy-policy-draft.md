# CalorieBank Privacy Policy — DRAFT, NOT APPROVED OR PUBLISHED

Review date: September 18, 2026. Proposed effective date: **[FOUNDER: supply]**.
Operator: **[FOUNDER/LEGAL: legal organization name, address and jurisdiction]**.
Contact: **[FOUNDER: monitored privacy contact and external request channel]**.
Every bracketed review item must be resolved before publication. This is a factual
product draft, not an assertion of legal compliance or a substitute for legal review.

## Information used by CalorieBank

CalorieBank uses your account email and authentication identifiers to provide a
signed-in account and keep your information separate from other accounts. Sign-in
is provided through Clerk. **[LEGAL: confirm Clerk's current role, policy link,
contract, international processing locations and any additional sign-in data.]**

When you connect supported services, CalorieBank processes calorie intake, calorie
expenditure, steps and supported exercise/activity evidence. It retains normalized
daily totals, activity evidence, selected-source identifiers, update timestamps,
calculation history, your goals and preferences. Banking history explains completed
days; current-day estimates are separate from that history. **[LEGAL: approve the
health/fitness classification, lawful basis and any jurisdiction-specific wording.]**

On Android, the proposed Google Play build reads **Nutrition only** from Health
Connect for the food tracker you explicitly select. It reads exact writer identity
and recent dated calorie records, and uploads normalized daily calorie totals and
source identity to your CalorieBank account. It does not merge different food
trackers. Fitbit supplies burn/steps/activity directly; Health Connect burn is not a
supported burn source. CalorieBank does not write to Health Connect. Raw food names
and detailed nutrient records are not part of the Health Connect upload contract.

Fitbit/Google Health and direct FatSecret connections use delegated provider
credentials to retrieve supported data. FatSecret food diary responses are processed
to daily calorie totals, rather than creating a CalorieBank food diary. On iOS,
Apple Health imports run on-device; selected food-writer authority and normalized
uploads follow the same one-source model. **[LEGAL: verify all supported platform
and provider disclosures and current third-party terms before adopting this as a
cross-platform policy.]**

If you enable Morning Bank Update, CalorieBank stores a device push token, platform,
registration state, notification preference and delivery state. Notifications are
sent through Expo and Android FCM (Apple push infrastructure on iOS). The notification
payload can include bank/contribution information visible on your lock screen.
**[LEGAL: review push-service processing and the disclosure of notification content.]**

Operational records include request identifiers, route/status/timing information,
sync results and error categories. The application uses log redaction for sensitive
keys; that is not a guarantee that hosting or authentication services collect no
additional technical information. **[FOUNDER/LEGAL: confirm infrastructure IP/device
logs, SDK telemetry, destinations and retention.]**

## Purposes and providers

Information is used to authenticate accounts, connect selected services, import
calorie/activity evidence, calculate and explain the calorie bank, display planning
estimates/history, save preferences, deliver optional notifications and operate or
troubleshoot the service. Daily Bank Target remains planning-only.

The current deployment uses Clerk for authentication, Render-hosted API/database
infrastructure, Expo for builds/push delivery and Firebase Cloud Messaging for
Android push. Connected Fitbit/Google Health and FatSecret services process their
own authorization/data requests. **[FOUNDER/LEGAL: verify the complete processor
inventory, hosting region, contractual roles, subprocessors, international transfers
and provider privacy links. Do not turn this list into a blanket “not shared” claim.]**

No advertising integration or data-sale workflow was found in the reviewed product
code. **[FOUNDER/LEGAL: confirm business practices, contracts and all SDK behavior
before making any “do not sell,” “no advertising” or Google Data safety sharing
attestation.]**

## Storage and security

Account data is stored in the hosted database. The application uses authenticated
account-scoped API requests; hosted mobile builds require HTTPS API URLs. Stored
provider tokens use application-level encryption, and Clerk's mobile token cache is
used for session persistence. Logs have sensitive-key redaction. These measures do
not establish absolute security or a certification. **[FOUNDER/LEGAL: confirm
operational key/access management, backup encryption, service-to-service/database
transport, hosting security practices and incident procedures.]**

## Controls and deletion

You can select/manage connected sources in Settings → Health Connections, change
Morning Bank Update in Settings, and sign out. Disconnecting a provider is different
from deleting your account and does not by itself promise removal of historical data.
You can change Health Connect access in Android settings; this does not automatically
delete previously imported CalorieBank account data or the original tracker diary.

To delete your account, open Settings → Delete Account, read the confirmation,
type DELETE, and tap Delete Account. The implemented flow disables notification
registration, performs required Fitbit revocation, deletes the Clerk identity and
removes the internal user with associated database records by cascade, including
stored direct-provider credentials. Retryable failures can require another attempt;
pending requests are resumed by the server worker. This does not delete your Google,
Fitbit, FatSecret or Cronometer account or erase Android's Health Connect store.
FatSecret credential removal is verified locally; universal remote-provider revocation
is not promised. **[LEGAL: approve the consumer description and actual retention
exceptions; do not promise instantaneous completion across backups/third parties.]**

If you cannot use the app, request deletion through **[FOUNDER: approved external
request channel at proposed /delete-account page]**. **[FOUNDER/LEGAL: define secure
ownership verification without requesting passwords or raw health records, staffing,
response handling, appeals and response-time commitments. No fallback is live yet.]**

## Retention, rights and review items

Account-linked operational data remains available for the service until removed
through implemented deletion. The code has no single universal elapsed-time purge
policy. Immutable accounting means ordinary product history is not rewritten; account
deletion separately removes account records. **[FOUNDER/LEGAL: specify actual retention
periods for live records, deleted-data backups, logs, legal/security exceptions and
processor copies. These are not verified by the repository.]**

**[LEGAL: determine applicable privacy rights, requests/complaints route, jurisdiction,
children/minimum-age policy, consent/legal bases and international-transfer language.
Do not publish unresolved placeholders or invent eligibility/age rules.]**

**[FOUNDER/LEGAL: approve policy-change notice process and effective date.]**
This draft makes no HIPAA, medical-device, medical-advice or absolute-security claim.

## Internal evidence (remove from public page)

- `apps/api/prisma/schema.prisma`: retained account/aggregate/workout/source/push/history models and cascades.
- `apps/mobile/lib/native-health/intake.android.ts`: exact-origin eight-date normalized upload.
- `apps/mobile/lib/health-connect/bridge.android.ts`: release permission boundary.
- `apps/api/src/modules/account-safety/account-safety.service.ts`: ordered resumable deletion.
- `apps/api/src/modules/google-health/token-crypto.ts`, `modules/fatsecret/fatsecret.service.ts`: protected provider credentials.
- `apps/api/src/logger.ts`, `apps/mobile/app.config.ts`, `apps/mobile/app/_layout.tsx`: log filtering, hosted HTTPS guard, Clerk token cache.
- Public hosting and legal/operator facts remain unverified; this draft is intentionally unpublished.
