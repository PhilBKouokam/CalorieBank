# ADR 026: Social Authorization and Privacy Boundaries

Date: 2026-09-12

## Status

Accepted future architecture; no production authorization service or schema is implemented by this decision. The [Social specification](social-system-spec.md) governs experience; [ADR 025](adr-025-caloriebank-social-foundation.md) governs scope. The [implementation plan](social-implementation-plan.md) records OPEN implementation policy.

## Context

Authenticated ownership currently protects a user's own banking data. Future cross-user access needs a single auditable policy boundary that separates discovery, profile reachability, graph eligibility, resource visibility, content and badge display. A visible button, Story ring or hidden card cannot be the security boundary.

## Decision

## Central authorization architecture

Do NOT implement Social privacy as scattered UI conditions.

There must eventually be one authoritative Social authorization/policy layer.

Exact code/module names must follow repository conventions, but conceptually it must answer questions such as:

- canAccessProfile(viewer, owner)
- canDiscoverThrough(viewer, owner, source)
- canSendConnectionRequest(viewer, owner)
- canCreatePin(viewer, owner)
- canViewResource(viewer, owner, resource)
- canViewPinRelationships(viewer, owner)
- canViewStory(viewer, story)
- canSendMoment(sender, recipient)
- other future Social policy questions

Universal principles:

A. Owner access
Owner may access their own product data regardless of Social sharing audience.

B. Social activation
Ordinary Social participation requires active Social state.

C. Block
Block is strongest interpersonal Social boundary.

D. Deny by default
If authorization cannot establish access:
DENY.

Missing policy:
DENY / Only Me semantics.

Unknown new resource:
PRIVATE until explicitly integrated.

Malformed authorization state:
must not broaden access.

E. Authorization BEFORE serialization
Never send complete protected owner data to viewer's client and hide cards in React.

Required conceptual flow:
canonical domain data
-> server authorization
-> viewer-safe representation
-> API serialization
-> client

UI hiding is presentation, NOT security.

F. Authorization BEFORE sorting/ranking
Private values cannot influence:

- Bank sorting
- Steps sorting
- rankings
- recommendations
- previews
- badges
- notification content

unless that use is independently authorized.

G. Cache safety
No cache may serve Viewer A's authorized data to Viewer B.

Revocation must not remain accessible because of stale authorization caches.

Do not prescribe an exact cache implementation without auditing current architecture.

H. Notification safety
Notifications are not authorization tokens.
Opening a notification reauthorizes destination/resource.

I. Logs/analytics
Avoid leaking sensitive Social values through:

- application logs
- analytics
- crash reporting
- error payloads
- client debugging

J. Child-resource authorization
A visible Goal/card does not imply every internal/private child field is visible.

K. Viewer-relative layout
Do not expose owner's private Home layout to viewer merely to render Shared Home.

## Blocking

Blocking is stronger than:

- Pin denial
- Connection-request denial
- sharing exception
- direct-profile grant
- discoverability
- Connection
- Pin

Blocking immediately:

- removes pending Connection requests between users
- removes existing Connection
- removes Pins in both directions
- prevents future Connection requests
- prevents future Pins
- prevents ordinary Social discovery/access
- prevents future Story/Moment interaction as applicable

Blocking offers NO grandfathering.

No:
"Keep existing Pin?"

when blocking.

Blocking is silent.
Do NOT notify blocked person.

Unblocking:

- does NOT restore old Connection
- does NOT restore Pins
- does NOT restore pending requests
- does NOT resurrect old relationship state
- users return to no active relationship, subject to current permissions

## Reachability and data access

Discovery asks whether a profile can be surfaced through a particular source. Reachability asks whether this viewer may open the profile through current discovery eligibility, an existing Connection, a durable approved direct-profile grant or a qualifying explicit positive resource share. Prior public viewing creates no permanent access. Exact names, usernames, internal IDs, URLs and notifications do not bypass policy. Contacts qualification is one-directional and requires an approved privacy-preserving protocol.

A direct profile link intentionally shared by the owner may start an idempotent, rate-limited access request before protected data is returned. Approval grants durable viewer-specific profile reachability until revoked, never a Connection, Pin or metric grant. Decline is silent. How intentional link issuance is established, and how abuse-resistant requests work without exposing a private identity, remain OPEN.

An explicit positive resource share confers limited profile reachability while at least one qualifying share remains. Revoking the final such share removes that path, unless another valid Connection, direct-profile grant, discovery path or resource grant remains. A Pin does not itself grant protected resources or substitute for a durable profile grant. Grandfathered Pin existence/counting never grandfathers data visibility; an unreachable person's identity must not leak through a retained graph record. Exact retained-row presentation remains OPEN.

For an ordinary non-owner viewer, first establish active Social state, the absence of a block and the appropriate reachability/context. Then apply resource precedence: **Block > explicit person deny > explicit person allow > base audience > default deny**. Base Everyone means otherwise legitimately reachable viewers, not all people who know an identifier. Deny beats a simultaneous allow. Missing, malformed and unknown-resource policy fails closed. Owner access to their own core product data does not depend on Social activation or audience.

Positive/negative exceptions bind to immutable internal identity, persist through Connection removal/reconnection and audience changes until explicitly removed, and affect only their resource. Explain surviving explicit shares before a relationship removal when expectations could be surprising. “Only Me + 1 person” must not be mislabeled simply “Only Me.” Request and Pin person-specific denials only restrict their global policies, never expand them.

Profile grants, resource grants, Connection eligibility, Pin eligibility, Pin graph/count visibility, badge visibility and Story audience are separate decisions. A visible derived value, composite, aggregate, goal or badge does not authorize hidden inputs, children, detailed records or activity history. Today So Far renders only authorized components under their existing policies. Lists retain true authorized active counts but omit inaccessible member names, avatars, usernames, positions and identifying metadata, using a neutral aggregate remainder rather than fake rows.

An Everyone Story is not a durable profile grant. Whether Story-only temporary reachability can exist outside an already reachable profile/context is OPEN; no implementation may infer a public-link bypass. Initial Moment recipients are selected Connections and need no extra live-profile grant.

## Changes, blocking and lifecycle

Privacy changes must be transactionally safe across affected graph state and future access. Data audience tightening takes effect immediately with no grandfathering. When a new request policy invalidates pending requests, ask Keep existing requests / Remove requests that no longer qualify only if any are affected. Pin permission tightening similarly asks Keep existing Pins / Remove Pins that no longer qualify. Kept Pins count as active but cannot be recreated after Unpin unless currently eligible. No removal event notifies the affected person.

Block denies future interpersonal access and removes Connections, Pins both ways and pending requests without any grandfather option. Unblock never resurrects relationships or pending requests. Resource/direct-profile-grant handling after unblock must be explicitly decided before implementation so dormant permissions do not silently restore surprising access. Block remains distinct from Report: either can be used independently. A report is not automatically a block.

Social deactivation stops discovery and new interactions, removes pending requests and terminates Connections/Pins silently. It must stop serving stale Social data while core banking remains available. Retention, reactivation and grant/content lifecycle policy are OPEN; hidden resurrection is prohibited. Permanent account deletion must clean or tombstone Social references under approved policy. Recycled usernames never inherit relationships, grants, denials, blocks, content access, badges or notification state.

## Delivery and operational security

Canonical data -> authoritative server policy -> viewer-safe representation -> serialization -> client. Never serialize the owner's complete `/v1/me/*` payload and hide unauthorized fields afterward. Sort only authorized Bank/Steps values; inaccessible or unavailable values sort last in either direction and cannot influence ranking metadata. Shared Home is read-only and uses viewer-relative/canonical layout, never the owner's private layout.

Cache policy must isolate viewers, account switches and policy versions and stop future protected delivery after revocation. Media delivery requires authorization before bytes/access mechanisms are issued; URLs must not become permanent privacy bypasses. Previously disclosed screenshots cannot be recalled, but that is not permission to continue serving stale protected responses. Reauthorize notification destinations and deep links. Avoid sensitive values in logs, analytics, crash reports, errors or debugging output.

All graph operations must be idempotent: one Pin per directed pair, one pending Connection request per pair, cross-requests resolve to one Connection and one relationship-established event, repeated acceptance produces one relationship, and repeated access/direct-share requests must not spam events. Concurrent privacy reconciliation and counts must remain coherent. Exact transaction/key/cache designs are OPEN rather than prescribed table names.

Policy tests should expose internal reason factors such as owner, active state, block, Connection, profile grant, deny/allow, base audience, Contacts, discovery, current eligibility and grandfathering without logging private values or showing technical traces to consumers.

## Consequences

Every read surface, list, notification, content fetch and deep link requires the same policy contract. Privacy cannot be secured by UI alone, authentication alone, badges or URL possession. Safe projection and invalidation are prerequisites for broad Social exposure. Data export/deletion planning must account for identity, graph, exceptions, grants, content, views, reactions, badges, Activity, blocks and reports without exposing other people's private data.

## Rejected alternatives

Client-only hiding; permission from exact username/link possession; badge/admin equivalence; broad public-account bypass; all-data access from Connection; access from Pin-list membership; stale shared response caches; hidden-value ranking; permanent access from a prior public view; implicit sharing inherited by new resource categories.

## Open decisions

The implementation plan records contact matching/retention, intentional link proof and abuse controls, request expiry and races, composite granularity, cache invalidation, grandfathered inaccessible-row presentation, block/unblock grants, Story-only reachability, deactivation/reactivation, account deletion and historical content access. No unresolved case may silently broaden access.
