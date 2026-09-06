# ADR 024: Morning Bank Update

Status: Accepted

## Decision

CalorieBank sends at most one Morning Bank Update for yesterday's completed local accounting date. The notification title is `Available Bank: X kcal`; the body is `You banked X kcal yesterday.`, `You enjoyed X kcal yesterday.`, or `You were right on target yesterday.` Available Bank is always first. Notification copy is derived from the same server bank summary and completed-day contribution used by the app; current-day estimates and incomplete dates are ineligible.

The server evaluates delivery on the existing hourly hosted lifecycle from 07:00 through 11:59 in the user's persisted IANA timezone. Accounting ready before or during that window sends on the first eligible hourly run. Accounting first becoming ready at noon or later does not produce a stale notification; the next completed date remains independently eligible the following morning. `Intl.DateTimeFormat` timezone conversion owns DST behavior rather than fixed UTC offsets.

## Delivery And Retry

Delivery state is durable and unique by CalorieBank user plus completed local date. A successful Expo push ticket is the no-resend boundary. Expo may provide at-least-once transport downstream, but CalorieBank never intentionally submits a second push after ticket acceptance. A transient send failure with a known rejection retries on a later hourly run, at most three attempts and only inside the same morning window. An attempt interrupted with an unknown outcome is not automatically resubmitted, preventing a server restart from creating a duplicate. A permanent invalid-token response disables that device registration. Receipt checks begin after 15 minutes and can invalidate unusable tokens without resending an already accepted notification.

Notification failure never changes accounting. Opening Bank, Available Bank, Recovery, History, ledger, provider authority, and correction behavior remain independent.

## Permission And Privacy

The app explains the Morning Bank Update on the final onboarding screen before requesting system permission. Declining is non-blocking and is not re-prompted automatically. Settings separates CalorieBank's preference from iOS permission and links to iOS Settings when permission is denied.

Expo push tokens are authenticated, account-scoped operational data. A token is unique across CalorieBank accounts and registration transfers it to the current authenticated account. Sign-out removes the current account's device association before ending the session; a failed removal leaves the user signed in with a recoverable error. Account deletion cascades preference, token, and delivery data. Notification taps open Today.

## Responsibilities

- Mobile owns contextual permission, Expo token acquisition, account-change registration, Settings state, sign-out detachment, and tap navigation.
- The API owns authenticated preference and token endpoints.
- The hosted lifecycle owns eligibility, authoritative copy, durable idempotency, retries, Expo delivery, and receipt handling.
- Expo/APNs credentials are deployment configuration and never enter tracked source or `EXPO_PUBLIC_*` values.
