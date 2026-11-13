# Planning availability copy review, 2026-11-13

## Scope and finding

Home discarded the strict Budget response's unavailable reason when passing its
selected numeric budget to `WalkingEatingCard`. The card then implied the whole
Eating budget was missing and blamed recent walking data even when the separate
projected total and ordinary walking forecast existed. Plan Today also reused the
total-budget explanation for its independently gated inverse plan. Expired
projected totals could fall through to an unrelated strict Budget explanation.

This patch keeps a coherent diagnostic reason separate from numeric eligibility.
Home still passes only `selectEatingBudget`'s result as the numeric budget. The
card distinguishes ordinary extra-walking semantics, stale inputs, missing data,
and unavailable food-linked planning. Plan Today and Home describe the displayed
total's own basis. Context, current-date, permission, pending and existing clock
checks suppress inapplicable diagnostic reasons. No raw diagnostic payload is
promoted into a calculation input.

`selectEatingBudget`, `selectEatingPlan`, `selectStepsForIntake`,
`selectProjectedEatingBudget`, all arithmetic and request eligibility remain
unchanged. Ordinary projections still cannot feed the total-step Home scenario.
An independently eligible walking-burn scenario and its editable draft remain
available when only food-linked guidance is unavailable. No layout, approved
Step Planning hierarchy, settings, intake, health data or bank/ledger changes.

## Remaining qualification boundary

ADR 012's 2026-11-05 addendum authorizes the projected whole-day total only. It
does not authorize weaker verified-budget, walking-alignment/calibration or
Remaining Today gates. The current Google adapter supplies no verified cumulative
expenditure watermark; `DailyStepAggregate` supplies no measured shared cutoff.
`PrismaEatingBudgetRepository` deliberately supplies no planning calibration
(`model: null`). An approved persisted source-specific observed-intake policy is
also absent. See `eating-planning-qualification-local.md`.

Consequently, current Google forward/inverse food planning remains unqualified;
refreshing alone is not promised to fix it. Ready forward/inverse behavior here
is synthetic regression evidence, not real-account availability. The Android 23
QA screenshot had no captured API payload, so this patch does not claim to prove
that account's exact server reason or feature-flag values.

## Verification

- Pinned Node 20.20.2: final selected API/mobile suite passed **20 files / 239 tests**.
- `npm run lint`, `npm run typecheck`, and `git diff --check` passed after the final
  code/fixture changes. An intermediate test-fixture type error was corrected and
  the complete selected suite, lint and typechecks were rerun successfully.
- Tests cover actual Home with projected total ready/strict Budget unavailable;
  coherent and rejected diagnostics; qualified strict forward/inverse plans;
  ordinary-only exclusion; independent walking burn; genuine missing data;
  expiry, legacy clock/future-anchor, context/date/permission/pending gates;
  no blocked planning requests; draft preservation and input nonmutation.
- The selected suite also includes account lifecycle, guidance context, provider
  planning evidence, step tracing, Today startup/metrics/sticky header, session
  drafts/navigation and keyboard safety regressions. Exact invocation is in the
  validation log, not a claim that the full historical release gate was rerun.
- Synthetic React Native Web visual review inspected Home and Plan Today at 320
  and 390 pixels, including 320-pixel simulated 2x text. Changed copy, inputs and
  actions wrapped/read cleanly without observed horizontal clipping. Scrolling
  reached lower large-text content. Reviewed projected-ready/strict-unavailable,
  independent walking-burn, ordinary-mode, stale and missing-data states. The
  walking-details link still opens extra-walking semantics. Final stale captions
  were rechecked on both screens after the last code change.
- The local preview is a companion bundle (`index.html`, `app.js`, font), not a
  standalone HTML attachment. Screenshots were inspected through the browser;
  no saved screenshot artifact or native blur/keyboard/device proof is claimed.
- No full database/release gate, migrations, native/EAS build, upload, deployment,
  push, store action, live API capture or user-account mutation was performed.

SDK 54 documentation was checked before coding. The versioned website redirects
to latest; the official `expo/expo` `sdk-54` archive's versioned reference and
Router docs were used instead. Independent source review approved the final
numeric-preserving diagnostic changes before this local commit.
