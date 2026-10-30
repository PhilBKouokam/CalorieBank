# Phase 6H — bounded API-only reference correction

Base is exact deployed API `10efdc91ea2cfd627002d0c4cd428f534f279f66`.
No production change has been made. This branch is a local approval candidate.

Only three runtime files differ:

- `packages/domain/src/forecast-coverage.ts`: preserve an unchanged value/reference
  pair when reported buckets advance; expire undated initial/revised planning;
  retain useful prior dated evidence through optional metadata failures without
  renewal; export a planning-only elapsed/future-rest conservation helper.
- `packages/domain/src/index.ts`: export that helper; no accounting equation changes.
- `apps/api/src/modules/today/today.repository.ts`: use the conserved unrounded
  planning baseline; withhold undated planning and prevent prior-day guidance at
  midnight. Confirmed raw/adjusted Burned serialization is unchanged.

There are no changes to Google authorization/admission/token/transport code, its
server configuration, worker, credentials, database schema/migrations, permissions,
provider selection, account deletion, finalization or ledger. In particular the
seven original bindings plus approved eighth binding are neither read nor edited
by this local patch. The server configuration must be reverified in live preflight.

Test-only changes add automatic-reference and exact raw catch-up regressions and
update the old optional-query expectations. The explicit default-deny migration
DDL-audit guard is reused. The already-qualified deterministic Opening Bank fixture
starts its test import strictly after source selection instead of racing the system
clock; no Opening Bank production code is changed.

The complete shipping candidate is separately `c9738c8` on
`codex/phase6h-automatic-forecast`. It removes rejected Walking Plan and retains
banking core, native permissions, attribution/notices and tester admission.
Do not deploy that entire shipping branch as a substitute for this bounded patch.

Live approval sequence, all still pending:

1. Approve this exact API-only source after reviewing the qualification below.
2. Fresh preflight: exact deployed baseline/config, eight exact account bindings,
   no migrations, unchanged worker, readiness, provider state and read-only
   accounting baseline. Stop on any discrepancy.
3. Deploy/restart API only if separately authorized. No worker restart or migration
   command. Verify matching/unapproved/mismatched admission, existing connections,
   confirmed burn, forecast readiness/expiry and accounting preservation.
4. Approve one consolidated private mobile pair from the shipping candidate after
   fresh source/signing/profile/quota preflight. Production/private release scope
   and provider permissions are unchanged. Distribution stays private.

Rollback must not replay historical accounting. Revert only these planning runtime
changes to `10efdc9` with unchanged admission/configuration. Planning metadata is
not backfilled; evaluate freshness after restart. Forward recovery reuses the same
source after resolving a verified preflight failure; never relax admission or dates.

Limitations: reported Google rollup intervals are partial evidence, not complete
coverage. The patch removes timestamp-only drift; changing step/calorie evidence
can still change total-step targets. The original 69 kcal UI/API episode has no
contemporaneous provider payload and timing proof. No physiology or latency cause
has been established. No additional phone capture or provider acquisition occurred.

Qualification: **PASS**, Node **20.20.2**, **1,211 passed / 2 intentionally skipped**
in 116 passing test files. Prisma generation/validation, workspace typechecks/lint,
domain/schema/API compilation and diff checks passed. No migration was deployed.
The shipping candidate independently passed 1,319 tests / 2 deliberate skips.
Full logs remain local in `/private/tmp/caloriebank-phase6h-api-gate.log` and
`/private/tmp/caloriebank-phase6h-release-gate.log`.
