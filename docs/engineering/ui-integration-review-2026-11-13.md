# Today, History and share integration review — 2026-11-13

This local integration follows planning-diagnostic commit 82a5928. It is not a native build, store submission or public release.

## Integrated changes

- Today restores distinct burned/eaten/projected/budget colors, contextual information icons, the saved-goal Eating Budget explanation and the existing inverse burn-planning card. The burn-only card uses expenditure/activity readiness independently of intake connectivity. Missing projection data stays unavailable without crashing or fabricating values. Strict food-linked planning remains independently gated.
- History uses calendar day, Sunday week, month, three-month, year and all-history views. Month/three-month lists group weeks, year/all group months. Signed totals preserve real zero and missing-only null, accounting gaps remain visible, and Opening Bank days are counted once. UTC date-key arithmetic preserves calendar boundaries and leap days.
- The screenshot prompt headline is “Want to share your bank?”. Preview, explicit user action and the native app/audience chooser remain unchanged. No direct social-network integration or automatic external sharing was added.
- The keyboard input inventory includes the restored Today burn-target input.

## Integration findings resolved

Independent review found automatic History detail reads could replace a later selected day, and late source-change responses could replace a newer selection after cancellation/navigation. Shared detail and picker ownership generations now reject those stale UI updates. Successful server changes can refresh history without overwriting another selected day's details. Date-bound server option IDs remain unchanged.

Rendered review reproduced the wrong-day detail race and the chart's uneven zero baseline/crowded month labels. The request fixes and top-aligned, spaced chart labels were rechecked in the actual components. A combined startup regression also exposed sparse projection fixtures; the card now safely handles absent projection data. An obsolete route test was updated to assert the new shared information modal, preserving both explanations and dismissal coverage.

## Verification

- Node 20.20.2: final combined selection passed **320 tests across 27 suites**. It covers Today startup/sticky header, planning/context/lifecycle, drafts/keyboard, History periods/rendered ownership and API, screenshot consent, consumer routes and responsive layouts.
- Repository `npm run lint`, `npm run typecheck`, and `git diff --check` passed. The final test-only modal assertion change also passed its focused suite and ESLint; the full 27-suite selection was rerun afterward.
- Nine initial History API failures were the missing isolated test-database prerequisite, not backend changes. They passed against the existing dedicated localhost test database on port 55439. No migrations or production database were used.
- Independent static review approved the corrected integration. Calendar aggregation, missing/partial data and accounting boundaries were reviewed without changing formulas.
- Synthetic browser review used the actual components at 320/390px and simulated 2x text. It exercised D/W/M/3M/Y/All, grouped expansion/collapse, previous/next periods, empty/missing/zero/signed histories, loading/error/retry, delayed detail responses, Today information dialogs, missing/ready burn states and the share sheet's reachable actions. Corrected chart axes and delayed selection were rechecked after source fixes.
- Browser checks are not native blur, physical keyboard, screenshot detection or OS share-sheet qualification. No real account data was used for rendered QA.

Evidence logs are /private/tmp/caloriebank-ui-integration-final-{tests,lint,typecheck}-20261113.log. The isolated synthetic preview harness is /private/tmp/caloriebank-history-integration-qa-20261113 (localhost port 4198).

## Remaining release boundaries

User review still precedes any native rebuild. Rebuild/device qualification and public distribution remain separate. Real Google food-linked planning remains unqualified under the existing evidence contract; this integration does not replace it with the projected whole-day estimate. The previously deferred local deficit/banking scenario behavior is not introduced here. No push, native/EAS build, deployment, store action, account mutation or external share occurred.
