# ADR 025: CalorieBank Social Foundation

Date: 2026-09-12

## Status

Accepted as future product and architecture direction. Not implemented; not required for current V1 or the friends-and-family beta. OPEN details remain in the [implementation plan](social-implementation-plan.md).

## Context

The [V1 PRD](v1-prd.md) excludes Social from immediate scope. The founder-approved future design makes CalorieBank more useful through people and intentional sharing without turning the Bank-first product into an attention-maximizing network. The repository has provider connections, authenticated account profiles and banking read models, but no Social relationships or Social navigation. Provider connection and Social Connection are distinct concepts.

## Decision

Adopt the [Social system specification](social-system-spec.md) as future product authority. Connect establishes a mutual, personal, private relationship. Pin is one-way functional organization, independently permissioned and optionally public. Share authorizes selected canonical product resources. Story temporarily publishes to an audience. Moment directly sends a snapshot to selected Connections. Shared Home presents another user's authorized canonical Home using the viewer's familiar arrangement. Badge communicates identity, recurring activity, achievement or recognized title.

Social requires explicit activation and independent privacy choices; activation never implies data-sharing consent. New resources start Only Me. Connections never imply Pins, complete data sharing or a public graph. Pins never imply Connection or data permission. My Order is persistent user-controlled ordering; its first five entries form Social Home. Search favors legitimate identity relevance, not popularity. Private values cannot influence sorting.

Use the central policy boundary in [ADR 026](adr-026-social-authorization.md), content/event boundaries in [ADR 027](adr-027-cb-stories-and-moments.md), and badge boundary in [ADR 028](adr-028-cb-badges.md). Safety and privacy controls are never progressively gated. Optional prominence follows ADRs 011 and 014; familiarity cannot be inferred from elapsed account age or grant relationship permissions.

## Canonical boundaries

The [bank calculation specification](bank-calculation-spec.md) retains authority. Social cannot create alternate Bank/Forecast/Goal math, Projected Bank, transfers or pooled calories. Preserve the once-only `0.80` policy, immutable Opening Bank, immediate provisional completed-day posting, append-only two-day reconciliation and permanent locking. Available Bank and Recovery derive from one effective balance. Current-day awareness and forecasts do not affect finalized accounting. Snapshots preserve captured values; live sharing reflects canonical updates without broadcasting each change.

Provider-neutral ingestion under ADR 006 and its refinements remains independent of Social. Food/activity content never creates intake, workouts or expenditure. Badge qualification reads eligible canonical evidence. Sharing derived values never grants access to their raw inputs. ADR 012 Eating Budget and ADR 013 allocations remain blocked pending their own decisions; neither is approved for implementation through a Social example. Current Phase 1 Banking Goal is the limited Planned Treat rename. Existing fixed Today ordering is the Shared Home fallback, not authorization for a new layout engine.

## Consequences

A small policy-first foundation must precede public exposure. Graph, content, notification and badge processing need idempotency, race safety and viewer-safe responses. Existing `/v1/me/*` owner authorization cannot simply be reused as cross-user authorization. Future modules should follow TypeScript/domain/schema conventions without inventing a universal relationship/content framework. Social can remain unused indefinitely without affecting core CalorieBank.

## Rejected alternatives

- Followers/Following and merely renamed follower internals: Pins supply a native organizational function.
- Close Connections/Close Friends: My Order already expresses attention without inferred relationship tiers.
- Public Connection graphs/counts/mutual counts: these undermine personal meaning and privacy.
- Privacy presets or special public/private/Creator/Founder account types: independent controls avoid hidden consent coupling.
- Generic profile Likes, profile-view surveillance and algorithmic My Order: unnecessary pressure and loss of user agency.
- Feed as Social Home, comments and DMs as incremental content additions: outside current approved scope; separate future design is required.
- Badge-driven privilege or engagement grinding: identity is neither authorization nor usage scoring.

## Open decisions and next milestone

Use the [implementation plan](social-implementation-plan.md) for activation, contact protocol, privacy/cache, graph races, retention, media, badge and discovery blockers. Existing release documents still require physical beta regression certification. Continue that core work first. Later, separately authorize the smallest Social identity/activation/domain-policy foundation with privacy tests, before broad sharing, Moments, Stories or badges.
