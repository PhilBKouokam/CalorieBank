# ADR 020: Opening Bank and Recovery Presentation

**Status:** Accepted for V1
**Date:** 2026-08-19

## Context

A truthful cumulative CalorieBank balance can become negative after finalized withdrawals or provisional corrections. Showing that negative number as Available Bank is misleading because there are no calories available to plan or allocate. Clamping the ledger itself would erase real accounting history. New users also should not begin in Recovery because of behavior before they joined CalorieBank.

## Decision

CalorieBank keeps one authoritative effective accounting balance. The consumer read model derives:

```text
availableBankCalories = max(0, effectiveBankBalanceCalories)
recoveryCalories = max(0, -effectiveBankBalanceCalories)
```

Recovery is not a second ledger or mutable account. Positive future contributions naturally move the effective balance toward zero and then positive territory. Existing provisional corrections can move the derived presentation into or out of Recovery without any special transaction type. Locked-day behavior remains unchanged.

For a newly authenticated user, Opening Bank initialization considers at most the immediately preceding seven completed local calendar days. A day is eligible only when the selected authoritative expenditure and intake records are both usable and the configured goal can produce the approved daily calculation. Current day, incomplete days, and competing unselected providers are excluded.

```text
historicalOpeningNetCalories = sum(eligible prior-day contributions)
openingEffectiveBalanceCalories = max(0, historicalOpeningNetCalories)
```

Initialization cannot commit until both selected roles have completed a deliberate query attempt covering current day plus the seven prior completed local dates. A queried date with no data is missing; an unqueried date is incomplete preparation and cannot justify an immutable Opening Bank. Matching eligible days then produce one immutable initialization boundary and its calculation snapshots.

When the completed attempt has no matching eligible day, onboarding may continue with Available Bank shown as not calculated. The current local date is preserved as the accounting boundary without fabricating a zero Opening Bank. On the first later completed day, the opening component becomes zero and that day posts through normal append-only accounting.

Opening Bank is an immutable accounting snapshot, not a daily ledger transaction. After activation:

```text
effectiveBankBalanceCalories =
  openingEffectiveBalanceCalories
  + sum(append-only active-accounting ledger transactions)
```

Consumer History answers how each completed day affected the bank. Its read model therefore combines immutable Opening Bank calculation dates and later finalized dates into one chronological collection with the same row and calculation-detail treatment. An internal `opening` or `finalized` provenance marker remains available, and opening-day detail may say `Included in your starting bank.` This presentation does not create ledger transactions, change `accountingStartsOn`, or make opening dates eligible for later finalization.

The latest completed contribution on Today is resolved from that same unified chronology. If yesterday is an immutable Opening Bank calculation date and no later finalized date exists, Today presents yesterday's contribution normally rather than claiming that no completed day exists.

When the historical opening net is non-positive, individual opening-day calculations remain visible even though the one-time starting balance floor produces `0 kcal`. Detail may explain concisely that a starting balance cannot begin below zero. The displayed daily values are not altered to make their visible sum equal the floored balance.

Opening Bank immutability assumes the initial-import completion evidence was truthful. If a pre-initialization Apple Health session marked a historical intake date both fingerprint-skipped and ready while the server had no aggregate, a later exact-writer recovery may idempotently complete the omitted Opening Bank calculation rows. This correction is allowed only while the original goal and provider selection are provably unchanged, and only for dates named by that false-complete session. Ordinary late provider data does not reopen or recalculate an initialized Opening Bank.

When initialization is waiting, the app performs one bounded full-window synchronization attempt for both selected roles. Transient failures remain retryable and block immutable initialization. A completed attempt with no eligible day is a valid no-history result, not an indefinite onboarding failure.

Accounts that existed before this policy are marked initialized with a zero opening component and no activation cutoff. Their existing ledger sum is preserved exactly; the new Available Bank and Recovery presentation applies without retroactive forgiveness.

Planned Treat progress uses `availableBankCalories`. It remains zero while the effective balance is negative and begins increasing only after Recovery is cleared. Bank History retains truthful positive and negative contributions while its top-level Available Bank summary is never negative.

## Consumer Presentation

When `recoveryCalories > 0`, Today shows Available Bank as `0 kcal` and a nearby neutral Recovery surface such as `1,800 kcal to recover`. Supporting copy may explain that new deposits restore the bank first. Recovery must not use punitive language or red warning treatment.

Emergency Bank remains an optional deferred feature, separate from Recovery and hidden by default. Entering Recovery does not automatically reveal or recommend it. Any future interaction between Emergency Bank and the effective balance requires a separate approved policy based on beta evidence.

## Consequences

- The ledger remains mathematically truthful and append-only.
- No recurring floor, forgiveness transaction, repayment ledger, or mutable recovery balance exists.
- Seven days is an onboarding recency policy, not a physiological-reset claim.
- Missing intake or expenditure never becomes zero.
- Provider changes and corrections preserve the existing authoritative-source and immutable-delta rules.
- Current-day awareness remains outside Opening Bank and ongoing accounting.

## Superseded Guidance

Earlier V1 text that treated an unimplemented Emergency Bank as a mandatory routing layer before Recovery is not the current operational model. This ADR governs implemented V1 Opening Bank and Recovery behavior. Emergency Bank allocation, coverage, and discovery remain deferred.
