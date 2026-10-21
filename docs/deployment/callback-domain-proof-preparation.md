# Callback ownership proof — isolated preparation

October 21, 2026. Prepared only; no deployment or Search Console verification.

Base: the inspected live Render API commit
`3ff8b90438bd4851de74d6d009d8f4fcb4a4d3db`.
Branch: `codex/google-domain-proof`. Integration owner: root launch workstream.

The only runtime delta is an exact GET response at
`/google0aac822cbde53d15.html`, before account authentication. It returns the
53 downloaded challenge bytes, SHA256
`1ad0cccd434f13ce34773feedd4707cafe00c90850c132cb1d86b0d6cae30904`.
It does not serve a directory, accept uploads, alter a redirect/client/scope,
read user records, change credentials, enable features or run migrations.

## Local evidence

Node20.20.2: six focused proof/authentication cases plus thirteen existing Google
callback cases passed (19/2files). Tests execute the real Express application
and authentication boundary with synthetic credential verification; they do not
contact Google or qualify real production identity access. API no-emit TypeScript,
scoped ESLint and diff-check pass. Installed dependencies were reused; none were
installed. Initial sandbox socket creation was denied; authorized local-socket
execution passed. The old live base predates the repository Node20 wrapper, so
validation explicitly uses the installed20.20.2 binary.

The proof's HTTP200, exact bytes/MIME/no redirect, unchanged protected account and
authorization-start routes, rejection of an unrelated proof path/POST, existing
public health and provider-cancellation behavior are covered. The proof itself is
public and intentional; only its exact GET/HEAD response precedes authentication.

## Separate founder approval required

Approve a bounded proof-only deployment to the existing Render callback service
`srv-dabhml4s728c739ut0k0`, followed by the corresponding Search Console URL-prefix
ownership verification by the existing project/domain owner. This is not OAuth
publication, branding submission, restricted-scope submission or a feature rollout.

Before an approved deployment, recheck the live source and isolate this runtime
hunk onto that exact source if it advanced. Do not deploy an optional-feature
branch or older source to obtain the proof. Use Node20.20.2, existing credentials
and capacity; run the applicable release/deployment gate. Preserve auto-deployOff,
working callbacks and all feature flags. No database migration.

After approved deployment: verify unauthenticated HTTPS200 and exact bytes at
`https://caloriebank-beta-api.onrender.com/google0aac822cbde53d15.html`, verify
existing health/protected endpoints, then use the downloaded HTML-file method in
Search Console. Retain proof for ongoing verification. Google ownership and brand
acceptance remain external outcomes, not local test passes. If Google rejects
this hosting proof, assess an owned custom callback alias separately; do not
change DNS or the working authorization flow automatically.

## Development callback inventory

The checked application/tooling source has one ngrok reference: a synthetic
redirect fixture in `apps/api/tests/google-health-oauth-callback.test.ts`.
No checked application or tooling runtime reference was found. Documentation
retains the console's actual registered development callback. This excludes
ignored local environment files, running tunnels, external services and other
users' workflows; it does not prove the callback unused. Before retiring it from
Google's public-review project, confirm those dependencies and approve the exact
console removal. Preserve the Render callback and sole current read scope.
