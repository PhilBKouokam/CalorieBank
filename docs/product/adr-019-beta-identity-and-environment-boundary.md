# ADR 019: Beta Identity and Environment Boundary

**Status:** Accepted for V1 beta foundation
**Date:** 2026-08-19

## Context

CalorieBank's provider, banking, and ledger records are scoped to an internal UUID `User`, but application requests previously injected one shared `DEV_USER_ID`. That shortcut made local physical-device development practical but could not safely support multiple beta users. Health connections are especially sensitive because provider credentials, normalized health aggregates, and OAuth attempts must never cross users.

## Decision

CalorieBank uses Clerk for beta authentication. Expo uses Clerk's hosted Account Portal, keeps the active session in iOS Secure Store, and sends the Clerk session JWT as a bearer credential through the central API client. Express verifies that credential with Clerk middleware. The API maps the verified Clerk subject to one internal CalorieBank UUID and all `/v1/me/*` repositories continue using that UUID.

The mapping is stored as nullable `User.authProvider` and unique `User.authSubject`. New verified identities create a new internal user. Email is descriptive metadata, not an ownership key: a deleted and recreated Clerk user may use the same email and must receive a distinct internal account. Existing development data is preserved and can be linked once with the guarded `auth:link-existing` command.

A verified Clerk subject is the only authenticated ownership key. It maps to exactly one internal CalorieBank user, and an internal user maps to at most one Clerk subject unless a future explicit account-linking operation is approved. An unknown verified subject provisions a new internal user transactionally; it never falls back to `DEV_USER_ID`, an email match, the first user, or any other existing user. Concurrent first requests converge on the same subject mapping through the unique database constraint.

Google Health/Fitbit and FatSecret authorization starts require the authenticated internal user. Their callbacks may arrive without a CalorieBank mobile session, so callback ownership comes only from the expiring, single-use, server-side OAuth attempt created for that user. Callback query values never select a CalorieBank user. Provider credentials remain encrypted and server-side.

Apple Health commands do not accept a client-selected user. Their bearer credential resolves the internal owner before normalized aggregates or sync sessions are written.

## Environment Boundary

- **Local:** `APP_ENV=local` may use `AUTH_MODE=development` with explicit `DEV_USER_ID`. It may also run Clerk for end-to-end authentication testing. A local API in development-auth mode rejects bearer credentials instead of silently applying `DEV_USER_ID`; physical Clerk testing therefore requires `AUTH_MODE=clerk` and both server-side Clerk keys. Local HTTP and development diagnostics remain development-build only.
- **Beta/preview:** `APP_ENV=beta` requires `AUTH_MODE=clerk`, a stable HTTPS API, a separate beta database, stable provider callback URLs, and environment-managed secrets. Synthetic development ingestion is rejected.
- **Production:** uses the same fail-closed identity shape with separate production values. This ADR does not claim that production infrastructure exists.

The API refuses parsed configuration when beta or production selects development authentication. Preview and production EAS profiles do not enable the local-network HTTP exception.

## Security Consequences

- A verified external subject, never a request body, query, or unverified user header, selects the user.
- User-owned repositories retain their existing `userId` filters and ownership checks.
- OAuth callback state remains random, expiring, single-use, and bound server-side to its initiator.
- Authentication tokens are not logged and provider tokens never enter mobile JavaScript.
- Email never claims, merges, or blocks an account. A new verified subject provisions a separate internal user even when it reuses an existing email.
- Missing or invalid credentials return `401`; public health and provider callback routes remain narrowly exempt.
- A Clerk-enabled mobile build and a development-auth API are an invalid pair and fail closed before any `/v1/me/*` data is resolved.

## Alternatives Rejected

- **Shared beta user:** violates health-data and ledger isolation.
- **Client-provided user ID:** is not an authentication boundary.
- **Custom password system:** would make CalorieBank responsible for password storage, reset, verification, and session cryptography without product value.
- **Automatic email claim of existing users:** creates avoidable account-takeover risk during migration.

## Manual Infrastructure Remaining

Create Clerk development and production instances as appropriate, configure the Expo application and allowed redirect, create a hosted HTTPS beta API and separate database, register stable provider callbacks, configure EAS environment values and secrets, apply migrations, and explicitly link the existing development user to the intended Clerk subject before testing that historical account. TestFlight submission is not performed by this decision.
