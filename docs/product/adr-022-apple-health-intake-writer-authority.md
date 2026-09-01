# ADR 022: Apple Health Intake Writer Authority

## Status

Accepted for V1 on 2026-08-23.

## Context

Apple Health is a transport for Dietary Energy written by nutrition applications. Physical iPhone diagnostics confirmed that an unfiltered cumulative query summed 1,612.4 kcal from FatSecret and 2,354 kcal from Cronometer into 3,966.4 kcal. Raw sample sums, separate-by-source statistics, and source-filtered statistics agreed for each writer. Therefore an all-source total is not a safe authoritative intake value.

## Decision

When `apple_health` is the authoritative intake provider, exactly one underlying Dietary Energy writer is authoritative. Its stable authority key is HealthKit `source.bundleIdentifier`; `source.name` is presentation evidence only and may be generic. The selected writer is persisted per CalorieBank user. Device queries use HealthKit's source filter, and normalized daily aggregates retain only the writer bundle and a safe display name.

The provider-neutral accounting identity remains `apple_health`. Consumer surfaces show the underlying tracker name when safely known. Physically verified mappings are currently `CRONOMETER-GOLD` to Cronometer and `com.fatsecret.caloriecounter` to FatSecret. Other brands are resolved only from observed, unambiguous source metadata; bundle identifiers are never guessed.

No selected writer means no authoritative Apple Health intake. A missing or ambiguous writer never falls back to an all-writer total. Existing users with exactly one usable discovered writer may adopt it automatically. Multiple writers require selection. Direct FatSecret remains a separate provider and is never combined with Apple Health.

## Accounting Boundary

Current-day source-filtered aggregates remain awareness-only. Changed provisional dates use existing append-only reconciliation. Locked days and immutable Opening Bank calculation days are not rewritten. Legacy Apple Health aggregates without writer provenance are retained for audit but are ineligible for authority.

## Data Minimization

CalorieBank stores the selected writer bundle, safe display name, and normalized daily calories. It does not persist meals, food names, raw HealthKit samples, UUID lists, sample timestamps, arbitrary metadata, or device details.

## Consequences

- Multiple Apple Health nutrition writers are never summed for banking.
- Missing writer data is visible as unavailable instead of silently incorrect.
- Writer switching can reconcile only provisional dates under existing rules.
- Adding verified consumer aliases does not change provider or accounting architecture.
