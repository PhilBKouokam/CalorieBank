# Local recovery evidence safeguard

`restore-evidence.ts` is a bounded offline advisory check. It never connects to a
database, reads configuration, changes files/accounts, applies deletion, releases
a restored system or creates a permanent deletion registry. It is not imported by
the API/worker/mobile runtime. Keep real manifests outside Git in owner-only files.

The qualified behavior is fail-closed for missing deletion/identity evidence,
recreated identities, incomplete evidence windows, ambiguous mappings and attached
services. Every result keeps `releaseAuthorized: false`. No email matching, blanket
approval or valid Clerk identity can authorize resurrection of an older account.

An operator must independently verify the evidence sources, actual complete
inventories, historic encryption key and recovered database. This tool cannot
prove that caller-supplied completeness flags are true. Do not treat its synthetic
tests or `evidence_consistent` as an executed deletion-aware restore qualification.
Keep API, worker, provider calls and push detached until the separately approved
reconciliation and read-only accounting/ownership checks are complete. No retention
policy changes or automatic cleanup are authorized by this tool.

Pinned Node 20 check:

```sh
node --import ./node_modules/tsx/dist/loader.mjs --test tools/privacy/restore-evidence.test.ts
```

This is intentionally absent from production build/release wiring. No new
dependencies, credentials, services or storage system are required.
