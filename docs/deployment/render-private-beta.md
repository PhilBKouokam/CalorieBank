# Render Private Beta

`render.yaml` defines one private-beta database and two host processes in Render's Ohio region:

- `caloriebank-beta-db`: private-network PostgreSQL 17 with public inbound access disabled.
- `caloriebank-beta-api`: the Clerk-authenticated Express API.
- `caloriebank-beta-lifecycle`: an hourly account-wide lifecycle cron job.

Create a Render Blueprint from this repository, then supply every `sync: false` variable in both services. The Blueprint supplies the same private `DATABASE_URL` to both services; enter identical Clerk values, provider credentials, callback URLs, and encryption keys for the API and cron. Render prompts for `sync: false` values only during initial Blueprint creation; later additions must be set in the service dashboard. Set callback URLs to the deployed HTTPS API host and register those exact URLs with Google/Fitbit and FatSecret.

Both services intentionally deploy branch `codex/private-beta-release`. Do not create the Blueprint until that branch and all listed migrations are present on GitHub.

The clean build explicitly includes build tooling, generates Prisma Client, and compiles the API and lifecycle entry point. The paid web service runs `npm run db:deploy` as Render's pre-deploy command, then starts only the API process. The cron executes compiled JavaScript through `npm run lifecycle:run`; it does not depend on a TypeScript runtime in the scheduled process. The readiness probe is public at `/health/ready`, checks database connectivity, and exposes no account data.

The EAS preview environment must set:

```text
EXPO_PUBLIC_APP_ENV=beta
EXPO_PUBLIC_AUTH_MODE=clerk
EXPO_PUBLIC_API_URL=https://<render-api-host>
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=<beta publishable key>
```

Do not place database, Clerk secret, OAuth secret, encryption, or provider credentials in Expo public variables.

After deployment, verify the API readiness URL and inspect the cron log for one `lifecycle_run_completed` event. A user-level provider failure is reported inside the summary but does not fail the whole cron process; a job-level database/configuration failure exits nonzero.

## Callback URLs

Replace `<render-api-host>` with the assigned public Render hostname and use these exact HTTPS callback URLs in both Render services and the provider dashboards:

```text
GOOGLE_HEALTH_REDIRECT_URI=https://<render-api-host>/v1/me/integrations/fitbit/callback
FATSECRET_REDIRECT_URI=https://<render-api-host>/v1/me/integrations/fatsecret/callback
```

The callbacks are intentionally public because provider redirects do not carry a Clerk bearer token. Ownership is resolved from expiring, single-use server-side OAuth attempts; authorization-start routes remain Clerk protected.

## Hosted environment contract

Set the following on **both** `caloriebank-beta-api` and `caloriebank-beta-lifecycle`. Values must match across services. `DATABASE_URL` is supplied automatically from `caloriebank-beta-db`.

| Variable | Secret | Source |
| --- | --- | --- |
| `CLERK_PUBLISHABLE_KEY` | No | Clerk API Keys; same Clerk instance as the preview app |
| `CLERK_SECRET_KEY` | Yes | Clerk API Keys; must match the publishable-key environment |
| `CORS_ORIGIN` | No | Use the deployed API HTTPS origin for this native-only beta; never `*` |
| `GOOGLE_HEALTH_CLIENT_ID` | No | Google Cloud OAuth 2.0 Web application client |
| `GOOGLE_HEALTH_CLIENT_SECRET` | Yes | Same Google Cloud OAuth client |
| `GOOGLE_HEALTH_REDIRECT_URI` | No | Exact deployed Fitbit callback shown above |
| `GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY` | Yes | Existing 32-byte base64 key; do not rotate while encrypted credentials exist |
| `EXTERNAL_PROVIDER_TOKEN_ENCRYPTION_KEY` | Yes | Existing 32-byte base64 key for FatSecret; do not rotate while credentials exist |
| `FATSECRET_CONSUMER_KEY` | No | FatSecret Platform OAuth 1.0 application |
| `FATSECRET_CONSUMER_SECRET` | Yes | Same FatSecret application |
| `FATSECRET_REDIRECT_URI` | No | Exact deployed FatSecret callback shown above |

`NODE_ENV=production`, `APP_ENV=beta`, `AUTH_MODE=clerk`, and `TODAY_INGESTION_MODE=device` are fixed by the Blueprint. `DEV_USER_ID`, `DEV_USER_EMAIL`, `SHADOW_DATABASE_URL`, all `WHOOP_*` values, and provider endpoint override variables are not beta service configuration.

The API refuses to boot in beta if authentication, callbacks, provider credentials, or encryption keys are absent, if a callback is not HTTPS, if a Clerk key pair mixes test/live environments, or if an encryption key is not 32 bytes after base64 decoding.

## External console checklist

1. In Google Cloud Console, enable the Google Health API for the OAuth project and edit the Web application OAuth client. Add the exact `GOOGLE_HEALTH_REDIRECT_URI` under **Authorized redirect URIs**. In **Google Auth Platform > Audience**, add every private-beta Google/Fitbit account as a test user while the app remains in Testing. The activity/fitness scope is restricted; do not invite users who are not allowed by the current consent-screen status. Testing-mode refresh tokens can be time-limited, so reconnect behavior remains a P0 beta check.
2. FatSecret uses delegated three-legged OAuth 1.0. The API sends the absolute HTTPS `FATSECRET_REDIRECT_URI` as the signed `oauth_callback`; FatSecret returns `oauth_token` and `oauth_verifier` to it. No OAuth 2.0 client-credentials substitution is valid for a user's diary.
3. For a Clerk production instance, add iOS Native Application `com.caloriebank.mobile` with the Apple Team ID, enable Native API, and allowlist `com.caloriebank.mobile://callback`. The `@clerk/expo` plugin registers that scheme in the preview binary. A Clerk development instance may be used for a tightly controlled beta only when the API and app use that same test instance.

## EAS preview

The `preview` profile fixes `EXPO_PUBLIC_APP_ENV=beta` and `EXPO_PUBLIC_AUTH_MODE=clerk`. Add only these public values to the EAS `preview` environment before building:

```text
EXPO_PUBLIC_API_URL=https://<render-api-host>
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=<publishable key from the same Clerk instance as the API keys>
```

The app fails closed if the preview API URL is absent or not HTTPS. Never add `DATABASE_URL`, `CLERK_SECRET_KEY`, provider secrets, or encryption keys to EAS.

Create the EAS variables in project `@philbk/caloriebank`, environment `preview`, then run from `apps/mobile`:

```sh
eas build --platform ios --profile preview
```

This is a new internal-distribution binary even though PB.1B added no native dependency. Register tester device UDIDs when EAS requests them. Existing development-client builds are not the private-beta preview artifact.
