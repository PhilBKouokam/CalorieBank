# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

Follow the root `AGENTS.md`, `docs/product/v1-prd.md`, and `docs/product/bank-calculation-spec.md` product direction. Mobile V1 is connection-first automatic calorie banking; do not make manual food logging the primary mobile workflow unless the PRD changes.

Planning Database screens are for future meal and event estimates only. Do not implement them as consumed-food logs or bank-calculation inputs.

Banking Goals are governed by ADR 013. Do not add allocation screens or treat goals as separate banks until the unresolved protection, finalized-withdrawal allocation, Emergency Bank order, and correction policies are approved.

Apple Health uses a native Expo development build and cannot run in Expo Go. Keep HealthKit queries inside the mobile adapter, request only approved read types, and never write current-day awareness data to the finalized ledger.

Apple Health foreground sync follows ADR 010: query current day and the prior two local dates, upload each normalized category/date independently, skip accepted unchanged values, and retain failed uploads in the ordered local outbox. Do not expand this to full-history or background HealthKit delivery without approval.

Today follows the fixed ordering and visibility controls in ADR 008 as amended by ADR 011. Available Bank is always first and cannot be hidden. Supporting cards may be available without being visible during first use; hiding them must not disable ingestion. Workout calories are already included in active energy and must not be added again.

Do not add feature recommendations, discovery-state persistence, or default-visible optional cards without following ADR 011. Today's Forecast and Projected Daily Burn are V1 expenditure estimates for later progressive introduction, never projected bank values or ledger inputs.

Do not add proactive recommendation behavior without ADR 014's Relevance, Familiarity, and Complementarity gates and pacing policy. Manual feature discovery must not be blocked by familiarity.

Today's Eating Budget is governed by ADR 012. Do not add a numeric card or compute Remaining Today from the existing Today response until the unresolved full-day expenditure and goal-mapping policy is approved. Never present it as Available Bank or a Projected Bank.

Latest contribution and Bank History must follow ADR 009: show effective contribution, provisional or locked status, lock timing, and consumer-readable correction history. Do not imply a provisional contribution is delayed or edit ledger data from the client.
