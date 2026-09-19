# INTERNAL REVIEW COPY — NOT FOR PUBLICATION

# CalorieBank Privacy Policy

Last updated: [PUBLICATION DATE]

## 1. Who operates CalorieBank

> [FOUNDER CONFIRMATION REQUIRED] Near Future I-X is supplied by the founder. Confirm exact legal styling/jurisdiction and authority to publish. D-U-N-S issuance is pending per founder; not independently verified.

CalorieBank is operated by Near Future I-X. This policy describes information used
by the CalorieBank app on iOS and Android and its supporting services.

## 2. Information CalorieBank uses

> [EVIDENCE] See matrix P2–P5. Clerk session processing is not a persisted CalorieBank session-ID table. SDK/service-side metadata must still be checked; do not expand categories from mere technical capability.

**Account information.** Your email address and account identifiers connect you to
your CalorieBank account. Clerk handles sign-up, sign-in, verification and sessions.
CalorieBank receives your verified identity; it does not maintain its own password
database. A session credential is kept on your device to keep you signed in.

**Connected health and fitness information.** Depending on the sources you connect,
CalorieBank uses calories eaten, calories burned, steps and supported exercise
information, such as activity type, time, duration, distance and available calorie
or step measurements. It stores imported daily totals, supported activity summaries,
source identifiers, dates and update information in your account.

**Your settings and calculated information.** CalorieBank stores your Fitness Goal,
Daily Bank Target, Banking Goal, source choices and display preferences. It also
stores the calculation records behind your Opening Bank, daily contributions and
bank history. Available Bank and Recovery are calculated from your bank records.
Your timezone is used to group days and schedule notifications.

**Technical information.** CalorieBank uses synchronization status, request and error
information to operate and troubleshoot the service. If you enable notifications,
it stores a push token, device platform, registration timestamps, your notification
preference and delivery status. A push token identifies an app installation for
notification delivery; it is not your phone number.

## 3. How CalorieBank uses information

> [FOUNDER CONFIRMATION REQUIRED] No advertising SDK, data-sale/brokerage or paid-targeting workflow was found in reviewed app dependencies and source. This is not proof of business practices. Approve any future “we do not sell” commitment separately; none is asserted in the clean draft.

CalorieBank uses this information to authenticate you, connect your selected sources,
show intake and expenditure, calculate and explain your calorie bank and history,
provide activity and planning estimates, save your choices, send optional updates,
and troubleshoot problems. Daily Bank Target is a planning setting; it does not
change the bank calculation.

## 4. Connected health and fitness services

> [EVIDENCE] iOS and Android scope differs. Current internal preview permits diagnostics; proposed Play build requests only READ_NUTRITION. Retain this distinction while qualification builds are distributed. Health Connect burn remains disabled.

**iOS — Apple Health.** With access you grant, CalorieBank reads supported energy,
intake, steps and workout information on your device. It sends daily totals,
source information and supported activity summaries to your CalorieBank account.
For food intake, it uses the specific food tracker you select within Apple Health.

**Android — Health Connect.** The consumer Play configuration reads Nutrition for
the food tracker you select. It processes records on the device and sends daily
calorie totals, source identity and timing information to CalorieBank. It does not
combine different food writers into your selected intake total. Food names and
detailed nutrient lists are not part of this upload. CalorieBank does not write to
Health Connect. Health Connect is not available as a Calories Burned source.

Internal qualification builds can offer a separate diagnostic tool with additional
read access to steps, exercise, distance, active and total calories and basal
metabolic rate. These are diagnostic reads, not an enabled Health Connect burn
source. They are not requested by the Nutrition-only Play configuration.

**Direct connections.** Fitbit supplies supported expenditure, steps and activity
information through its Google Health integration. FatSecret supplies diary
information that CalorieBank processes into daily calorie totals. CalorieBank stores
credentials authorizing these connections so it can refresh your data. Cronometer
and other selected native-health food trackers are read through Apple Health or
Health Connect, not through a direct CalorieBank connection to those trackers.

A tracker must first make its records available in the connected service. For example,
food logged on another device may not reach Android Health Connect until the Android
tracker synchronizes it. Those services also handle data under their own policies.

## 5. Services used to operate CalorieBank

> [LEGAL REVIEW RECOMMENDED] Neutral service descriptions do not establish processor/controller roles. Verify contracts, subprocessors, operational regions, SDK telemetry and international transfers. Render blueprint specifies Ohio, but it does not prove all service locations. EAS is a build service, not an inferred user-health recipient.

CalorieBank uses Clerk for authentication, Render for its API and PostgreSQL database,
and Expo Push for notification delivery. Delivery uses Firebase Cloud Messaging on
Android and Apple's push infrastructure on iOS. These services process the information
needed for those functions. Connected health services process authorization and data
requests associated with the connections you choose.

Expo/EAS also builds and distributes app binaries. Building the app is separate from
sending your imported health records to the CalorieBank backend.

## 6. Notifications

> [FOUNDER CONFIRMATION REQUIRED] Approve disclosure of bank values in push payloads and lock-screen presentation. Device settings control visibility; no confidentiality promise.

Morning Bank Update is optional. Its notification can contain your Available Bank
and a completed day's contribution. Expo and the platform push service receive the
notification content and delivery identifiers. Depending on your device settings,
this information may appear on your lock screen. You can turn updates off in
CalorieBank and control notification permission in your device settings.

## 7. Data retention

> [EVIDENCE GAP] No universal timed purge found. Obtain Render database backup/PITR retention, deletion expiry and restore handling; API/cron log retention; Clerk account/audit retention; Expo/FCM/APNs payload/receipt retention. Confirm any legal/security hold and how provider-held copies are handled. Do not invent a period.

CalorieBank keeps account-linked records to provide your account, history and
features. Successful account deletion removes the associated records from its live
database and deletes the CalorieBank sign-in identity in Clerk. Disconnecting a
source or signing out does not delete previously imported account history.

[RETENTION DETAILS REQUIRED BEFORE PUBLICATION: specify verified log, backup and
service-provider retention, any retained data and reasons, and deletion handling.]

## 8. Your choices and controls

> [EVIDENCE] Disconnect, sign-out, permission revocation and account deletion are different. Historical imported data is not promised deleted on disconnect.

In Settings → Health Connections, you can manage your selected sources and direct
connections. You can manage Apple Health access through Apple's health/privacy
settings and Health Connect access through Android's Health Connect permissions.
Revoking access does not itself erase information already imported into CalorieBank.
You can change Morning Bank Update, sign out, or delete your account in Settings.

## 9. Account deletion

> [EVIDENCE] Persist intent → disable registration → required Fitbit revocation → Clerk deletion → database cascade. FatSecret stored credentials are removed; universal remote FatSecret revocation is not proven. [PUBLIC CONTACT REQUIRED] External request handling is not implemented by this draft. Replace relative draft link with approved public URL only at publication.

Open Settings → Delete Account, type DELETE and confirm with Delete Account.
Successful deletion removes your CalorieBank account, imported records, bank history,
goals, preferences, stored provider credentials and notification registration and
delivery records. If the process cannot finish, the app provides a retry message;
the service can resume a pending deletion.

This does not delete your accounts or original records in Fitbit, FatSecret,
Cronometer or other external services. Apple Health and Health Connect records and
permissions remain controlled through those platforms.

If you cannot access the app, use the contact on the
[account-deletion page](account-deletion-draft.md) to request deletion.

## 10. Security

> [EVIDENCE GAP] These are implementation measures, not certification. Validate operational key/access management, backup encryption and database/service-to-service TLS separately. Redaction is key-based and cannot guarantee all logs contain no personal data.

Hosted CalorieBank app connections to its API use HTTPS. API requests use verified
account identity, and stored direct-provider credentials are encrypted. The service
applies account ownership checks and filters specified sensitive fields from its
structured logs. These measures do not guarantee absolute security.

## 11. Changes to this policy

> [FOUNDER CONFIRMATION REQUIRED] Approve effective/publication date, policy maintenance responsibility and how material changes will be communicated. No notification promise is invented.

The date above identifies this version of the policy.
[POLICY-CHANGE NOTICE PROCESS REQUIRED BEFORE PUBLICATION.]

## 12. Contact

> [PUBLIC CONTACT REQUIRED] Supply a monitored organization-controlled privacy/support email or approve a real request form alternative. Founder requested an email placeholder. No personal address or phone is included. [LEGAL REVIEW RECOMMENDED] Determine any jurisdiction-specific registered-address/representative requirement before publication.

Near Future I-X

[FOUNDER: PUBLIC SUPPORT/PRIVACY EMAIL REQUIRED]

## Decisions outside the draft

- [FOUNDER CONFIRMATION REQUIRED] No DOB field, minimum-age gate or child-directed feature was found in the reviewed app/schema. Live Clerk audience settings and store audience declarations were not verified. Choose intended audience and age policy before submission; do not invent COPPA language or an age limit.
- [LEGAL REVIEW RECOMMENDED] Determine applicable jurisdictions, privacy rights, lawful bases, health-data consent, international transfers and complaint/request procedures. No generic GDPR/CCPA rights or compliance claims added.
- [LEGAL REVIEW RECOMMENDED] Medical/non-medical disclaimers concern product/store compliance, not this privacy explanation. Current Google Health Content and Services full policy requires a non-medical disclaimer in the app description and a healthcare-professional reminder. Review their placement/wording separately; no broad Terms language added.
