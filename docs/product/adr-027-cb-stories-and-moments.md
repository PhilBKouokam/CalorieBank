# ADR 027: CB Stories, Moments and Social Activity

Date: 2026-09-12

## Status

Accepted future design; unimplemented. Stories and Moments are approved future Social capabilities, not current beta requirements. Media limits, retention and operational decisions remain OPEN in the [implementation plan](social-implementation-plan.md).

## Context

The [Social specification](social-system-spec.md) is people-first. Intentional publication, direct sharing and meaningful events serve different purposes. None requires a Feed, comment system or messaging platform. [ADR 026](adr-026-social-authorization.md) supplies centralized authorization; [ADR 028](adr-028-cb-badges.md) governs badge representations.

## Decision

## Social notifications and activity

Governing principle:
Notify about meaningful intentional Social actions.
Do NOT narrate every graph/privacy/data change.

Notify:

- someone Pins you
- Connection request
- Connection accepted / relationship established
- private-profile access request (owner)
- private-profile access approved (requester)
- meaningful direct positive data share
- direct Goal share
- Moment sent
- Story/Moment reaction where applicable

Examples:
"Sarah Pinned you."
"Sarah sent you a Connection request."
"You and Sarah are now connected."
"Phillip would like to view your profile."
"Sarah shared her profile with you."
"Sarah shared her Bank with you."
"Sarah shared 'Birthday Dinner' with you."
"Phillip shared a Moment with you."
"Sarah reacted 🔥 to your Story."

Silent:

- Unpin
- owner removes Pin
- Pin removed by privacy reconciliation
- Connection declined
- Connection removed
- request cancelled
- block/unblock
- profile-access denial
- explicit sharing revocation
- base sharing-audience change
- negative exception creation/removal
- ordinary profile view
- Bank value changes
- Steps changes
- Burned/Eaten changes
- automatic Goal changes
- automatic milestones
- Social deactivation

General audience changes NEVER mass-notify affected users.

Direct intentional positive sharing MAY notify when effective authorization transitions from denied to allowed.

Do not notify merely because a database row was inserted if viewer already had effective access.

High-volume Pins:

- aggregate notifications
- do not punish creators/public profiles with thousands of pushes

Pin/unpin cycles:

- notification dedupe/rate limiting

Notification event != push delivery.

Model meaningful event first.
Delivery may be:

- in-app Activity
- push
- aggregated
- suppressed according to preferences

Social has lightweight:
Activity

Activity is NOT a Feed.

Activity may contain:

- Connection requests
- Pin events
- direct shares
- Moments
- reactions
- other meaningful Social events

Use restrained unread indicators.

Do not gamify unread count.

Notification preferences:
start simple.
Possible:

- Morning Bank Update
- Social

Granular Social controls may appear later if needed.

Turning off Social push:

- does NOT delete requests/events
- in-app state remains

Sensitive notification previews:

- avoid unnecessarily exposing health/Bank values on lock screen
- e.g. "Phillip shared a Moment with you" is preferable to exposing private Moment content

## Profile views

Ordinary authorized profile views:

- NO notification
- NO profile-view history
- NO "who viewed me"
- NO active-now
- NO last-seen

A user may check a brother's profile five times per day without generating five notifications.

Direct-link access request is NOT a profile-view notification.
It exists because authorization approval is required before viewing.

No profile-view count for normal users.

Future aggregate creator analytics remain a separate future capability and must not silently resurrect named profile-view surveillance.

## Moments

Moments remain approved even with CB Stories because they solve a different problem.

Canonical distinction:
STORY = temporarily publish to an audience
MOMENT = directly send to selected Connections

Internal Moments are Connections-only initially.

Do NOT add:
Who can send me Moments? Everyone/Connections/Nobody

at this stage.

Moment:

- explicit
- user-created
- snapshot
- direct
- one or multiple selected Connections
- does not create group conversation
- does not create messaging system

One Moment sent to Mom, Cedric, Sarah:

- separate recipient interactions
- not a group thread

Moments may originate contextually from legitimate CalorieBank product objects:

- Bank
- Goal
- future appropriate objects

Do not create giant "Create Post" flow in Social Home.

Moment is immutable snapshot of state intentionally shared at creation time.

If Bank was 10,240 when shared:

- Moment remains 10,240
- tomorrow's Bank does not rewrite Moment

Moment access != live resource access.

Sharing a Bank Moment does not grant ongoing Bank visibility.

Later tightening live profile-sharing settings does not retroactively rewrite a deliberately sent historical Moment.

Sender may remove an internal Moment from CalorieBank, but do not falsely promise deletion of screenshots/saved copies.

External sharing:

- may use OS/platform share mechanisms
- may generate polished CalorieBank-branded card
- once exported, CalorieBank cannot revoke external copy
- first-use education may note recipients can save/reshare

Moment may support:

- short optional caption
- lightweight reaction

No:

- comments initially
- DM thread
- read receipts
- public reaction count

Moment notification:
"Phillip shared a Moment with you."

Avoid exposing sensitive Moment value in push preview by default.

Rate limit/duplicate suppress abuse.

Blocking prevents future Moment delivery.

## Cb stories

CB Stories are approved.

They are NOT a Feed.

Stories integrate into existing people rows through avatar rings.

Do NOT require a separate primary Stories page.

Social Home remains:
Pinned
Connections
Discover

If a person has at least one active Story authorized for viewer:

- show recognizable Story ring around their existing avatar

Do not hard-code product documentation to "red" ring unless current design system deliberately selects that token.
Requirement is recognizable Story-state treatment.

If viewer is not authorized for any active Story:

- show normal avatar
- do not leak Story existence

Tap behavior:

- avatar with active authorized Story -> Story
- row/name -> Shared Home
- avatar without active Story -> Shared Home

Story types may include:

- photo
- video
- short caption
- approved CalorieBank product snapshot

Examples:

- meals
- workouts
- physique/progress
- activities
- what user spent/broke Bank on
- Banking Goal snapshot
- Bank snapshot

Stories expire after 24 hours initially.

Do NOT build Highlights initially.

Story audience:

- Everyone
- Connections
- Specific People

Negative exceptions such as:
Hide Story From

may use central authorization model.

No Close Friends.
No Close Connections.

Story audience is chosen deliberately and does not inherit unrelated Bank/Steps visibility automatically.

Pin status does NOT grant Story access.

Connection status only matters where Story audience says Connections.

Public creator may publish Everyone Story.

Stories do NOT reorder My Order.

Stories do NOT move people upward because they posted.

My Order remains authoritative.

Multiple Stories:

- authorization evaluated per Story
- viewer sees only authorized sequence
- do not reveal missing/private Story slots

Story ordering for one user:

- oldest unseen first is a candidate; exact per-user sequence policy remains OPEN
- after seen, Story state may become subdued
- new Story restores unseen state

Story authors may see who viewed each Story while active.

Story viewer list:

- no per-view push notification
- no general profile-view history created
- this is Story-specific consumption state

Story reactions:

- lightweight/private
- author may be notified
- no public reaction counts initially

No Story replies initially because replies effectively create DMs.

No comments initially.

No screenshot notification initially.

Do not promise screenshot prevention.

Story deletion:

- author can delete
- no notification to viewers

Stories may embed product snapshots.
Snapshot does NOT grant live-resource access.

Stories NEVER modify:

- intake
- expenditure
- Bank ledger
- Available Bank
- Banking Goal allocations
- Emergency Bank
- any other accounting/product source of truth

A Story caption such as:
"Spent 4,000 of my Bank on this"

is Social content.
It is NOT a ledger instruction.

Story reporting/blocking/moderation:

- basic Report Story capability must exist when Stories are implemented
- Block integration must exist
- media/content moderation must be intentionally designed
- do not treat Stories as merely "upload an image"

Story implementation must account for:

- media storage
- retention/expiration
- deletion
- authorization
- reporting
- blocking
- abuse/spam
- inappropriate content
- impersonation
- moderation
- privacy
- secure delivery

Stories require a separately authorized implementation milestone.

## Stories filter for pins

When the user has enough Pins and enough active authorized Stories for filtering to become useful, See All Pins may progressively expose:

All | Stories

Stories filter:

- starts from My Order
- includes only users with at least one active Story authorized for viewer
- preserves relative My Order
- does NOT reorder by:
  - newest Story
  - Story count
  - reactions
  - popularity
  - engagement

Example:

My Order:
1. Mom       Story yes
2. Brother   Story no
3. Cedric    Story yes
4. Sarah     Story no
5. Creator   Story yes

Stories:
1. Mom
2. Cedric
3. Creator

If a person has active Stories but none are authorized for viewer:

- treat exactly as no active Story
- do not expose their existence

Do not expose this filter before it solves a real organizational problem.

## Reactions and current social mechanics

Current CalorieBank Social is relationship-first, not engagement-first.

Shared Home has NO:

- generic Likes
- comments
- public engagement counts
- profile-view counts
- active-now indicators
- last-seen
- read receipts
- public Connection counts
- public Connection lists
- global health leaderboards
- social streak competition

Pins are already the scalable Social signal.
Do not add generic profile Likes.

Lightweight reactions may exist on:

- Stories
- Moments

Possible small reaction set:

- heart
- fire
- applause
- laugh

Exact emoji set is a UI decision, not a product invariant.

Reactions:

- are private sender/author-recipient/viewer interactions
- do not create public engagement counts
- do not create group threads
- may generate restrained notification to Story/Moment author
- reaction changes/removal are silent
- high-volume reaction notifications may aggregate

Reactions MUST NOT influence:

- My Order
- Pin ranking
- sharing permissions
- authorization
- Discover ranking merely because they exist
- Story ranking
- profile ranking

Comments:

- NOT part of current Social implementation

Direct messaging:

- NOT part of current Social implementation

Story replies:

- NOT part of current implementation because they effectively create messaging

Moment replies:

- NOT part of current implementation

Read receipts:

- NOT part of current implementation

If conversation/messaging is ever introduced later:

- design it explicitly as its own product capability
- do not accidentally create a messaging platform through incremental Moment/Story features

## User-generated content safety boundary

Profiles, Stories, Moments, captions, photos, videos, badges, and future user-generated Social content introduce moderation/safety responsibilities.

When these capabilities are eventually implemented, account for:

- reporting
- blocking
- spam
- harassment
- impersonation
- inappropriate content
- media safety
- retention
- deletion
- privacy
- abuse prevention
- secure media access
- authorization
- rate limiting

Fitness/food/physique content deserves careful safety treatment.

Do not create product mechanics that explicitly reward:

- extreme restriction
- dangerous over-exercise
- lowest intake
- highest burn
- lowest weight
- unhealthy body comparison

Badge definitions must also be reviewed so they do not incentivize unsafe behavior.

For example:
Step/activity badges should represent meaningful activity patterns, but exact qualification rules require future product/safety review rather than arbitrary ever-higher activity escalation.

Do NOT create:
"100K Step Maxxer"
or similar escalation merely because bigger numbers seem more engaging.

## Privacy-preserving story/content delivery

Story/media authorization must be enforced before protected media/content is delivered.

Do not rely on:

- hidden UI
- obscured Story ring
- client-only checks

If viewer loses Story authorization:

- subsequent fetch/access must fail safely
- stale client/cache behavior must not preserve indefinite protected access

Story viewer records:

- visible to Story author according to approved behavior
- do not create general profile-view tracking
- should be scoped to the Story
- retention beyond Story lifetime remains an implementation/product decision unless existing policy defines it

Story media URLs/access mechanisms:

- must not become permanent privacy bypasses
- exact storage/signed URL architecture remains implementation-specific

Media implementation requires a separately authorized milestone.

## Notification / graph scale

Design future implementation for scale without changing semantics.

Popular/founder/creator profiles may have:

- many Pins
- many Story viewers
- many reactions

Scale must not cause:

- thousands of individual push notifications
- authorization shortcuts
- incorrect Pin counts
- privacy leakage
- unstable My Order

Pin counts must remain accurate under concurrent Pin/unpin operations.

Connection requests must remain unique/race-safe.

Cross-request -> Connection behavior must remain deterministic.

Story viewer/reaction counts/state must tolerate concurrency.

Exact infrastructure is implementation-specific; the repository audit establishes existing boundaries but does not approve Social infrastructure.

## Navigation and state preservation

Preserve user context where practical.

Examples:

Social
-> See All Pins
-> temporary Bank sort
-> Sarah profile
-> Back

should ideally return to:
See All Pins with previous temporary state intact.

Social
-> Sarah
-> shared Goal detail
-> Back

should return:
Sarah
then Social

Do not constantly reset user to top of Social after every deeper navigation.

Deep links:

- navigation only
- authorization always re-evaluated

If access disappears while screen is open:

- next authorized fetch/navigation should transition gracefully to unavailable/private state
- do not crash
- do not keep serving stale protected data

## Snapshot, recipient and viewer boundaries

Snapshot product cards capture approved canonical representation and semantic labels at creation, including freshness/estimate qualifications needed to avoid misleading claims. They never expose hidden dependencies or grant ongoing resource access. A Moment showing Available Bank 10,240 kcal remains 10,240 when live Bank becomes 8,000. A Goal-ready Story also remains a snapshot. Live-share objects would need separate product design. Current canonical feature blockers still apply; a sample Goal card does not implement allocations.

A Moment sent to Mom, Cedric and Sarah creates independent recipient interactions. Recipients must not learn who else received it or see their reactions. Sending requires Connection; future delivery after blocking is denied. Access to retained Moments after Connection removal or deactivation, and precise deletion/retention behavior, require explicit lifecycle policy before implementation. Live audience tightening alone does not rewrite intentionally sent historical content.

Story author viewer lists are private to that author while the Story is active. No public viewer list/count, per-view push, general profile-view log or Moment read receipt follows. Seen/unseen state exists only for Story progression and authorized rings. Historical viewer handling after a block and retention after expiration remain OPEN. A hidden Story behaves like no Story: no ring, sequence gap, filter inclusion or hidden-count hint.

Story posting itself does not broadcast pushes to Connections/Pinners or populate Activity with every new Story. Activity does not list every Bank, Step, workout or Goal change. No endless Story recommendation chain, engagement ranking, auto-play at app launch or redirection away from core Bank is approved. Reactions are private; changes/removals are silent and never affect ranking or permissions.

## Media and safety boundary

Secure storage/delivery, expiry, deletion, abuse controls, moderation, reporting and Block support are prerequisites for Stories, not follow-up polish. Review photo/video metadata for GPS, device identifiers and unintended capture information; strip or safely handle it under an explicitly approved policy. Precise location, routes, medical records, diagnoses and unrelated provider data are not default Social objects. Optional coarse profile location or deliberate Story location tags require their own design.

Block and Report are independent actions. Fitness/food/physique moderation must consider harassment, impersonation, unsafe restriction, dangerous exercise and body comparison. Stories/Moments do not log food or activity, estimate calories from captions, allocate goals, transfer calories or mutate accounting. Do not shame Bank spending, Recovery, rest days or normal calorie flexibility.

Compatible later card formats include intentionally shared Bank, Steps, Goal and badge snapshots. A badge Moment still goes only to selected Connections; earning a badge never automatically publishes a Story, sends a Moment or alerts the graph. External cards use deliberate OS/platform sharing and cannot be revoked once exported; do not promise screenshot prevention or screenshot notifications.

## Consequences

Events must be modeled independently from push delivery, with authorization, aggregation, deduplication, preferences and restrained previews. Existing Morning Bank Update delivery is not a generic Social event bus. Owner-authenticated product data cannot be exposed through content without intentional snapshot consent and audience checks. Secure media and privacy lifecycle design precede upload implementation.

## Rejected alternatives

Moment as a private Story; group threads from multi-recipient sends; Story/Moment replies or comments that accidentally create DMs; public reactions; Moment read receipts; named profile-view surveillance; automatic broadcasts of posting or data changes; Stories as a disguised Feed; permanent media URL authorization; content as accounting evidence.

## Boundaries and open decisions

Stories expire after 24 hours initially; exact photo/video duration/size, retention and media delivery mechanics are unresolved. Moment retention/deletion, access after relationship changes, Story-only reachability, historical viewer records after blocking, moderation operations, reaction set, content creation affordance and badge notification behavior must be settled for their respective milestones. Highlights, creator analytics, Feed and conversation systems remain deferred.
