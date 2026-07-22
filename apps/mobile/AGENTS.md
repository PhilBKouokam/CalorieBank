# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

Follow the root `AGENTS.md`, `docs/product/v1-prd.md`, and `docs/product/bank-calculation-spec.md` product direction. Mobile V1 is connection-first automatic calorie banking; do not make manual food logging the primary mobile workflow unless the PRD changes.

Planning Database screens are for future meal and event estimates only. Do not implement them as consumed-food logs or bank-calculation inputs.

Apple Health uses a native Expo development build and cannot run in Expo Go. Keep HealthKit queries inside the mobile adapter, request only approved read types, and never write current-day awareness data to the finalized ledger.

Apple Health foreground sync follows ADR 010: query current day and the prior two local dates, upload each normalized category/date independently, skip accepted unchanged values, and retain failed uploads in the ordered local outbox. Do not expand this to full-history or background HealthKit delivery without approval.

Today follows the fixed order in ADR 008. Available Bank is always first and cannot be hidden. Steps and workouts are optional visible-by-default context cards; hiding them must not disable ingestion. Workout calories are already included in active energy and must not be added again.

Latest contribution and Bank History must follow ADR 009: show effective contribution, provisional or locked status, lock timing, and consumer-readable correction history. Do not imply a provisional contribution is delayed or edit ledger data from the client.
