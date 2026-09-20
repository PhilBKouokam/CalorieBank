# Manual / estimated intake: rollout prerequisite

Product intent: CalorieBank should work for people who do not track calories.
A user's approximate daily intake is a valid future first-class input, distinct
from imported evidence, Fitness Goal and Daily Bank Target.

Manual intake remains disabled. No controls, records, source selection or estimates
are introduced by Phase 1A. Phase 1B requires separate founder authorization after
[ADR 029](./adr-029-effective-dated-intake-authority.md) and its compatibility release
are qualified on iPhone and Pixel and available through private distribution.

Future internal identity: `manual_estimate`; consumer naming and the complete
manual-intake feature contract belong to Phase 1B. A future wire response may carry
that identity, a consumer source label, daily numeric intake and the existing
local-date context. It requires neither OAuth nor a native writer. Authority-only
Health Connections uses `available`, not an external connection claim. No real
Phase 1A response emits this source or authority-only status.

An estimate must never backfill earlier dates, merge with imported calories, edit
provider evidence or mutate Available Bank during the current day. Usual estimate
and date override will be separate. Finalization remains server-owned and snapshots
the exact source/value. These future product behaviors are not implemented here.

After Phase 1A, stop. Phase 1B manual intake remains the prerequisite to the planned
Daily Eating Budget engine, followed by conservative/max required-step forecasting
and its explanation, then the Home information-density redesign. All existing
post-Android backlog items remain deferred.
