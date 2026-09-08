# Health Connections release audit - September 8, 2026

## Confirmed defects

- The Settings FatSecret connect catch covered authorization, diary sync and role selection. A diary failure after successful authorization was therefore mislabeled as a connection failure. Onboarding made the opposite mistake: every diary error was described as food not ready.
- The FatSecret adapter returns empty dates normally. The service records an unavailable intake query without disconnecting. Revoked-token code 9 requires reconnect; other retrieval failures preserve the connection. Empty food alone does not reproduce the connection-error banner in the inspected code. The founder's exact failed request was not correlated with live logs, so its transport/provider cause remains unproven.
- Apple Health refresh and details used burn diagnostics regardless of the originating role.
- The generic device-managed Apple Health option counted as an existing source and suppressed the food tracker discovery action. The same option exists even without a configured tracker.
- Goal adjustment mode buttons lacked vertical centering, horizontal text alignment and explicit equal-width sizing.

## Correction boundaries

Connection feedback distinguishes not connected, healthy/data available, healthy/empty, temporary refresh failure and reconnect required. It reads authenticated server connection state after the diary request. Missing or failed follow-up reads do not invent connection truth.

Calories Eaten management always offers Apple Health food tracker configuration. It reuses `discoverAppleHealthIntakeWriters` and the existing exact-bundle `saveProviderSelection` contract used by onboarding. No static new tracker support or all-writer fallback is introduced. Apple Health refresh feedback consults intake query/upload diagnostics, not burn errors.

The existing onboarding contract remains: a healthy connection can advance source selection without history. Final preparation still requires the existing bounded full-window import attempt; successful empty queries are checked, failed queries require retry. No fabricated history or changed Opening Bank initialization is permitted.

The final provider-contract audit also confirmed a FatSecret v1 parser defect: the documented single-day object response was rejected by an array-only schema. The parser now normalizes the documented object/array forms to the same existing daily calculation path. [FatSecret v1 response contract](https://platform.fatsecret.com/docs/v1/food_entries.get_month). This is a reproducible retrieval failure independent of authentication, but is not proof of the founder's original response payload. API and hosted lifecycle deployment are required for this parser correction. No schema, historical authority, accounting, notification or lifecycle orchestration changes are included.

## Verification

Before the final parser correction, the full local API/persistence suite passed 45 files / 405 tests against the dedicated localhost test database. Added 17 feedback and wiring regressions plus two parser fixtures for a single-day object and empty month; existing FatSecret service tests cover auth exchange, revoked tokens and transient errors. Final validation is reported with the release task.

Goal form was rendered with React Native Web at 320px and 390px, including an enlarged-text approximation. Cut and Bulk selectors have equal widths, centered labels and wrapping without clipping. This is not physical iOS Dynamic Type verification.

The actual Health Connections component was also rendered with a synthetic FatSecret-selected account. Calories Eaten -> Add another source -> Apple Health food tracker reached detected tracker choices. At a 320px browser viewport, the chooser and intake-specific Apple Health details remained legible; intake details showed no burn warning. Native permissions and ingestion were mocked, not physically verified.

Physical release checks remain: empty FatSecret diary, temporary retrieval error/reconnect, FatSecret-to-detected-Apple-Health-tracker selection, role-specific Apple Health feedback, and Cut/Bulk layout with iOS Dynamic Type. Distribution remains on hold until these pass on the new preview.
