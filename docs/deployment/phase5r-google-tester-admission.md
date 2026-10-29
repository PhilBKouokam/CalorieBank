# Google Health tester admission — isolated deployment candidate

## Boundary

This correction starts from production API source `c3ca95a`. It is an API admission change, not Google verification, OAuth publication, a new mobile artifact, or a retrospective disconnection policy. The qualified banking-core candidate `b28074b` remains untouched. No schema, migration, accounting, ingestion, token encryption, provider-authority, HealthKit, or Health Connect permission change is included.

Hosted authorization is closed unless `GOOGLE_HEALTH_TESTER_COHORT_JSON` admits the exact current application account and Clerk subject. After Google's identity response, the returned Google Health identity must also match that member's pinned identities. Emails are not admission keys. A new signup, including a same-email replacement after deletion, needs a new explicit admission decision. The Google tester list is not the FatSecret cohort.

The server-only JSON format is `{"version":1,"members":[{"accountId":"<UUID>","clerkSubject":"<verified subject>","healthUserIds":["<confirmed Google Health identity>"]}]}`. These placeholders are documentation, not usable configuration. Store the real configuration in the API's protected environment only; never in Git, client inputs, screenshots, logs, or this document. Shared Google identities may be pinned to multiple independently approved application accounts. Unknown bindings remain denied. Malformed configuration prevents startup with a generic error; missing hosted configuration denies enrollment without taking unrelated functionality offline. Explicit local configuration enforces the same policy; only an unconfigured `APP_ENV=local` retains the existing local development behavior.

## Enforcement coverage

- Initial connection and reconnect share `createAuthorizationUrl`: admission before any attempt is created, then admission again inside the existing account/deletion lock and attempt transaction.
- Callback uses the stored, expiring initiator; admission precedes token exchange, follows identity lookup, and repeats under the account lock before single-use state consumption and connection persistence.
- Wrong, removed, deleting, replaced, or unapproved accounts cannot persist a connection. An unapproved Google identity cannot replace tokens or trigger health ingestion. Identity lookup is necessary to identify the selected Google account; its result is not an authorization grant for CalorieBank ingestion.
- Concurrent callbacks retain the existing compare-and-set single-use state protection. Account switching does not rebind an outstanding attempt to the browser's new account. Middleware remains responsible for verified request ownership and fresh Clerk provisioning checks.
- Existing token refresh, normal authorized ingestion, disconnect, and deletion cleanup remain available. Admission membership never selects a provider or changes a historical accounting record. No grant is revoked automatically, including after a wrong-identity callback.
- Denial is HTTP 403 with static code `GOOGLE_HEALTH_NOT_AVAILABLE`. Callback denial contains only `caloriebank://integrations?fitbit=unavailable`. Prepared client copy says “Google Health connection isn't available yet.” Existing clients remain denied server-side even if they render their older generic error.

## Cohort reconciliation hold

The current Google Audience list contains seven test identities. Read-only application/connection metadata and current Clerk existence/ban/lock checks were collected privately without tokens, calorie observations, or bank values. The records include shared Google identities. Email similarity and an existing connection alone do not establish which tester owns a Google identity.

A private owner worksheet lists all seven testers, candidate application accounts, active status, and pseudonymous Google identity groups. It needs owner-confirmed bindings before a production configuration can be assembled. No inferred production allowlist has been activated. Preserve the resulting private inventory with owner-only permissions; recheck account liveness immediately before deployment. A tester without a verified application/Google binding remains denied, not silently replaced or enrolled under another account.

## Qualification

Dedicated-localhost PostgreSQL tests cover approved initial/reconnection, concurrent denied starts, removal after state creation, wrong Google identity, policy change during callback, stale subject, concurrent/replayed callbacks, deletion, same-email fresh signup, switched request ownership, and legacy HTTP behavior. A separate real-database regression verifies an existing connection can refresh expired tokens and ingest while enrollment is denied. Synthetic rows alone are created and removed; real grants are never exercised by these tests.

Client helper regressions cover denial copy and successful/denied/invalid callback parsing. The synthetic web component preview uses the actual shared text component, copy, theme and message styling. Visual inspection at 320px with 2× text and 390px with normal text found readable wrapping and no clipped message. This is component evidence, not physical native-screen proof. No input or keyboard primitive changed. A later consolidated mobile candidate needs targeted denial/reconnect smoke checks; do not build the older production-base mobile tree in this branch.

The exact source/configuration passed the complete Node 20.20.2 release gate: 1,190 tests across 114 files, local migration validation, workspace lint/types and API compilation. The targeted suite passed 69 tests across four files, including 11 PostgreSQL admission tests. The production-base suite count is independent of the preserved 1,246-test shipping-candidate baseline. No production database or provider was exercised by these tests. Private identifiers were checked against all changed files with zero matches.

## Bounded production proposal — approval required

1. Complete the private ownership bindings, produce and locally validate the protected JSON, and verify each intended tester/account pair. No identifiers belong in the approval report.
2. Keep OAuth in Testing. Capture read-only account/source/connection/accounting baselines. Verify live API still matches the reviewed base; rebase and rerun affected qualification if it changed.
3. Deploy only the approved API commit with `APP_ENV=beta`, the verified cohort JSON and Node 20.20.2. The API Blueprint entry records the runtime/key; do not sync the whole Blueprint or touch worker configuration. The worker does not initiate authorization and stays on its separately qualified source/runtime. No migration is required.
4. Confirm all old API instances have drained before considering OAuth publication. Validate readiness and generic malformed/missing-policy failures in a non-production replica first.
5. With authorized disposable identities, verify admitted start, denied start with no state, denied stale callback, and a correctly pinned callback. Read-only compare existing connection/source/accounting baselines. Verify natural existing-provider refresh separately without reconnecting users or generating health notifications.
6. Integrate only the prepared client error/callback handling into a new descendant of the qualified banking-core candidate if a consolidated artifact is approved. The server boundary does not depend on that client update.
7. Obtain separate approval for OAuth Audience publication and branding/verification submissions only after live admission and process-drain evidence passes. Publication alone does not confer Google Health public eligibility.

## Recovery and limitations

Do not roll back to an unguarded API while OAuth is public. Keep authorization closed and forward-fix, or restore the last qualified guarded commit/configuration. An empty member list closes enrollment while preserving existing refresh/ingestion; applying it is an operational decision, not an automatic remediation. Never revoke shared grants as rollback. Configuration changes require a coordinated API restart/process drain so no old cohort remains active.

The policy intentionally limits new authorization and reconnect, not continued ingestion under existing grants. Google consent grants happen at Google before the API can inspect the returned identity; a wrong-identity callback is rejected locally without persisting/using that grant or revoking shared access. Cohort changes and new Health identity pins require verification and an explicit owner decision. No claim of Google restricted-scope verification or Limited Use compliance is made here.
