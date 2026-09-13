# CalorieBank Social System Specification

Date: 2026-09-12

## Status and authority

**APPROVED future product direction; not implemented and not a current V1 or friends-and-family beta requirement.** “Current Social” below means the approved future Social design, never a claim that the application ships these features today. Product approval is distinct from implementation readiness. No production schema, migration, API, UI, media service, notification system, integration, or dependency is authorized by this documentation update.

The [V1 PRD](v1-prd.md) owns current product scope and beta priority. This specification owns the approved future Social experience. The focused decisions are [ADR 025: foundation](adr-025-caloriebank-social-foundation.md), [ADR 026: authorization](adr-026-social-authorization.md), [ADR 027: Stories, Moments and Activity](adr-027-cb-stories-and-moments.md), and [ADR 028: badges](adr-028-cb-badges.md). They give independent architectural authority to their decisions and must remain consistent with this specification.

The [bank calculation specification](bank-calculation-spec.md) and applicable canonical product ADRs retain exclusive authority over Bank, Forecast, Goal, provider, initialization, correction, and Recovery semantics. Social may authorize a representation of those values; it cannot override their calculation contracts. The [Social implementation plan](social-implementation-plan.md) collects readiness, OPEN decisions, sequencing and required tests. The [Social architecture audit](../architecture/social-design-audit.md) records implementation evidence, not product authority. AGENTS.md supplies derived implementation guardrails; README files provide navigation. Neither outranks product specifications or ADRs.

**Status vocabulary:** APPROVED means decided product behavior, OPEN means unresolved behavior or implementation policy, and DEFERRED means excluded from the approved current Social implementation scope. OPEN items block their dependent implementation, not publication of the approved design. Features mentioned as potentially shareable do not become approved canonical features merely by appearing here.

## Reading map

- This specification: constitution, activation, discovery, graph behavior, My Order, people dashboard, sharing, Shared Home and progressive discovery.
- ADR 025: why these primitives, current beta boundary, canonical calculation preservation, rejected alternatives.
- ADR 026: profile reachability versus individual data visibility, policy precedence, blocking, serialization, caching, identity and lifecycle.
- ADR 027: meaningful events and silence, Activity, direct Moments, temporary Stories, media and moderation.
- ADR 028: identity/activity/achievement/title badges, trustworthy evidence, user display control, no authorization privilege.
- Implementation plan: exhaustive open-decision register, dependencies, acceptance journeys and future test categories.

## Product constitution

CalorieBank Social exists to help people keep up with the people they care about and share the life happening around their Bank without turning CalorieBank into an attention-maximizing social network.

CalorieBank remains Bank-first.

Connections are mutual, personal, and private.
Pins are one-way, functional, scalable, and optionally public.

Users choose who matters through My Order.
Algorithms do not reorder their relationships for engagement.

Privacy is composable.
Social activation does not imply data-sharing consent.
New shareable data starts private.
Users directly choose who may discover them, Connect with them, Pin them, and see individual parts of their CalorieBank.

Shared Home presents canonical CalorieBank information under viewer-specific authorization.
Sharing changes who can see product truth; it does not create another product truth.

Stories temporarily publish to an audience.
Moments directly send to selected Connections.
Neither controls calorie accounting.

Badges communicate meaningful identity, recurring activity, achievement, or recognized title.
Badges never create special account authorization.

Social should teach itself through natural consequence and progressively reveal complexity when familiarity and relevance make it useful.

Privacy, safety, and user agency are never gated.

Silence around rejection and privacy actions is deliberate.

CalorieBank does not optimize Social for maximum session time, maximum Connections, or compulsive consumption.

A future Feed must earn its existence.

Complexity belongs underneath.
Simplicity belongs in front.

Every future Social feature must justify the complexity it adds.

## Governing social philosophy

CalorieBank remains Bank-first.

Social exists to make the core CalorieBank experience more human, useful, expressive, and connected. It must not transform CalorieBank into an attention-maximizing social network.

Current Social is PEOPLE-FIRST rather than CONTENT-FIRST.

The user chooses who matters. Algorithms do not reorder the user's social priorities.

Core primitives:

CONNECT

- Establish a mutual relationship with someone the user knows.

PIN

- Keep someone the user wants to keep up with at the top of Social.

SHARE

- Choose what parts of CalorieBank other people can see.

STORY

- Temporarily publish something to an audience.

MOMENT

- Directly send something from CalorieBank to selected Connections.

SHARED HOME

- Internal/product term for the viewer-authorized representation of another user's CalorieBank Home.

BADGE

- A meaningful identity, characteristic, activity identity, achievement, or recognized title associated with a user.

Do NOT introduce:

- Followers
- Following
- Friends as a formal relationship state
- Close Connections
- Close Friends
- generic public/private account modes
- Creator privacy modes
- Founder privacy modes

Connection and Pin MUST remain distinct.

Connections are:

- mutual
- personal
- private
- intended for people the user actually knows
- not public social proof

Pins are:

- one-way
- functional
- optionally public
- scalable
- CalorieBank's native alternative to a follower relationship

No public Connection count.
No public Connection list.
No mutual-Connection count initially.
One user's Connections must not expose that user's other Connections.

Pins may have optionally visible incoming/outgoing counts and lists.

Privacy is composable, not categorical.

Complexity belongs underneath.
Simplicity belongs in front of the user.

Progressive discovery reduces cognitive load but NEVER gates:

- Block
- Report
- privacy changes
- Stop Sharing
- Remove Connection
- Remove Pin
- Story deletion
- Social deactivation
- other fundamental safety/user-control actions

Behavior may inform feature readiness.
Behavior MUST NOT automatically:

- classify human relationships
- grant permissions
- create Connections
- create Pins
- create sharing exceptions

Social never forks product truth.

No Social-specific Bank calculation.
No Social-specific Forecast calculation.
No alternative Goal math.
Shared values use canonical CalorieBank semantics.

Stories, Moments, captions, reactions, badges, and other Social content NEVER modify ledger/accounting truth.

Sharing means another user may view authorized information.
It does NOT subscribe that viewer to automatic monitoring of every data change.

Silence around rejection/privacy actions is intentional.

Avoid mechanics that manufacture:

- social anxiety
- reciprocal obligation
- compulsive checking
- unhealthy competition
- global health-metric status competition

Engagement/session time is NOT Social's objective function.

A future Feed is NOT prohibited, but it is NOT currently approved or required.
A Feed must solve a demonstrated CalorieBank problem that Pins, Shared Home, Stories, Moments, and Discover do not already solve.
Do not allow a Feed to emerge accidentally through incremental engagement features.

Every future Social feature must justify its complexity.
If Connect, Pin, Share, Story, Moment, Shared Home, or an existing primitive already solves the problem simply, do not introduce another concept.

## Social activation

A normal CalorieBank account is NOT automatically a Social account.

Social requires explicit activation.

Before activation:

- user does not participate in Social discovery
- user is not exposed through Social contact matching
- user cannot receive ordinary Social Connection requests
- user cannot be Pinned
- Social sharing is inactive

First Social entry should briefly explain value.

Conceptual copy:
"Keep up with the people you care about on CalorieBank.
Connect with people you know.
Pin the people you want to keep up with."

Actions:

- Get Started
- Maybe Later

Maybe Later must be respected.

Activation must remain extremely short.

Identity setup:

- optional profile picture
- existing display/real name can be used
- optional username
- short bio may exist as profile functionality, but do not turn activation into a profile-building wizard

Explicit activation privacy questions:

A. Who can discover you?

- Everyone
- Contacts
- Nobody

B. Who can send you Connection requests?

- Everyone
- Contacts
- Nobody

C. Who can Pin you?

- Everyone
- Connections
- Nobody

When asking about an unfamiliar concept, teach it contextually.

For Pin:

- show a tiny visual example of a Pinned row
- explain that Pinning keeps someone near the top of another person's Social page
- explain that the user will know when someone Pins them

Initial data-sharing concepts:

- Available Bank
- Steps

All shareable data defaults to Only Me.
The user may continue without sharing either.

Do NOT ask about all advanced sharing fields during activation.

## Discoverability and discovery

Discoverability:

- Everyone
- Contacts
- Nobody

Everyone:

- eligible Social users may discover the profile.

Contacts:

- one-direction contact qualification is sufficient.
- If Viewer has Sarah in Viewer's contacts and Sarah allows Contacts discovery, Viewer may qualify.
- Do NOT require Sarah to also have Viewer in Sarah's contacts.
- exact implementation must be privacy-conscious.

Nobody:

- no ordinary Social discovery.

Exact username/name/internal identifier knowledge MUST NOT bypass discoverability.

If Sarah chooses Contacts and a stranger knows @sarah exactly:

- stranger cannot find Sarah unless another valid access relationship exists.

If Sarah chooses Nobody:

- she does not appear through ordinary search, Contacts discovery, Discover recommendations, or exact-username lookup.

Discovery is initially source-driven, not algorithm-driven:

- Search
- optional Contacts
- optionally supported external social platforms later

Do not build opaque engagement-driven "People You May Know" as a requirement.

Contact discovery:

- explain value before OS permission
- Contacts permission is optional
- denial does not cripple Social
- do not repeatedly nag
- Search remains available
- only Social-activated accounts eligible under the relevant privacy rules may appear
- do not expose accounts merely because a phone number exists in CalorieBank
- use privacy-preserving matching architecture
- do not naïvely store/upload entire address books as Social data
- no automatic Connections
- no automatic Pins

External social discovery:

- Instagram is a desired example because creator-led acquisition may be important.
- BUT implementation depends entirely on official platform APIs, permissions, terms, and actually available graph data at implementation time.
- Never scrape Instagram.
- Never ask for social-platform passwords.
- Never fabricate unsupported follower/following/favorite-creator access.
- External social relationships are discovery inputs only.
- They never automatically create Connections, Pins, sharing permissions, or relationship labels.
- External Close Friends must NOT become a CalorieBank Close Connection concept.
- Social must remain fully usable without external social integrations.

Direct profile links:

- a direct URL/link is navigation, not authorization.
- if viewer already has access, open normally.
- if owner is otherwise private to viewer but intentionally shared a direct profile link, opening it creates an ACCESS REQUEST before protected profile data is delivered.
- owner receives a notification such as "Phillip would like to view your profile."
- owner may approve/decline.
- approval creates a durable viewer-specific profile-access grant until revoked.
- it does NOT create Connection or Pin.
- denial produces no rejection notification.
- requests must be idempotent/rate-limited.
- repeated refreshes cannot spam owner notifications.

Merely viewing/discovering someone while they are public does NOT create permanent access.
If they later tighten discovery and viewer has no durable relationship/grant, ordinary access ends.

## Connections

Connection:

- mutual
- explicitly approved
- intended for someone the user knows
- private relationship graph

Connection-request permission:

- Everyone
- Contacts
- Nobody

Public discoverability does NOT imply public Connection requests.

Valid example:
Discover me: Everyone
Connection requests: Contacts
Pin me: Everyone

Another valid creator example:
Discover me: Everyone
Connection requests: Nobody
Pin me: Everyone

Request lifecycle:

- sender taps Connect
- recipient receives request notification
- recipient Accepts or Declines
- Accept creates mutual Connection
- Accept/establishment notifies requester
- Decline is silent
- sender may cancel pending request silently
- Connection removal is silent

Requests must be:

- unique/idempotent per user pair
- duplicate-safe
- notification-deduplicated
- race-safe

If A has a pending request to B and B independently sends a request to A:

- treat this as mutual intent
- establish Connection immediately
- do not create two redundant requests
- generate one clean relationship-established event

Declined requests:

- temporary re-request cooldown
- repeated declines may progressively suppress repeated requests
- exact cooldown thresholds remain implementation/policy decisions unless existing docs already define them

Person-specific request denial:

- user may prevent a specific account from sending future Connection requests without blocking them
- this restricts global policy
- it does not expand global policy
- it persists until explicitly removed

Existing Connections survive:

- discoverability tightening
- new-Connection-request policy tightening

unless explicitly removed or blocked.

If global request permissions tighten while incompatible requests are pending:

- ask whether to Keep existing requests or Remove requests that no longer qualify
- if none are affected, do not ask
- removal is silent

Connections:

- never automatically create Pins
- never automatically expose all data
- never become public count/list
- never reveal other Connections

## Pins

Pin:

- one-way
- independent from Connection
- puts someone near the top of the pinner's Social experience
- acts as CalorieBank's scalable social signal

A public creator may be Pinned without Connection.

Pin permission:

- Everyone
- Connections
- Nobody

Person-specific Pin denial:

- user may prevent a specific account from Pinning them without blocking them
- current Pin may be removed
- denial persists until explicitly removed
- denial overrides global Pin eligibility
- it does not remove unrelated access/Connection unless separately requested

Pin creation:

- recipient is notified
- Pin is unique per pinner/pinned-user pair
- idempotent

Unpin:

- NO notification

Owner removing another person's Pin:

- NO notification

Pin removed because of privacy reconciliation:

- NO notification

Pin/unpin cycling:

- cannot create notification spam
- dedupe/rate-limit/cooldown as appropriate

Incoming Pin count:

- true active incoming Pin count

Outgoing Pin count:

- true active outgoing Pin count

Profile terminology:
Pinned By 18    Pins 10

NOT:
18 Pinned You
Followers
Following

Incoming and outgoing Pin counts/lists may be shared independently through the ordinary sharing/privacy model.

If a Pin list is visible:

- show the true shared count consistently
- evaluate each listed person's identity privacy separately
- identities the viewer can legitimately access appear normally
- identities whose privacy prevents exposure are not individually shown
- show neutral aggregate copy:
  "5 people on this list are private accounts."

- do NOT say viewer lacks permission
- do NOT render fake "Private Account" rows

Graph-list visibility never grants access to listed users' CalorieBank metrics.

Existing Connection or explicit profile access may make an otherwise non-discoverable account visible to that viewer.

Pin permission tightening:
Example Everyone -> Connections.

If existing Pins no longer qualify, ask:

- Keep existing Pins
- Remove Pins that no longer qualify

Keep:

- existing incompatible Pins are grandfathered
- still count as active Pins
- do not bypass new sharing rules
- if grandfathered user later Unpins, grandfathering ends
- they cannot recreate Pin unless currently eligible

Remove:

- incompatible Pins removed
- count updates
- no removal notification

Same reconciliation applies to other privacy transitions that make existing Pins newly ineligible.

Blocking is an exception:

- blocking NEVER offers grandfathering.

## Pin ordering and see all pins

Social Home shows at most 5 Pins.

If <=5:

- show all
- no See All required

If >5:

- show first five
- show See All Pins

Initial My Order:

- oldest Pin first / Pin creation order
- new Pins append to end

Do NOT use:

- random order
- algorithmic engagement order
- popularity order
- Story recency order

Users may manually reorder their full Pin collection.

Manual order is persistent and called:
"My Order"

Social Home always shows positions 1-5 of My Order.

Do not create a separate Home-only ordering model.

See All Pins:

- complete Pin collection
- Search Pins
- My Order
- temporary sorting

Initial sort options:

- My Order
- Bank highest -> lowest
- Bank lowest -> highest
- Steps highest -> lowest
- Steps lowest -> highest

Do NOT initially include Burned/Eaten in Social/Pin-list sorting.
Those belong inside Shared Home if shared.

Sorting:

- never overwrites My Order
- returning to My Order restores saved order
- unavailable/private metric values display em dash (—)
- unavailable values always sort to bottom regardless of ascending/descending direction
- private values MUST NOT secretly influence ranking

Authorization must happen BEFORE sorting.

Story filter:

- See All Pins may progressively expose an All / Stories filter when enough Pins/active authorized Stories make it useful
- Stories filter takes My Order and removes users without an active Story authorized for the viewer
- preserve relative My Order
- never sort by Story recency/popularity
- a Story hidden from viewer must behave exactly like no Story

## Social home

Social is a PEOPLE DASHBOARD, not a Feed.

Persistent search at top.

Primary hierarchy:
1. Pinned
2. Connections
3. Discover

Close Connections do NOT exist.

Empty sections are omitted.

A person appears only once:

- if Pinned, they appear under Pinned rather than duplicated under Connections
- Unpinning a Connection returns them to Connections

Compact row:

- circular profile picture
- name or username
- current Social metric
- Pin/unpin affordance where appropriate

Initial Social metric:
Available Bank only.

After sufficient familiarity:

- reveal small global metric switch
- options ONLY:
  - Bank
  - Steps

Changing metric changes the entire Social Home lens.

If selected metric is unavailable/private for a person:

- keep person in exact list position
- show —
- do not hide/reorder/fallback to another metric

Social Home must not expand to Burned/Eaten/etc. Keep deeper CalorieBank information inside the person's Shared Home.

Social Home is not:

- a Feed
- an Activity stream
- a leaderboard
- a profile-view surface
- an engagement-ranking surface

## Sharing tiers and direct privacy controls

There are NO privacy presets.

Do NOT create:

- Private preset
- Connections preset
- Public preset
- Creator preset
- account-level privacy modes that silently rewrite several independent permissions

Every meaningful privacy dimension is controlled directly.

Data-sharing audiences:

- Only Me
- Connections
- Everyone

"Everyone" means everyone who is otherwise legitimately able to reach/access the profile.
It does NOT override:

- discoverability
- blocks
- other profile-access rules

Sharing is configured per legitimate shareable CalorieBank object/metric.

All shareable data defaults to:
Only Me

Changing one privacy setting changes only:

- that permission
- direct reconciliation consequences necessarily caused by that permission

It must NOT silently change unrelated permissions.

New future shareable data categories:

- default to Only Me
- do not inherit old consent merely because other data is public

There is no master "Public Account" or "Private Account" authorization mode.

"Private account" may still be used as neutral user-facing descriptive copy where appropriate, such as:
"5 people on this list are private accounts."

That phrase does NOT create a formal account type.

## Shareable data and shared home

Social Home itself remains deliberately narrow:

- Bank
- Steps

For anything deeper:

- tap the person's profile

Another person's Social profile is fundamentally:
a viewer-authorized representation of that person's CalorieBank Home.

Do NOT build a generic Instagram-style statistics profile separate from CalorieBank.

Core principle:
"The data belongs to the profile owner; the presentation belongs to the viewer."

Shared Home:

- uses canonical CalorieBank product concepts
- uses canonical calculations
- uses canonical terminology
- uses canonical semantics
- is filtered by viewer authorization
- is read-only

If owner has rearranged their own Home:

- do NOT expose owner's private arrangement to viewer

Instead:

- arrange owner's authorized shared data using VIEWER'S own Home arrangement
- if viewer has no custom arrangement, use canonical/default Home ordering

Example:
Frank's private Home order:
Goal
Bank
Today
Forecast

John's Home order:
Bank
Today
Goal
Forecast

When John views Frank:
Bank
Today
Goal
Forecast

subject to what Frank actually shares with John.

Unauthorized cards:

- omit entirely from Shared Home
- do NOT render walls of locked cards

Exception:

- stable Social Home people rows retain the person and display — for unavailable Bank/Steps, as defined above

If owner shares nothing with viewer:
show restrained identity shell and neutral copy:

"Sarah hasn't shared anything with you yet."

Do NOT say:

- "Sarah hasn't shared any CalorieBank data with you"
- "You don't have permission"
- "Sarah denied you access"

Profile identity header may include:

- profile photo
- display name
- optional username
- short optional bio
- optional restrained link(s) later if useful
- optional broad/non-precise location later if deliberately implemented
- approved badges
- Pinned By / Pins counts if owner shares them

Keep profile CalorieBank-centric.

Shared Home may eventually expose any legitimate CalorieBank Home information the owner deliberately chooses to share, including examples such as:

- Available Bank
- Steps
- Calories Burned
- Calories Eaten
- Emergency Bank
- desired deficit
- Today's Eating Budget
- Today's Forecast / Projected Daily Burn
- Banking Goals
- other legitimate future Home objects

Do NOT arbitrarily forbid the owner from sharing a legitimate CalorieBank product concept merely because it is sensitive.
Instead:

- default private
- explicit user choice
- centralized authorization

However:

- raw provider/infrastructure records are NOT Social objects
- device IDs are not Social
- ingestion metadata is not Social
- backend/provider plumbing is not Social

Sharing a derived value does NOT grant access to its calculation inputs.

Sharing an aggregate does NOT grant access to its underlying detailed records.

Examples:

- sharing Bank does not automatically share Eaten, Burned, deficit, or ledger
- sharing Calories Eaten does not automatically expose individual food diary records
- sharing Steps does not expose GPS/location/activity routes
- sharing Projected Daily Burn does not expose every forecast input
- sharing a Step badge does not expose Step history

Today So Far:

- should be treated as a composite
- do not create contradictory independent authorization if its components already have sharing policies
- render only authorized component data

Banking Goals:

- may have per-goal sharing because different goals can reasonably have different audiences

Forecasts/estimates:

- retain confidence/uncertainty semantics when shared
- sharing cannot elevate uncertain information into authoritative information
- if owner cannot legitimately see a forecast due to confidence/data gates, Social cannot expose it

Available Bank:

- always means authoritative finalized ledger-backed Bank
- no Projected Bank is created for Social

Shared values preserve meaningful freshness/staleness context required for honest interpretation.

Shared Home must never allow viewer to:

- edit owner's Goal
- move owner's calories
- change owner's privacy
- change owner's Bank
- change owner's settings
- modify owner data

unless a future explicitly designed collaborative feature grants such capability.

## Positive and negative individual sharing exceptions

Support positive AND negative person-specific sharing exceptions from the initial Social authorization architecture.

Every shareable resource has:
BASE AUDIENCE:

- Only Me
- Connections
- Everyone

Optional specific-person overrides:

- Also share with
- Don't share with

Effective authorization precedence:

1. BLOCK
   -> DENY

2. EXPLICIT PERSON DENY
   -> DENY

3. EXPLICIT PERSON ALLOW
   -> ALLOW

4. BASE AUDIENCE
   -> ALLOW or DENY

5. DEFAULT
   -> DENY

Example:
Bank:
Only Me

Also share with:
Mom

=> Mom can see Bank even though base audience is Only Me.

Example:
Bank:
Connections

Don't share with:
John

=> all otherwise-authorized Connections except John can see Bank.

Explicit deny beats explicit allow.

Block beats everything.

Positive exceptions:

- do NOT create Connection
- do NOT create Pin
- do NOT make owner globally discoverable
- do NOT grant access to unrelated data

Negative exceptions:

- do NOT require blocking
- persist until explicitly removed

Explicit grants/denials persist through:

- Connection removal
- reconnection
- base-audience broadening
- base-audience narrowing

unless explicitly removed.

Example:
Bank = Connections
John explicitly denied

Owner changes Bank = Everyone
John remains denied.

Example:
Bank = Only Me
Mom explicitly allowed

Mom disconnects from owner
Mom remains explicitly allowed unless grant is revoked.

When a relationship change could create a surprising access outcome:

- explain surviving explicit access before confirmation
- do not silently revoke explicit grants
- do not silently preserve them without context where user would reasonably expect access to change

Example:
"Remove Mom as a Connection?
Mom will still have access to:

- Available Bank
- Steps
because you've shared those directly with her."

The ordinary privacy UI remains simple.
Do not expose ACL terminology.

User-facing:
Who can see this?
Only Me
Connections
Everyone

Specific people >

Inside:
Also share with
Don't share with

Whenever positive exceptions exist:

- UI must indicate them
- do not misleadingly show simply "Only Me" while silently allowing people

Possible concise representation:
"Only Me + 1 person"

Exceptions bind to immutable internal user identity, not username.

Username changes must not affect authorization.

A future user receiving a recycled username must never inherit previous user's:

- grants
- denials
- Pins
- Connections
- direct-access grants
- other relationship state

## Limited profile reachability from explicit sharing

If owner explicitly shares at least one data resource with a person who otherwise cannot discover/reach owner:

- that explicit positive share creates LIMITED PROFILE REACHABILITY for that recipient for as long as at least one qualifying explicit share exists

Example:
Sarah:
Discoverability = Nobody
Bank = Only Me
Also share Bank with Phillip

Phillip:

- may reach Sarah's Shared Home
- may see Bank
- may not see unrelated fields
- does not become Connection
- does not automatically gain Pin eligibility
- does not make Sarah globally discoverable

If the final explicit share providing this reachability is revoked, and viewer has no:

- Connection
- explicit direct-profile grant
- ordinary discoverability eligibility
- other explicit data grant

then limited profile reachability ends.

Direct-profile access grant remains separate:

- grants profile reachability
- does not itself grant individual data visibility

## Search / discover ranking

Initial Search/Discover should prioritize:

- identity relevance
- exact legitimate matches
- authorized discoverability

Do NOT initially rank primarily by:

- Pin count
- reactions
- Story engagement
- popularity
- screen time
- creator engagement

Avoid self-reinforcing:
more Pins -> higher ranking -> more Pins -> higher ranking

Do NOT implement paid profile boosting/promoted people in initial Social.

If ads/promoted discovery are ever introduced:

- separate future business/product decision
- must not silently corrupt organic Social relationship semantics

## Social deactivation

Social is opt-in and should be independently leaveable from core CalorieBank.

User may deactivate Social without deleting their entire CalorieBank account.

Deactivation must:

- stop ordinary Social discovery
- stop new Social interaction
- prevent stale Social data from continuing to be served
- handle active relationships safely

Approved relationship teardown on deactivation:

- pending requests disappear
- Connections terminate
- Pins terminate
- no relationship termination notifications

However, exact retention/reactivation semantics should be reviewed carefully against:

- privacy expectations
- legal/data-retention requirements
- implementation architecture

Do NOT invent hidden resurrection of old Social relationships on reactivation.

Retention and reactivation remain OPEN; no existing implemented Social lifecycle was found.

## User-facing privacy language

Backend/internal terminology may use:

- authorization
- deny
- grant
- scope
- policy
- exception

User-facing copy should generally describe neutral state rather than interpersonal rejection.

Approved examples:

"Sarah hasn't shared anything with you yet."

"5 people on this list are private accounts."

"This profile isn't available."

Avoid:
"You don't have permission to see Sarah."

"Sarah denied you access."

"Sarah has hidden this from you."

unless a specific future workflow genuinely requires such explicit wording.

Privacy should feel like:
the other person chose their privacy

not:
the viewer personally failed an authorization test.

## Terminology — canonical vocabulary

Use one canonical term per concept.

Feature:
Social

Mutual relationship:
Connection
Connect
Connected
Connection Request

One-way attention:
Pin
Pinned
Unpin

Incoming Pin profile label:
Pinned By

Outgoing Pin profile label:
Pins

Persistent user-controlled Pin ordering:
My Order

Finding new people:
Discover

Direct discovery action:
Search

Privacy question:
Who can discover you?

Connection privacy question:
Who can send you Connection requests?

Pin privacy question:
Who can Pin you?

Data-sharing question:
Who can see this?

Positive person-specific sharing:
Also share with

Negative person-specific sharing:
Don't share with

Story-specific negative audience control:
Hide Story From

Another user's viewer-authorized CalorieBank:
Shared Home
NOTE: "Shared Home" is primarily an internal/product-spec term.
The user simply experiences the other person's Profile/CalorieBank.

Social identity surface:
Profile

Temporary audience-based content:
CB Stories / Story

Direct Connection-to-Connection share:
Moment

Social event surface:
Activity

Lightweight Story/Moment response:
Reaction

Do NOT use as formal CalorieBank relationship concepts:

- Friend
- Follower
- Following
- Close Friend
- Close Connection

Do NOT implement follower/friend concepts internally and merely rename them in UI.
The domain model should reflect the actual product concepts.

Inbound/discovery audience terminology:

- Everyone
- Contacts
- Nobody

Data-sharing audience terminology:

- Everyone
- Connections
- Only Me

Story audience terminology:

- Everyone
- Connections
- Specific People

Profile Pin labels MUST use:
Pinned By 18    Pins 10

NOT:
18 Pinned You
Followers
Following

Core user mental model:

CONNECT
Establish a mutual relationship with someone you know.

PIN
Keep someone you want to keep up with at the top of Social.

SHARE
Choose what parts of your CalorieBank other people can see.

STORY
Temporarily publish what you're doing to an audience.

MOMENT
Directly send something from your CalorieBank to selected Connections.

## Information architecture

Approved future Social IA:

Bottom navigation:
Social

Social header:

- Social title
- lightweight Activity affordance/bell where appropriate

Social Home:

- Search
- Pinned
- Connections
- Discover

Do not mix Activity events into the people dashboard.

Do not create Feed as current Social Home.

First Social activation:

- intro
- identity
- discovery consent
- Connection-request consent
- Pin consent
- foundational Bank/Steps sharing

After activation and before relationships:

- Search
- optional Contacts
- Discover

As graph grows:

- Pinned appears when Pins exist
- Connections appears when Connections exist
- See All Pins appears when >5 Pins
- See All Connections may appear when list size warrants it
- Activity becomes salient when meaningful events exist

Connections management:

- owner-only
- searchable when useful
- pending Connection requests accessible
- no public Connection count/list

Pins management:

- See All Pins
- Search Pins
- My Order
- Bank/Steps sorting
- Stories filter when relevant

Profile:

- restrained identity header
- authorized Pin counts/lists where shared
- badges
- viewer-authorized Shared Home
- appropriate relationship actions

Settings:
Profile/account area -> Social & Privacy

Social & Privacy may contain direct controls for:

- Who can discover me?
- Who can send Connection requests?
- Who can Pin me?
- Bank sharing
- Steps sharing
- deeper shareable Home objects
- individual exceptions
- blocked accounts
- Can't Pin Me
- Can't Send Requests
- direct-profile access grants
- Story privacy where appropriate
- Social deactivation

Progressively disclose advanced management.
Do not force all controls into initial activation.

## Profile actions

Profile header must clearly communicate whose CalorieBank is being viewed.

Depending on current state/authorization, primary actions may include:

- Connect
- Pin
- Connected
- Pinned

Do not crowd header with many management actions.

Use contextual overflow for actions such as:

- Unpin
- Remove Connection
- manage relevant sharing/access
- prevent person from Pinning
- prevent Connection requests
- Block
- Report

Exact UI layout remains a design implementation detail.

Shared Home is read-only.

Normal profile viewing does NOT notify owner.

## Progressive social discovery

All proactive introductions must satisfy ADR 014’s Relevance, Familiarity and Complementarity gates; the conceptual stages below are not levels or mandatory progression. Safety controls are never gated.

Social complexity is revealed according to:

- familiarity
- relevance
- demonstrated need

NOT:

- arbitrary account age alone
- engagement maximization
- fixed global "Social Level"

There is no:
Level 1 Social
Level 2 Social
Level 3 Social

Readiness is capability-specific.

Conceptual progression:

STAGE 0:
Social inactive.
User may use CalorieBank indefinitely without Social.

STAGE 1:
Explicit Social activation.
Teach only:

- identity
- discovery
- Connection
- Pin
- foundational Bank/Steps sharing

STAGE 2:
Find first people.

- Search
- optional Contacts
- future supported external social discovery

STAGE 3:
First Connection.
Connections section appears naturally.

STAGE 4:
First Pin.
Pinned section appears naturally.

STAGE 5:
Repeated meaningful Social usage.
Bank -> Steps lens may become progressively introduced.

STAGE 6:
Pin count exceeds five.
See All Pins becomes naturally necessary.

STAGE 7:
Larger Pin collection.
Search/sort/manual organization become useful.

STAGE 8:
Stories.
Story consumption discovered primarily through avatar rings.
Do not require giant Story tutorial.

STAGE 9:
Enough Pins/active Stories.
Stories-only Pin filter may become useful.

STAGE 10:
Deeper Home sharing.
Advanced sharing discovered contextually from actual Home objects.

STAGE 11:
Individual exceptions.
Expose when user enters advanced sharing/person management.

STAGE 12:
Moments.
Discovered through shareable product objects or by receiving one.

STAGE 13:
Reactions.
Learned contextually inside Story/Moment.

STAGE 14:
Activity.
Becomes salient when meaningful Social events exist.

STAGE 15:
Incoming Pin management.
Discovered naturally from Pinned By / person management.

STAGE 16:
Optional external social-platform discovery.
Introduced contextually, never mandatory.

Badges:

- may appear when genuinely earned/assigned/derived
- do not need a giant badge tutorial
- first meaningful badge can explain the badge system contextually
- badge collection/featured badge controls can become discoverable once user actually has badges

Familiarity and relevance are separate.

For proactive introduction, generally ask:
1. Is user familiar enough?
2. Is feature relevant now?

Both should pass unless the feature is inherently required by current state.

Do not introduce multiple unrelated features rapidly.

Natural paired workflows are okay.
Example:
6th Pin -> See All Pins -> sorting available there

Unrelated:
6th Pin -> suddenly introduce Moments
NOT appropriate.

Manual discoverability:

- advanced functionality may remain manually accessible where safe
- progressive discovery primarily governs prominence, proactive education, default visibility

Safety/privacy controls are NEVER gated by familiarity.

## Social home + stories must not hijack core caloriebank

Even if Stories become popular:

- do not auto-play Stories on app open
- do not redirect app launch to Stories
- do not move Social ahead of core Bank experience merely to increase engagement
- do not algorithmically reorder people because they posted
- do not send engagement-maximizing Story notifications merely to bring user back unless separately and deliberately approved later

Opening CalorieBank should continue serving CalorieBank's core purpose.

Stories enrich Social.
Stories do not become the product's center of gravity.

## Future feed — deferred, not prohibited

A future CalorieBank Feed remains possible.

Potential future concept:

- people voluntarily post what they spent their Bank on
- meals
- workouts
- physique/progress
- fitness content
- lifestyle around calorie flexibility

But current Social does NOT require a Feed.

Stories may satisfy much of the expression need without infinite-scroll content.

Feed infrastructure is outside this approved implementation scope.

Feed is not committed V1/V2 scope; it requires a separate future product decision.

Record:
Feed requires separate future product design covering at minimum:

- audience model
- content permanence
- ranking/recommendations
- moderation
- body-image/health safety
- comments
- Likes/reactions
- creators
- ads
- reporting
- spam
- privacy
- discovery
- content retention

A Feed must earn its existence by solving a demonstrated problem not already solved by:

- Pins
- Shared Home
- Stories
- Moments
- Discover

## Public / founder / creator profiles

Do NOT create a separate privacy/relationship architecture for:

- founder
- creator
- influencer
- celebrity
- athlete
- coach
- public figure

Public reach is configuration, not an account species.

Valid public creator configuration:
Discoverability = Everyone
Connection requests = Nobody
Pin me = Everyone
Bank = Everyone
Steps = Everyone

Another creator may choose different data-sharing settings.

Founder:
uses same Social authorization as everyone else.

Founder badge:
identity/provenance only.

No founder backdoor.

No:
if user.isFounder -> canViewPrivateData

No:
creator -> bypass connection/pin/privacy rules

Verification, if added later:

- trust/identity capability
- NOT authorization

Creator analytics, if added later:

- separate capability
- prefer aggregate analytics
- do not silently introduce named profile-view surveillance

Professional/coach tooling, if added later:

- separate capability based on actual product need
- do not create account class merely to express privacy

Future business/restaurant profiles:

- may eventually require different product capabilities
- current architecture should not unnecessarily make them impossible
- do NOT implement them now

## No global health competition

Do NOT create global leaderboards for:

- Available Bank
- Steps
- Calories Burned
- Calories Eaten
- deficit
- weight
- body measurements
- other health-related metrics

Private sorting inside a user's own selected Pin collection:

- allowed
- not equivalent to public leaderboard

Do not generalize:
"Sort my Pins by Bank"

into:
"Top Banks on CalorieBank."

Avoid turning health behavior into global status competition without a separate deliberate future product decision and safety review.

## Analytics / product learning principles

Future Social analytics should answer whether Social is useful and understandable, not merely whether it increases screen time.

Potential meaningful metrics:

- Social activation completion
- activation abandonment
- Search success
- Contacts discovery opt-in
- first Connection success
- first Pin
- time to first useful Social relationship
- number of users who return to Social because they have meaningful people there
- Shared Home usage
- privacy-control comprehension
- Story creation/viewing where relevant
- Moment sending where relevant
- percentage of users needing individual exceptions
- feature-discovery acceptance/dismissal
- abuse/report/block rates

Avoid optimizing primarily for:

- maximum Stories watched
- maximum minutes in Social
- maximum number of Connections
- maximum notifications opened
- maximum Pins accumulated
- compulsive daily Social opens

Pin count may be a legitimate graph/product metric, but do not automatically make maximizing it the system objective.

Connection count should NOT become a growth KPI that pressures the product to weaken Connection meaning.

For Progressive Social Discovery:
measure value/comprehension, not just engagement.

## Privacy and product invariants

The following invariants govern future implementation:

1. A CalorieBank account is not automatically a Social account.
2. Social activation requires explicit consent.
3. Social activation is not consent to share CalorieBank data.
4. New shareable data defaults to Only Me.
5. Connection and Pin are different primitives.
6. Connections are mutual and private.
7. Pins are one-way and optionally public.
8. Followers do not exist.
9. Close Connections do not exist.
10. Exact username/direct URL does not bypass privacy.
11. Connection-request permission is independent from discovery and Pin permission.
12. Sharing permission is independent from graph relationship except where audience explicitly uses Connections.
13. Block overrides all Social permissions.
14. Positive/negative individual exceptions are explicit.
15. Explicit positive data sharing may create limited profile reachability but not Connection/Pin.
16. Available Bank remains finalized and ledger-backed.
17. Social never creates Projected Bank.
18. Social never creates alternate product calculations.
19. Shared Home is viewer-authorized and read-only.
20. Shared Home uses viewer's familiar Home arrangement, not owner's private arrangement.
21. Unauthorized fields are not delivered to viewer's client.
22. Private values do not influence sorting.
23. Social Home is Bank-first and only later Bank/Steps.
24. Social Home does not expand into a statistics dashboard.
25. My Order is user-controlled and never engagement-ranked.
26. Stories do not reorder people.
27. Story existence is not leaked to unauthorized viewers.
28. Stories and Moments never modify accounting truth.
29. Story = audience publication; Moment = direct Connection share.
30. Ordinary profile views are silent and untracked as named view history.
31. Connection graph is private.
32. Pin graph may be optionally shared.
33. Shared Pin counts are true counts; hidden member identities remain private.
34. Privacy/rejection actions are generally silent.
35. Engagement/session time is not the objective function.
36. No global health-metric leaderboards.
37. Badges do not grant authorization.
38. Founder badge does not create a special account.
39. Activity-identity badges describe sufficiently demonstrated user behavior, not interpersonal relationships.
40. A future Feed is deferred and must earn its existence.
41. Safety/privacy controls are never familiarity-gated.
42. If authorization is uncertain, deny by default.
43. Every future Social feature must justify the complexity it adds.

## Canonical product compatibility

“Finalized” includes approved provisional completed-day postings; it does not mean waiting until permanent locking. Live Shared Home reflects canonical append-only corrections; Story/Moment snapshots retain the state deliberately captured at creation. Available Bank uses the canonical non-negative presentation of effective balance, including immutable Opening Bank provenance and later ledger entries; Recovery derives from that same effective balance. An uncalculated Bank stays unavailable, not fabricated zero. The all-time Bank does not expire.

CalorieBank applies its versioned `0.80` expenditure policy once in canonical calculation. Social consumes the result, never recomputes or double-adjusts it. Current-day Steps, intake and expenditure remain awareness; forecasts preserve confidence, uncertainty, freshness and all approved gates. There is no Social Bank formula, Projected Bank, peer-to-peer calorie transfer, calorie gift, shared pool, or withdrawal from another user's Bank. Banking metaphors imply neither cash nor transferable financial assets.

ADR 006 and refinements 016–018 and 022 retain provider-neutral normalization and exactly one authoritative source per role/date, including exact Apple Health intake-writer authority. Social does not collect raw provider records, sum competing sources, create workouts from content, infer consumed food from photos, or become a mandatory food logger. Planning Database estimates stay separate from consumed intake. Any future link between a post and logging requires separate approval and duplicate-prevention design.

Today's Eating Budget remains blocked on ADR 012's approved methodology. Sharing examples do not resolve that methodology. Multi-goal allocation remains blocked on ADR 013's protection, withdrawal, Emergency Bank ordering and correction policies; future goal allocations plus Unassigned must equal Available Bank. The currently implemented singular **Banking Goal** is the Phase 1 rename of Planned Treat, not that allocation system. Emergency Bank and Recovery Forecast references preserve their canonical approval status and open decisions; this spec creates neither a reserve nor a second Recovery account.

Shared Home's viewer-relative ordering is future behavior. Current Today has fixed canonical ordering plus visibility preferences; no custom-layout engine was found. Until a legitimate viewer arrangement exists, use canonical ordering. This future contract does not authorize redesigning Today or the presentation-locked Step Planning cards.

## Consent, safety and simplicity

Separate consent is required for Social activation, discovery, Connection requests, Pins, each data resource, direct sharing exceptions, Story publication, Moment sending, badge display, Contacts and external platforms. No choice implies any other. Do not preselect broad sharing, hide Nobody/Only Me, visually punish private choices, nag after Maybe Later, force Contacts/external accounts, or hide Social deactivation.

Block, Report, privacy changes, Stop Sharing, removal of Connections/Pins, Story deletion, grant revocation, badge display controls and Social deactivation remain reachable regardless of familiarity. Reversibility controls future access; it cannot erase another person's memory, screenshots or exported copies. No fake levels, streak gates, artificial scarcity or unlock requirements are permitted. Progressive discovery follows all three ADR 014 gates: Relevance, Familiarity and Complementarity, with independent system confidence where applicable. Numbered discovery stages above are conceptual examples, not levels, a mandatory sequence or quantitative readiness rules.

Keep the mature Social Home sparse: Search, Pinned, Connections, Discover; advanced organization, settings, Activity, content and badges live one tap deeper. Empty sections are omitted. After activation with no relationships, show Search, optional Find from Contacts and Discover rather than a wall of empty Pinned/Connections sections. Approved visual requirements include circular avatars, simple rows, a recognizable authorized Story ring, Pin affordances and a later Bank/Steps lens; exact colors, fonts, spacing, icons, animations and modal treatments remain design work under the PRD's copy and visual QA gates.

Do not shame spending Bank, Recovery, rest days, lower activity, large meals or changing goals. No global health leaderboard, lowest-intake contest, highest-burn status, public badge score or unsafe activity escalation is approved. Social should help people check on people they care about and express life around calorie flexibility. Growth may follow useful Pins, intentional external cards, Stories and Moments; no artificial viral obligation is required.

Every addition must identify its user problem, explain why existing primitives cannot solve it, evaluate complexity and privacy dimensions, preserve Bank-first focus, avoid unnecessary health disclosure, support progressive introduction and remain safely ignorable. Social is not a generic social-network framework.

## Approved, rejected and deferred boundary

**APPROVED:** explicit activation; source-driven Discover; mutual private Connections; one-way Pins; persistent My Order; independent privacy controls and positive/negative exceptions; read-only Shared Home; centralized authorization; restrained Activity; direct snapshot Moments; 24-hour CB Stories; meaningful CB Badges; capability-specific progressive discovery.

**Rejected from this model:** Followers/Following, Friend as a formal state, Close Connections/Close Friends, privacy presets and public/private/Creator/Founder account modes, public Connection counts/lists/mutual counts, profile Likes, named profile-view history/notifications, active-now/last-seen, engagement-driven ordering, health leaderboards, badge privilege and special Founder/Creator authorization. Neutral “private accounts” copy is descriptive, not an account category. Do not implement a follower/friend domain and merely relabel it in UI.

**DEFERRED:** Feed, comments, DMs (including Story/Moment replies), Highlights, creator analytics, business/restaurant capabilities, professional/coach tooling, CB Games implementation, paid/promoted discovery, and separately designed broader content/engagement systems. A Feed must earn separate approval; it is neither inevitable nor prohibited forever. Public health leaderboards have no approval in this design. External social discovery is desired future functionality subject to verified official APIs, not an integration commitment. No Instagram follower/following/favorite-creator/Close Friends import is claimed.
