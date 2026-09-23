# CalorieBank Privacy Policy

Last updated: September 23, 2026

## 1. Who operates CalorieBank

CalorieBank is operated by Near Future I-X. This policy describes information used
by the CalorieBank app on iOS and Android and its supporting services.

## 2. Information CalorieBank uses

**Account information.** Your email address and account identifiers connect you to
your CalorieBank account. Clerk handles sign-up, sign-in, verification and sessions.
CalorieBank receives your verified identity; it does not maintain its own password
database. A session credential is kept on your device to keep you signed in.

**Connected health and fitness information.** Depending on the sources you connect,
CalorieBank uses calories eaten, calories burned, steps and supported exercise
information, such as activity type, time, duration, distance and available calorie
or step measurements. It stores imported daily totals, supported activity summaries,
source identifiers, dates and update information in your account.

**Your calorie estimates.** If you choose CalorieBank estimate, CalorieBank stores
your usual daily calorie estimate, changes you make for a specific day, and the
dates and source information needed to calculate your bank and preserve your
history. These estimates stay in your CalorieBank account; CalorieBank does not
write them to Apple Health or Health Connect.

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

CalorieBank uses this information to authenticate you, connect your selected sources,
show intake and expenditure, calculate and explain your calorie bank and history,
provide activity and planning estimates, save your choices, send optional updates,
and troubleshoot problems. Daily Bank Target is a planning setting; it does not
change the bank calculation.

## 4. Connected health and fitness services

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

CalorieBank uses Clerk for authentication, Render for its API and PostgreSQL database,
and Expo Push for notification delivery. Delivery uses Firebase Cloud Messaging on
Android and Apple's push infrastructure on iOS. These services process the information
needed for those functions. Connected health services process authorization and data
requests associated with the connections you choose.

Expo/EAS also builds and distributes app binaries. Building the app is separate from
sending your imported health records to the CalorieBank backend.

## 6. Advertising and sale of health information

CalorieBank does not sell personal health information. CalorieBank does not
currently show third-party advertising or use health information for
advertising.

## 7. Notifications

Morning Bank Update is optional. Its notification can contain your Available Bank
and a completed day's contribution. Expo and the platform push service receive the
notification content and delivery identifiers. Depending on your device settings,
this information may appear on your lock screen. You can turn updates off in
CalorieBank and control notification permission in your device settings.

## 8. Data retention

CalorieBank keeps account-linked records to provide your account, history and
features. Successful account deletion removes the associated records from its live
database and deletes the CalorieBank sign-in identity in Clerk. Disconnecting a
source or signing out does not delete previously imported account history.

Copies can remain in database backups and operational or security logs after live
account deletion. Backup copies support recovery, and logs support operation and
troubleshooting. Hosting, authentication and notification services have separate
retention practices; deleting the live account does not instantly erase every
backup, log or notification already accepted for delivery. Original health records
held by your connected services remain subject to those services’ controls.

## 9. Your choices and controls

In Settings → Health Connections, you can manage your selected sources and direct
connections. You can manage Apple Health access through Apple's health/privacy
settings and Health Connect access through Android's Health Connect permissions.
Revoking access does not itself erase information already imported into CalorieBank.
You can change Morning Bank Update, sign out, or delete your account in Settings.

## 10. Account deletion

Open Settings → Delete Account, type DELETE and confirm with Delete Account.
Successful deletion removes your CalorieBank account, imported records, bank history,
goals, preferences, stored provider credentials and notification registration and
delivery records. If the process cannot finish, the app provides a retry message;
the service can resume a pending deletion.

This does not delete your accounts or original records in Fitbit, FatSecret,
Cronometer or other external services. Apple Health and Health Connect records and
permissions remain controlled through those platforms.

If you cannot access the app, use the contact on the
[account-deletion page](https://caloriebank.philbk.dev/delete-account) to request deletion.

## 11. Security

Hosted CalorieBank app connections to its API use HTTPS. API requests use verified
account identity, and stored direct-provider credentials are encrypted. The service
applies account ownership checks and filters specified sensitive fields from its
structured logs. These measures do not guarantee absolute security.

## 12. Current audience

The current version of CalorieBank is not designed for children. It does not
currently offer child or supervised accounts.

## 13. Changes to this policy

We may update this Privacy Policy as CalorieBank changes. When we do, we'll
update the date at the top of this page. If a change materially affects how we
use your information, we'll provide additional notice when appropriate.

## 14. Contact

Near Future I-X

CalorieBank Support

support@caloriebank.philbk.dev
