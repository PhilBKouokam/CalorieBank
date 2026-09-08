# Friends and Family Release Candidate - September 7, 2026

## Scope and baseline

PB.1, PB.2, Morning Bank Update delivery, Settings navigation, and notification-settings recovery were physically accepted by the founder before this audit. This pass is release polish, not a new milestone. Accounting, provider authority, lifecycle, identity/deletion ordering, push ownership, and notification delivery are unchanged.

## Findings and disposition

| Priority | Finding | Disposition |
| --- | --- | --- |
| P1 | Installed app/launch assets still used Expo placeholders. | Prepared the supplied CB artwork as an opaque 1024-square iOS icon, removed the illustrated tile/shadow, and reused it on launch. |
| P1 | Today bank/goal cards and SummaryCard repeated the Link-slot style-callback failure previously fixed in Settings. | Pressable now owns navigation and its styles directly; destinations and data are unchanged. |
| P1 | Goal form displayed raw exception messages. | Replaced them with consumer-safe load/save recovery copy. |
| P1 | Delete Account confirmation was not scrollable above the keyboard. | Added keyboard-adjusted scrolling, labeled confirmation input, and concise retry copy. Deletion semantics are unchanged. |
| P1 | Legacy `/ledger` deep link exposed a development placeholder. | Redirected it to the existing History surface. |
| P1 | Full workspace typecheck exposed three auth-test fixtures without NODE_ENV after the notification helper introduced Expo's global environment typing. | Fixtures explicitly declare test mode. Security assertions and production code are unchanged. |
| P2 | Health prompt, Today fallback, and Goal setup used implementation-oriented wording. | Small copy-only corrections. Goal settings no longer implies the goal changes measured burn. |
| P2 | Sign-in actions lacked explicit button roles; fixed-height composition could constrain larger text. | Added roles/state/labels and scrollable content without changing Clerk behavior. |

No P0 correctness/safety regression was identified in the inspected paths. No P3 enhancement was implemented. Public provider-ownership enforcement, notifications beyond the existing morning update, broader redesign, and production-scale infrastructure remain outside this release.

## Journey review

- Launch/auth: inspected app identity, hosted-build guards, application gate, Clerk hosted sign-in/sign-up handoff, cancellation/error copy, and navigation. Email verification, password errors, and their keyboard behavior belong to Clerk's hosted flow and remain physical QA.
- Onboarding: inspected all four decisions, saved connected/no-data continuation, exact-writer selection, automatic import attempt, initial bank state, retries/back navigation, and optional notification request. No selection or bootstrap logic changed.
- Connections: inspected role selection, reconnect/disconnect guards, foreground Apple Health refresh, source-specific errors, and missing-data states. Internal diagnostics remain a secondary beta troubleshooting action, not primary consumer content.
- Today: inspected known-bank precedence over recovery, signed-to-Enjoyed presentation, zero/recovery, current-data separation, customization, and card navigation. Numeric inputs and formulas are untouched.
- History: inspected normal/opening rows, missing dates, read-model messages, detail/source selection, empty/error states, and navigation. Opening positive-suffix selection and History mathematics are untouched.
- Settings/notifications: preserved the previously accepted row layout, notification copy and On/Off behavior, direct notification-settings recovery, 07:00-11:59 local eligibility, and durable send state.
- Account safety: inspected sign-out token detachment, account-scope resets, token reassignment transaction, deletion/provider/Clerk sequence, and cascading notification data removal. No behavior changes.

## Verification boundary

Use Node 20.20.2. Full API/persistence tests run against the newly isolated localhost database `caloriebank_rc_20260907`, never beta or the local application database. All 28 existing migrations applied successfully there; no new migration is part of this release. Temporary QA scripts and database credentials are not tracked.

Visual review used actual React Native components through React Native Web with mocked service/auth boundaries: 320px and 390px layouts, notification-denied recovery, deletion confirmation, sign-in, summary-card long values, and Settings with simulated 150% text size. Goal-form accessibility structure was also inspected. This is not native Dynamic Type, keyboard, VoiceOver, or full live-provider device testing. Other journey screens received code/state review and existing regression coverage rather than a claim of exhaustive device rendering.

Final automated gates: workspace TypeScript (API/mobile/domain/schemas), API/mobile lint, full API suite including persistence and mobile regression tests, Prisma generation/validation, API production build, Expo configuration/dependency validation, and staged diff check. The build must archive successfully from the committed release candidate before it is handed to testers.

## Physical install smoke check

1. Install the final preview on the registered iPhone. Confirm CB home-screen icon and branded launch screen.
2. Sign in or create a test account; verify hosted verification/cancel/back flow and permission sheets.
3. Complete onboarding with available or genuinely missing data; confirm understandable continuation and automatic hydration.
4. Confirm known Bank/Enjoyed values remain visible during a refresh warning, and tap Bank, contribution, Goal, and History navigation.
5. Check narrow/larger-text rendering and VoiceOver; open Delete Account on a disposable test account and confirm the keyboard does not hide its action.
6. Confirm Morning Bank Update settings, direct iOS Notifications destination, preference state, and existing push/account-switch behavior on the final binary.

No manual Render deployment is required: backend code, schema, and service configuration are unchanged. Existing repository auto-deploy behavior is not modified by this audit.
