# Phase 1B replacement closeout — September 25, 2026

Status: **PASS CANDIDATE**. Manual Intake remains disabled. No new binary,
backend deployment, accounting change, or public release is authorized by this
closeout. The native Back correction is held for the next consolidated binary.

## Back alignment

Build 7 navigation works; the founder photo shows the glyph displaced within
UIKit's white bar-button background. The old test only asserted a centered 48×48
React Pressable, missing the outer native layout entirely.

The pinned `react-native-screens` 4.16.0 passes its header subview directly to
`UIBarButtonItem`. UIKit can resize that custom view independently of Yoga's
content frame on iOS 26. The dependency has no wrapper to re-center that content.
This is the mechanism documented and fixed by the library's
[upstream issue](https://github.com/software-mansion/react-native-screens/issues/2990)
and [upstream correction #3449](https://github.com/software-mansion/react-native-screens/pull/3449).
It explains why changing inner Pressable alignment did not address the native
container. The founder device's native view hierarchy was not instrumented here;
the mechanism is established in the pinned source and upstream reproduction,
not measured directly on that phone.

CoreText inspection of the actual bundled Ionicons glyph at size 28 found an
advance of 28, ink bounds `(8.75, 1.2578125, 10.6640625, 18.484375)`, ascent
24.828125, descent 3.8828125, and leading 2.515625. There is no evidence supporting
another arbitrary arrow padding/translation adjustment.

The pinned, idempotent postinstall patch adapts the upstream wrapper approach to
our left bar items on iOS 26+. It retains the Yoga content size as intrinsic size,
centers both native anchors within UIKit's wrapper, uses lower-priority equal-size
constraints with content hugging, and converts bounds rather than double-counting
an offset frame. A weak cached wrapper avoids rebuilding it or introducing a
self/wrapper retain cycle. Right items, header title, Android sources, the
48×48 Pressable, icon, Back accessibility label, and navigation handlers remain
unchanged. All current app `headerLeft` implementations use this Back component.
The script fails closed if the pinned version/expected source changes.

This is a native presentation change, not another JS-only padding adjustment.
No separate replacement build was requested. It must be compiled and checked on
an iPhone in the next consolidated Phase 1B build before calling the native visual
result physically qualified. Local Xcode is not installed (CommandLineTools only),
so no UIKit compile or simulator result is claimed.

Validation:

- Focused navigation and native-wrapper regression tests: 6 passed, 2 files.
  Regressions require centering in both native axes, preserved intrinsic size,
  correct coordinate conversion, unchanged right items, iOS availability guard,
  idempotence, and failure on changed patch anchors. These fail on the original
  unpatched native source; no snapshot was blindly updated.
- Postinstall patch executed twice successfully; JavaScript syntax check passed.
- A rendered geometry model using the real React Back component plus the native
  wrapper's centering constraints was inspected at 320, 390, and 393 px with
  100%/200% text. All six cases retained the 48×48 target and zero center offset
  between button/icon box and outer wrapper. This models the native layout; it
  is explicitly not a UIKit screenshot or physical iPhone PASS.
- Full workspace lint passed. Type checks/build results are recorded at closeout.

## Fitbit endpoint and date contract

Current endpoint:
`POST https://health.googleapis.com/v4/users/me/dataTypes/total-calories/dataPoints:dailyRollUp`

Field: `rollupDataPoints[].totalCalories.kcalSum` for the exact returned civil date.
Request: one-day closed-open civil range, `windowSizeDays: 1`, source family
`users/me/dataSourceFamilies/all-sources`. September 23 means
`{date:{year:2026,month:9,day:23}}` through September 24. No UTC timestamp or
explicit timezone is supplied to this civil endpoint. Account timezone is
America/Chicago. Adapter rounds raw kcal once; the existing 0.8 policy remains
unchanged. The recorded provider update timestamp is fetch time, not proof of
an upstream sample revision time.

[Google's calorie guide](https://developers.google.com/health/data-types/calories)
defines total calories as basal plus active energy and recommends its daily rollup
for daily expenditure. CalorieBank uses that recommended field, not activity-only
energy. [The rollup contract](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/dailyRollUp)
defines civil windows and reconciled/on-wrist source treatment.
[Fitbit's consumer explanation](https://support.google.com/googlehealth/answer/14237111?hl=en)
also describes daily burn using BMR plus activity, including heart-rate data where
available. These sources do **not** establish why this user's UI differs or promise
bit-for-bit equality between every UI surface and the API.

## Read-only historical requery and multi-date comparison

Original September 23 API observation: **5185.987776** at
2026-09-25T01:44:27Z. Prior alternate source-family queries returned the same value.

Fresh September 23 request sent **2026-09-25T21:31:01.453Z**, received
**21:31:02.224Z**, HTTP 200: **5185.987776** again. A second check at
**21:37:43.401Z** was identical. No observed revision toward 5271.

All comparisons below are for the same account; UI totals are founder-reported,
not simultaneous instrumented screenshots. Founder could not see last-sync time.

| September date | UI kcal | API kcal | CB persisted raw kcal | UI minus CB | API received (UTC, Sep 25) |
| --- | ---: | ---: | ---: | ---: | --- |
| 21 | 5207 | 5135.412582 | 5135 | 72 | 21:31:00.563 |
| 22 | 4395 | 4322.763966 | 4323 | 72 | 21:31:01.453 |
| 23 | 5271 | 5185.987776 | 5186 | 85 | 21:31:02.224 |
| 24 | 3999 | 3942.280998 | 3942 | 57 | 21:31:03.006 |

September 23 UI minus exact API = **85.012224 kcal**. The pattern is not isolated;
all four API totals round to the stored CalorieBank totals. It is not explained by
rounding the daily API response. This sample is insufficient to generalize to all
Fitbit users or declare a universal discrepancy formula.

A second query used the physical `rollUp` endpoint for Chicago's exact September
23 interval: **2026-09-23T05:00:00Z → 2026-09-24T05:00:00Z**, 60-second windows.
It returned no next page and summed to **5185.987775999975**, agreeing with the
civil rollup within floating-point precision. Summing individually rounded minute
values yielded 5062, not 5271; rounding each upward yielded 5988. Neither is an
accounting alternative. A separate 86400-second probe was rejected with
INVALID_ARGUMENT; no total is inferred from that rejected request.

The timezone probe does not support a Chicago civil/UTC boundary mistake for
this date. It does not establish the user's device timezone history or the UI's
internal aggregation algorithm.

The documented paired-device endpoint returned **403 PERMISSION_DENIED** under
the existing integration grant. No permissions were expanded, credentials exposed,
or reconnect requested. Device last-sync time remains unknown.

## Current-day observations and synchronization limits

September 25 API at 21:31:03.804Z: **3896.751018**. At that time CalorieBank's
persisted raw Today value was **3893**, fetched at 21:28:09Z. The founder later
reported current UI **3946**; the next API query at **21:37:42.713Z** returned
**3941.542674**, while CB's stored aggregate was still 3893 because this inspection
intentionally did not ingest data or run refresh/finalization.

The current-day API advanced normally between observations. The readings were
not simultaneous; elapsed time and normal activity are confounders. No device
sync completion was observed, and there is no controlled app-closed T1 because
the founder had already opened the provider for the historical comparisons.
Therefore this is observational evidence, not proof that opening the app caused
an API revision or fixed the completed-day discrepancy.

[Google's sync help](https://support.google.com/googlehealth/answer/14237221?hl=en)
says nearby devices sync automatically when the app opens, as well as throughout
the day. [Its troubleshooting guide](https://developers.google.com/health/troubleshooting)
recommends inspecting last-sync time and refetching historical data after sync.
These establish that delayed delivery is possible in general, not that it caused
the September 23 difference. No historical late revision was demonstrated here.

## Conclusions and decision boundary

Established: CB reflects the recommended cloud total; the completed-date UI/API
difference persists across four dates and repeated queries. Root cause **within
the provider/UI remains unestablished**. No evidence proves wrong API field,
missing BMR, local-only samples, different activity inclusion, permanent semantic
incompatibility, or an 85-kcal late revision. Exact parity is not demonstrated;
it must not be promised or declared fundamentally impossible from this evidence.

No accounting-source change, settlement delay, new consumer copy, or historical
correction is recommended on current evidence. ADR 009 already supports two local
days of provisional append-only reconciliation before permanent lock; that contract
is unchanged. A delay would not necessarily fix a stable API/UI difference.
Any future source/finalization policy change requires a concrete supported contract
and founder approval before implementation.

Remaining Fitbit requirement: obtain a provider-level explanation for these
same-account, same-date totals, or new controlled evidence identifying the
aggregation/sync cause. A private support report can use the dates, endpoint,
query timestamps and differences above; do not transmit account identifiers or
health evidence to support without founder authorization. No support report sent.

## Safety and qualified physical results

Read-only Prisma transactions and direct provider aggregation reads were used.
No ingestion, lifecycle execution, accounting mutation, token refresh, source
switch, or historical edit was invoked by this investigation. September 23 remains
5186 raw / 4149 adjusted. ×0.8 unchanged; Opening Bank, ledger and finalized history
remain unchanged. At 21:30:59Z and 21:37:41Z the four accounting fingerprints matched
the prior baseline:

- Opening rows (5): `b8d5651ffc8336e346567d9b216fab7a80625785bd6803f736cde0aaf1e64ee0`
- Finalized rows (15): `8e05e50c4c1ce3cf028718267b2118214d0ffbd8f71572ab61aacebe14708f86`
- Snapshots (17): `07cbf382c928bf7db75919e92d3acbe1c02b462352442672cfcfaa262188ee21`
- Ledger (17): `42d326304e61ffefd3afde4274afd4b1a0d876b32958439dca789dfd5733b6aa`

Already-passing startup, single Cronometer choice, Back navigation, History,
Android chooser and cross-device card checks remain qualified at their recorded
physical evidence level. Samsung installed versionCode 6 / Play installer was
ADB-verified. Recovery messaging remains automated/rendered evidence only; no
missing historical day was manufactured. Build 7's Back visual result remains
failed until the correction reaches and passes a later native build.

## Delivery checkpoint

Final focused tests: **6 passed / 2 files**. Workspace lint passed; workspace
TypeScript checks passed after correcting the new test harness's CommonJS import
path (API rechecked after that correction). API/domain/schema builds passed.
`git diff --check` passed. The earlier 936-test/86-file release run is prior-build
evidence, not claimed as rerun for this native-only correction. No Prisma/schema
or backend behavior changed.

At **2026-09-25T21:40:27.755Z**, read-only server inspection confirmed deployed
commit `bad1750ae997f434c878b33b091ca3b678e70b5f`, Manual Intake selection disabled,
zero manual authority boundaries and zero manual selections. Existing private
binaries remain iOS 1.0.0 (7) and Android 1.0.0 versionCode 6. No new remote build
or deployment was requested. Commit uses `[skip render]` to hold backend release.

Changed files: root `package.json`, the pinned iOS Back patch script, its regression
test, this closeout document, and the Phase 1B deployment evidence index.

**PHASE 1B REPLACEMENT BUILD: PASS CANDIDATE — FITBIT UI/API discrepancy
explanation remains; native Back correction is held for the next consolidated
binary and still requires native qualification.**

Do not begin Manual Intake enablement automatically. No finalization decision is
requested on speculative evidence; the next investigation step is provider-level
explanation of the persistent four-date discrepancy.
