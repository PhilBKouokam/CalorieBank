# Social Implementation Plan and Open Decisions

Date: 2026-09-12

## Status and scope

This is a future implementation contract derived from the [Social specification](social-system-spec.md) and ADRs [025](adr-025-caloriebank-social-foundation.md), [026](adr-026-social-authorization.md), [027](adr-027-cb-stories-and-moments.md) and [028](adr-028-cb-badges.md). It does not authorize production implementation now. The [architecture audit](../architecture/social-design-audit.md) records observed prerequisites and release gaps.

APPROVED denotes decided behavior, OPEN denotes a decision required before dependent implementation, and DEFERRED denotes a capability excluded from the current Social scope. Do not treat all OPEN items as blockers for the earliest isolated policy work, or treat product approval as proof of implementation readiness.

## Immediate recommendation

Continue current core friends-and-family stabilization and physical release certification. PB.1/PB.2 completion and automated results do not replace the outstanding physical release gates. Social must not block core connection-first onboarding, authoritative data synchronization, Opening Bank, completed-day accounting, Today, History or Morning Bank Update.

Once core readiness is established and a Social milestone is explicitly authorized, start with immutable identity, Social activation and central policy design plus privacy tests. Decide foundation-specific open policies before public exposure. Do not begin with Stories, badges or all Social at once.

## Open decisions

The repository audit found no approved Social implementation policy resolving the decisions below.

The following decisions remain OPEN:

SOCIAL ACTIVATION

- exact activation screen sequence
- exact default suggested values, if any, for discovery/request/Pin permissions
- username uniqueness/change/reservation rules
- profile-photo/media rules
- bio/link constraints

CONTACT DISCOVERY

- exact privacy-preserving contact-matching protocol
- identifier normalization
- retention/deletion
- contact permission refresh behavior

EXTERNAL SOCIAL DISCOVERY

- whether official Instagram/other APIs actually support useful graph discovery at implementation time
- exact permissions
- platform review requirements
- fallback behavior

PINS

- notification cooldown/deduplication windows
- large-list pagination
- manual ordering persistence implementation
- concurrent reorder semantics

CONNECTIONS

- decline cooldown duration
- repeated-request suppression thresholds
- exact cancellation/acceptance race semantics beyond approved product behavior

SHARING

- exact resource granularity for advanced Home cards
- exact UI for positive/negative exceptions
- exact handling of nested/composite resources
- authorization-aware caching implementation

DIRECT PROFILE ACCESS

- request expiry
- grant management UX
- revocation UX
- rate limits

STORIES

- exact media limits
- photo/video duration/size
- Story retention after expiry
- Story-view record retention
- exact reaction set
- content moderation implementation
- upload/storage/CDN/security architecture
- exact Story creation affordance
- whether author can archive own Stories later
- whether Highlights ever become useful

MOMENTS

- exact internal retention
- deletion semantics
- external card formats
- exact reaction set

BADGES

- exact badge catalog
- 10K Step Maxxer qualification
- 20K Step Maxxer qualification
- Runner qualification
- Boxer qualification
- Soccer Player qualification
- Basketball Player qualification
- Cyclist/Biker qualification
- Hiker qualification
- Athlete qualification
- required history window
- confidence thresholds
- eligible provider/manual data
- badge expiration for activity-identity badges
- badge revocation process
- official badge visibility
- Featured Badge UI
- badge naming/copy
- badge safety review

PROGRESSIVE DISCOVERY

- exact familiarity signals
- exact relevance thresholds
- suppression/dismissal behavior
- state persistence
- recommendation frequency
- cross-device state

SOCIAL DEACTIVATION

- retention
- deletion
- reactivation semantics
- legal/privacy implications

These decisions block dependent production behavior, not the approved product invariants.

## Additional explicit policy blockers

| Area | OPEN decision and blocked behavior |
| --- | --- |
| Direct links | How owner-intent/link issuance is proven; safe request initiation without leaking a private identity; request dedupe/expiry/abuse handling. Links cannot be permission tokens. |
| Pins | Presentation of retained/grandfathered Pins whose owner is no longer reachable; they still count, but retained graph state cannot leak identity or metrics. |
| Unblock | Whether explicit resource/direct-profile grants are removed or require deliberate restoration; no hidden access resurrection. |
| Stories | Whether Everyone Stories require existing profile/context reachability or allow separately authorized temporary Story-only reachability; public deep links cannot silently bypass profile privacy. |
| Historical content | Story-view records after blocking/expiry; retained Moment access after Connection removal, blocking or Social deactivation; account deletion and recipient references. Block always denies future interaction. |
| Consent and identity | Badge display audience/granularity and qualification-to-private-collection mechanics; new shareable data remains Only Me by default. Official visibility versus Featured Badge priority; photo/name/bio exposure per context; username recycling protections. |
| Social lifecycle | Grant, exception, media, reaction and event retention/export/deletion; reactivation requires explicit policy and never restores old relationships secretly. |
| Canonical Home | Future viewer layout storage and composite/child resource policy; use existing canonical order until layout is independently approved. No Social-only implementation of unresolved Eating Budget or allocations. |
| Badges | Qualification versus award versus user confirmation, private collection, owner notification/push/Activity behavior, quiet expiration and formal revocation communication; provider taxonomy may not support proposed activity names. |
| Safety operations | Reporting/moderation workflows and response responsibility, metadata stripping, secure media revocation and retention, health/body-image policy, spam and abuse controls. |
| External discovery | Desired future integration only. Verify current official APIs, graph availability, permissions, app review and data-use restrictions at implementation time; no scraping, browser automation or passwords. |

Highlights remain DEFERRED even though deciding whether they ever solve a useful problem is open. Author-only Story archive is not currently approved. Creator analytics, business/restaurant/professional capabilities, Feed, comments, DMs, CB Games and paid discovery all need separate future decisions.

## Implementation sequencing

Do NOT imply the entire Social system should be built immediately.

Current product priority remains getting core CalorieBank into users' hands.

Document a future implementation sequence that preserves lowest-risk incremental delivery.

The proposed dependency sequence is:

FOUNDATION

- Social domain model
- central authorization policy
- Social activation state
- profile identity/privacy
- security/privacy tests

DISCOVERY

- Search
- Contacts if privacy architecture is ready
- Connection requests

CORE GRAPH

- Connections
- Pins
- My Order
- Social Home
- See All Pins

SHARING FOUNDATION

- base sharing tiers
- positive/negative person-specific exceptions
- limited profile reachability from explicit sharing
- Shared Home
- viewer-relative Home arrangement
- server-enforced field/resource authorization

SOCIAL EXPERIENCE

- Activity
- Social notification events
- notification aggregation
- Pin relationship-list visibility
- profile identity/bio/badges surfaces

MOMENTS

- direct Connection-to-Connection Moment sharing
- snapshot semantics
- Activity integration
- lightweight reactions

STORIES

- media architecture
- Story audience authorization
- Story rings
- Story viewer state
- Story reactions
- Stories Pin filter
- moderation/reporting/storage/retention

BADGES

- badge definition/award architecture
- official identity badges
- achievement badges
- competitive/title badges
- activity-identity badges
- badge provenance
- badge display/Featured Badge
- integrity/revocation

EXTERNAL DISCOVERY

- only after official API capabilities are verified
- Instagram or other supported social sources where legitimate
- never block core Social on external-platform access

FUTURE / EVIDENCE-DRIVEN

- creator analytics
- business/restaurant capabilities
- professional/coach capabilities
- Feed
- comments
- DMs
- Highlights
- other engagement/content systems

This is conceptual sequencing, NOT an instruction to implement these milestones now.

The dedicated Social architecture audit records prerequisites and dependencies between these stages.

Security/privacy architecture should precede broad Social data exposure.

Do not build Stories before:

- Social identity exists
- authorization exists
- blocking/reporting foundations exist
- media privacy/storage strategy exists

Do not build advanced badges before:

- canonical eligible data sources are defined
- qualification rules are approved
- badge integrity/revocation model exists

## Dependency gates

Foundation includes immutable identity, separate active Social state, block/report access, profile reachability versus resource policy, deny-by-default safe projection, request/Pin denials and positive/negative sharing exceptions in the architecture. Do not postpone these policy concepts until after exposing data. A later sharing milestone implements their consumer flows and authorized read models.

Search/graph milestones need approved eligibility, contact protocol if used, idempotency/concurrency, permission reconciliation and count/order consistency. Meaningful event recording and safety must accompany the first notifying graph operation even if a richer Activity surface is delivered later. Never ship graph actions that depend on nonexistent privacy controls.

Stories require identity, authorization, blocking/reporting and approved secure media/retention/moderation design before uploads. Advanced badges require canonical eligible evidence, approved quantitative rules, integrity/re-evaluation and revocation before awards. External discovery never blocks Search or the core graph. Existing Morning Bank Update infrastructure requires a separate suitability review for Social delivery; it does not make this milestone already implemented.

## Testing requirements for future implementation

This documentation task does not add production tests.

Future Social implementation MUST include the following test categories.

AUTHORIZATION MATRIX TESTS

Test combinations across:

- Social active/inactive
- blocked/unblocked
- discoverability Everyone/Contacts/Nobody
- Connection/non-Connection
- direct-profile grant/no grant
- explicit positive resource grant
- explicit negative resource grant
- base audience Only Me/Connections/Everyone
- Pin permission Everyone/Connections/Nobody
- Connection-request permission Everyone/Contacts/Nobody

Verify precedence:
Block
> Explicit Deny
> Explicit Allow
> Base Audience
> Default Deny

Verify owner always accesses own product data.

PROFILE ACCESS TESTS

Verify:

- exact username does not bypass privacy
- direct URLs do not bypass privacy
- existing Connection preserves legitimate profile reachability
- approved direct-profile grant works
- explicit positive data share creates limited profile reachability
- revoking final qualifying grant removes that limited reachability
- ordinary historical profile view creates no permanent access

CONNECTION TESTS

Verify:

- duplicate request idempotency
- simultaneous cross-request -> one Connection
- cancellation race safety
- acceptance race safety
- decline cooldown behavior
- person-specific request denial
- privacy tightening reconciliation
- Connection removal silence
- no public Connection count/list leakage

PIN TESTS

Verify:

- Pin uniqueness/idempotency
- Pin notification once
- Unpin silence
- Pin removal silence
- grandfathering
- grandfathered Pin cannot be recreated after Unpin if user no longer qualifies
- individual Pin denial
- blocking removes Pins without grandfathering
- concurrent Pin/unpin count integrity

PIN ORDER TESTS

Verify:

- initial oldest-first order
- new Pin appended
- manual reorder persists
- Social Home positions 1-5 follow My Order
- metric sort does not mutate My Order
- private/unavailable values always sort last
- hidden values never influence sorting
- Stories filter preserves relative My Order

SHARING TESTS

Verify:

- Only Me + explicit allow
- Connections + explicit deny
- Everyone + explicit deny
- explicit deny beats explicit allow
- block beats all
- grants/denials survive unrelated Connection changes
- new resource defaults private
- changing one permission does not mutate unrelated permissions
- derived-resource sharing does not expose calculation inputs

SHARED HOME TESTS

Verify:

- viewer receives only authorized resources
- unauthorized data is absent from serialized response
- viewer-relative ordering
- owner's private Home arrangement is not exposed
- Shared Home is read-only
- "hasn't shared anything with you yet" state
- current/finalized semantics remain correct

PIN RELATIONSHIP-LIST TESTS

Verify:

- shared count remains true active count
- private identities are not leaked
- neutral private-account remainder count is correct
- existing viewer-specific access may reveal an otherwise non-public identity
- graph visibility never exposes metrics

NOTIFICATION TESTS

Verify:

- notify events
- silent events
- aggregation
- duplicate suppression
- Pin/unpin cycling protection
- direct-share notification only on meaningful effective new access
- notification does not grant authorization
- stale notification destination reauthorizes

STORY TESTS

Verify:

- Story ring only when viewer has authorized active Story
- unauthorized Story existence is not leaked
- per-Story audience
- multiple Story authorization
- 24-hour expiration
- deletion
- viewer tracking
- no profile-view-history contamination
- no per-view notification
- reaction privacy
- Story filter
- blocking
- reporting
- media authorization
- stale access revocation

MOMENT TESTS

Verify:

- Connections-only internal delivery
- multiple recipients do not create group
- snapshot immutability
- Moment access does not grant live-resource access
- deletion
- blocking
- reaction privacy
- no read receipts

BADGE TESTS

Verify:

- badge ownership uses immutable user ID
- official badge cannot be self-awarded
- qualification engine uses eligible authoritative data
- badge visibility does not expose underlying private data
- hidden badge stays hidden
- Featured Badge behavior
- revocation
- no authorization effect
- no ranking effect merely from badge existence

CACHE / SERIALIZATION SECURITY TESTS

Verify:

- Viewer A response cannot leak to Viewer B
- revoked access invalidates future protected responses
- unauthorized fields never reach client payload
- hidden values never leak through sorting/ranking metadata

## Additional future verification requirements

Test deactivation stops future delivery while core banking continues; account switching and recycled usernames never inherit access; explicit grants survive ordinary Connection changes with accurate disclosure; unblock does not silently restore relationships/access; reporting is independent of blocking. Verify snapshots retain original canonical values without live-resource grants and without exposing other recipients. Test media metadata privacy, expired/deleted media, grant revocation during pagination, concurrent reorder, notification aggregation and safe unavailable states.

Verify badge evaluation is repeat-safe, hidden badges reveal no underlying history, corrections trigger approved re-evaluation, and badge display cannot change policy, calculations or My Order. Test Everyone Story reachability only after the OPEN contract is decided. Numeric badge/familiarity tests must use subsequently approved rules rather than fabricate thresholds now.

Future consumer UI requires the PRD copy and visual release gates: narrow screens, accessible text, touch targets, navigation/back context, alignment, spacing, hierarchy, clipping/overflow, loading/error/empty states and private-data absence. This documentation task does not create production tests or claim rendered UI verification.

## Acceptance journeys

| Journey | Required outcome |
| --- | --- |
| Empty activation | Search, optional Contacts and Discover; no large empty graph sections; no data sharing required. |
| Private activation | Nobody discovery/requests/Pins and Only Me data is valid; core CalorieBank works indefinitely without Social. |
| Creator | Everyone discovery, Nobody requests, Everyone Pins; viewer Pins without Connection and sees only deliberately shared data. No special account type. |
| Family | Accepted request establishes one mutual Connection and notifies requester; neither side auto-Pins or exposes other Connections. |
| Direct share | Sarah is undiscoverable and Bank Only Me; explicit Bank share with Phillip permits limited profile reachability and Bank only. |
| Denial precedence | John denied Bank remains denied after Bank audience expands to Everyone or after reconnecting. |
| Remove Connection | Warn that directly shared Bank/Steps survive where applicable; do not silently revoke or conceal surviving grants. |
| Privacy tightening | Ask about affected existing Pins/requests only; kept Pins cannot be recreated after Unpin under incompatible policy. Data tightening is immediate. |
| Block | Remove Connection, both Pins and pending requests; no grandfathering or notification; unblock restores none. |
| My Order | Oldest first initially, new Pins append; manual order persists, Home shows first five, temporary metric sort never saves over order. |
| Metric privacy | Private/unavailable Bank/Steps shows — and sorts last both ways; no hidden-value ordering. Home never substitutes another metric. |
| Shared Pin list | True count with accessible identities and one neutral private remainder; no fake rows, private positions or metric access. |
| Shared Home | Viewer/canonical order, authorized cards only, read-only; neutral empty profile and no owner-layout disclosure. |
| Stories | Authorized ring opens Story, name opens Profile; author may see viewer but no per-view push; expiry after 24 hours. |
| Stories filter | Removes people lacking authorized active Stories while preserving My Order; private Story indistinguishable from none. |
| Moment | Send 10,240-kcal snapshot independently to Mom and Brother; live Bank later 8,000 does not rewrite it or reveal co-recipients; no read receipts/replies. |
| Badges | Founder explains Phillip-Bryan Kouokam's identity; Runner needs approved recurring evidence; CB Champion needs official result. None grants permissions. |
| Badge plus Story | Runner may complement a running Story, but the Story earns no badge and neither grants activity history or affects accounting. |
| Mature Social | Hundreds of Pins, content, badges and exceptions still lead to a simple people dashboard; deeper tools remain one tap away. |
| Notification opening | Reauthorize current destination; stale notification cannot reveal revoked resources. Audience changes do not mass-notify. |

## Product learning

Measure useful relationship formation, discovery success, privacy comprehension, intentional sharing, dismissal and abuse rates. Evaluate whether Social makes CalorieBank more useful and understandable. Do not optimize for maximum minutes, Story consumption, Connection accumulation, Pin count, notification opens or compulsive return. Feature familiarity is capability-specific, never a global score or relationship classifier.
