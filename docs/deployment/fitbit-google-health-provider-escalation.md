# Fitbit / Google Health daily calorie discrepancy — provider escalation

Reviewed September 25, 2026. Status: **OPEN — EXTERNAL PROVIDER INVESTIGATION —
NON-BLOCKING FOR MANUAL INTAKE**. Support draft prepared, **not submitted**.

## Decision and boundaries

No new CalorieBank correctness defect is established. Stored raw expenditure
matches the documented API field after rounding. Neither another authoritative
value nor a finalization delay is justified by the evidence. This is not a claim
that the upstream discrepancy is resolved or harmless in every future scenario.
Reassess if Google identifies an integration error or different required contract.

**PHASE 1B REPLACEMENT BUILD: PASS — FITBIT UI/API DISCREPANCY TRACKED AS
NON-BLOCKING PROVIDER INVESTIGATION**

This founder-authorized gate decision supersedes the earlier investigation hold
in [replacement closeout](phase1b-replacement-closeout.md). It does not grant full
Phase 1B PASS or native physical qualification of the pending Back correction.
That correction (commit `4fd624f`) remains held for the next consolidated feature
binary, with native build and iPhone visual verification still required. No
arrow-only or Fitbit-investigation-only binary is needed.

When Phase 1B resumes, retain the pre-enablement capability/safety checkpoint,
consolidated feature binaries as appropriate, controlled enablement, real manual
account physical qualification, unsupported requests against real manual state,
and completed-day manual finalization. None is performed by this document-only
task. Manual Intake remains disabled; Phase 2 is not started.

## Official documentation reviewed

These are source findings, not established explanations for this account:

| Official source | Relevant finding and limit |
| --- | --- |
| [Calories and energy](https://developers.google.com/health/data-types/calories) | Recommends daily `total-calories` rollup for overall expenditure. Total includes basal and active energy; activity-only energy excludes basal. Supports the current field choice. |
| [dailyRollUp reference](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/dailyRollUp) | Civil closed-open interval, one-day window, all-sources default. Daily output represents reconciled data and filters identified off-wrist wearable records. Does not promise UI equality. |
| [TotalCaloriesRollupValue](https://developers.google.com/health/reference/rest/v4/TotalCaloriesRollupValue) | Defines numeric `kcalSum` in the total-calories aggregate. |
| [Endpoints](https://developers.google.com/health/endpoints) and [filters](https://developers.google.com/health/filters) | Document source-family selection and physical/civil queries. No source-priority rule found that explains these four differences. |
| [Data presence and true zeros](https://developers.google.com/health/data-presence-and-true-zeros) | Explicitly includes Total Calories in on-wrist filtering; contrasts this with legacy Fitbit behavior. A useful question for Google, not proof that the UI includes the excluded data or that filtering caused the observed gaps. |
| [Data management](https://developers.google.com/health/data-management) | Later syncs can upload re-bucketed overlapping records; reconciliation selects authoritative records. Source updates can propagate. No completed-day settlement deadline or UI-equality guarantee found. |
| [Troubleshooting](https://developers.google.com/health/troubleshooting) | Check account identity and last sync; fetch historical periods after delayed device synchronization. Does not establish delay as the cause here. |
| [Device synchronization](https://support.google.com/googlehealth/answer/14237221?hl=en) | Nearby Fitbit devices sync on opening Google Health and throughout the day. This general behavior does not prove opening the app caused the observed API change. |
| [Daily activity calculation](https://support.google.com/googlehealth/answer/14237111?hl=en) | Device calorie totals combine BMR and activity, with heart-rate input where supported. No exact mobile Energy Burned/API calculation equivalence stated. |
| [Third-party connections](https://support.google.com/googlehealth/answer/14236613?hl=en) | Warns of differences between third-party device apps and Google Health due to calculations/available data. This broad warning does not specifically explain Google's own UI versus Google's API. |
| [Migration specifications](https://developers.google.com/health/migration/api-specifications) | Maps total `caloriesOut` to `total-calories`; distinguishes activity-only burn. No justified alternative field for exact UI parity identified. |
| [Parity tool](https://developers.google.com/health/migration/parity-tool) | Compares legacy Fitbit and Google Health APIs, not the mobile UI. No extra permissions/tool authorization requested. |
| [Release notes](https://developers.google.com/health/release-notes) | No documented fix or explanation found for this specific discrepancy. |

No exact UI/API equality promise was found in the reviewed official material.
This is not proof that Google intends them to differ. BMR handling, filtering,
deduplication, local/cloud pipelines and synchronization remain questions, not
diagnoses. Final integer rounding cannot explain differences of 57–85 kcal.

## Evidence provenance and limitations

The [closeout evidence](phase1b-replacement-closeout.md) contains the earlier
read-only provider requests, timestamps, source-family comparison and unchanged
accounting fingerprints. This task makes no new authenticated provider query.
UI values are founder observations for the same account/dates; last-sync time and
precise UI capture times were unavailable. Do not represent them as simultaneous
instrumented measurements.

Current-day API readings rose from 3896.751018 at 21:31:03.804Z to 3941.542674 at
21:37:42.713Z on September 25. The intervening founder UI observation was 3946.
Elapsed time and ongoing activity prevent a causal sync conclusion. Completed
September 23 did not revise between the recorded queries. General support for
updates is not evidence of a historical revision on these dates.

## Official channel and submission hold

Use **Report Google Health API issues → Go to the Issue Tracker** on the official
[Google Health developer support page](https://developers.google.com/health/support).
That page separately lists the developer forum and consumer help center; the API
Issue Tracker is the appropriate primary escalation. Its linked tracker could
not be loaded by the research tool, so authenticated form access and issue
visibility have not been verified. No case number exists.

Founder approval is required before external submission, per this task's explicit
instruction. Confirm the destination's visibility before submitting health totals;
do not attach account identifiers, credentials, raw health payloads or screenshots
containing personal information. If Google needs account-level investigation,
request its secure process and only then obtain the necessary user authorization.
No additional scopes or permissions were granted.

## Exact support draft — not sent

**Subject: total-calories dailyRollUp consistently below Google Health Energy Burned on four completed dates**

Hello Google Health API team,

CalorieBank is a private-beta application that reads total daily expenditure.
For one user's completed dates, your documented total-calories daily rollup
consistently returns less than the Energy Burned total that user sees in Google
Health/Fitbit. CalorieBank stores the API result rounded to whole kcal; the
discrepancy exists before any CalorieBank adjustment or accounting calculation.

Endpoint:
`POST https://health.googleapis.com/v4/users/me/dataTypes/total-calories/dataPoints:dailyRollUp`

Field: `rollupDataPoints[].totalCalories.kcalSum`

We request one civil date at a time, inclusive start/exclusive next-date end,
`windowSizeDays: 1`, and
`dataSourceFamily: "users/me/dataSourceFamilies/all-sources"`.
The CalorieBank account timezone is America/Chicago. Example request:

```json
{
  "range": {
    "start": { "date": { "year": 2026, "month": 9, "day": 23 } },
    "end": { "date": { "year": 2026, "month": 9, "day": 24 } }
  },
  "windowSizeDays": 1,
  "dataSourceFamily": "users/me/dataSourceFamilies/all-sources"
}
```

| Date (2026) | User-visible Energy Burned | API kcalSum | CalorieBank raw kcal |
| --- | ---: | ---: | ---: |
| September 21 | 5207 | 5135.412582 | 5135 |
| September 22 | 4395 | 4322.763966 | 4323 |
| September 23 | 5271 | 5185.987776 | 5186 |
| September 24 | 3999 | 3942.280998 | 3942 |

All four API queries succeeded on September 25 between 21:30:59Z and 21:31:03Z.
September 23 returned exactly 5185.987776 both at 01:44:27Z and again at
21:37:43Z that day; the user's reported UI total remained 5271. We observed no
historical convergence. UI observations were not captured simultaneously with
the API queries, and the device's last-sync time was unavailable.

A September 23 physical-time rollUp cross-check over
2026-09-23T05:00:00Z to 2026-09-24T05:00:00Z, using 60-second windows and all
pages, summed to 5185.987775999975, agreeing with the civil result within floating
point precision. Earlier google-sources/google-wearables checks also returned
the same September 23 daily total. These checks have not explained the gap.

What explains the difference between this documented `totalCalories.kcalSum`
and the Energy Burned total shown to the same user in Google Health?

1. Are these values expected to be identical for a completed local date?
2. Does Google Health use additional local/device data not exposed by this API?
3. Is another API field or aggregation intended to match Energy Burned exactly?
4. Can completed historical dailyRollUp totals remain permanently different?
5. What synchronization/freshness procedure is recommended before querying a completed day?
6. Does opening Google Health trigger synchronization that changes API availability, and is there a completion signal?
7. Is `totalCalories.kcalSum` still the recommended authoritative field for third-party total daily expenditure?

Your documentation recommends this rollup and also describes on-wrist filtering
for Total Calories and reconciliation of overlapping sync records. Could those
rules differ from the Energy Burned UI's treatment of basal/off-wrist periods or
source priority? We have not established any of those as the cause. Please clarify
the intended contract and whether this pattern warrants a provider bug report.

No account identifiers, access tokens or raw personal records are included, and
we are not requesting private account inspection at this stage. If account-level
evidence is necessary, please specify the minimum needed and a secure channel.

Thank you.

## Delivery and safety

Documentation only. No product code, consumer copy, endpoint, ×0.8 policy,
finalization timing, September 21–24 History, Opening Bank or ledger was changed.
No backend deployment, binary creation, private distribution change, public
release or Manual Intake enablement occurred. Backend remains the previously
verified `bad1750`; existing artifacts remain iOS 1.0.0 (7) and Android
1.0.0 versionCode 6. These are prior verified states, not fresh live checks.

Recovery-message behavior retains automated/rendered evidence only; no natural
missing-data day was available for physical qualification. Previously passing
startup, source chooser, cross-device presentation and navigation checks are not
reopened. Documentation validation uses `git diff --check`; runtime tests are
not rerun for this documentation-only decision.
