# ADR 028: CB Badges as Meaningful Identity

Date: 2026-09-12

## Status

Accepted future product direction. No badge engine, awards, schemas or competitions are implemented. Quantitative qualifications remain OPEN. See the [Social specification](social-system-spec.md), [authorization ADR](adr-026-social-authorization.md), [content ADR](adr-027-cb-stories-and-moments.md) and [implementation plan](social-implementation-plan.md).

## Context

Badges may describe something a user is in relation to CalorieBank, earned, won or regularly does. They provide meaningful identity expression, rather than a checklist of engagement achievements. Trust requires separate evidence, qualification, display and authorization boundaries.

## Decision

## Cb badges

CB Badges are approved.

A Badge is meaningful identity/presentation metadata associated with an ordinary CalorieBank account.

A Badge does NOT:

- create a special account type
- grant special Social functionality
- bypass privacy
- grant access to user data
- change Discoverability
- change Connection permissions
- change Pin permissions
- change sharing
- change Story/Moment access
- change My Order
- automatically boost Discover/search ranking

Badge principle:

"A badge should tell you something meaningful about who this person is, what they regularly do, or what they have actually accomplished."

Badges must NOT become an engagement-driven achievement explosion.

Approved conceptual badge families:

A. OFFICIAL IDENTITY / ROLE BADGES

Examples:

- Founder
- future legitimate CalorieBank organizational roles

Founder example:
Phillip-Bryan Kouokam
Founder

Founder badge means:

- this person is the founder of CalorieBank

It does NOT mean:

- special Social account
- special authorization
- private-data access
- special Pin privileges
- algorithmic boost

Do not implement:
if founder -> bypass Social policy

B. ACHIEVEMENT BADGES

Examples:

- 10K Step Maxxer
- 20K Step Maxxer
- other meaningful objective accomplishments

Do NOT assume exact thresholds/time windows beyond approved concepts unless existing product docs define them.

A Step achievement should represent meaningful demonstrated accomplishment/consistency rather than a trivial one-off unless a future badge definition explicitly says otherwise.

Every achievement badge requires:

- objective definition
- qualification rule
- authoritative eligible data
- explainable provenance

C. COMPETITIVE / TITLE BADGES

Examples:

- CB Champion
- future CBDBZ Champion
- future CB Mario Kart Champion
- event/tournament-specific recognized titles

These badges come from authoritative CalorieBank competition/event results.

Example profile:
Marcus Johnson
CB Champion

Opening badge may explain:

- title
- event
- date
- source/provenance

Tournament infrastructure is not approved by this decision.
This is a future badge source.

D. ACTIVITY IDENTITY / BEHAVIORAL BADGES

This is IMPORTANT and is an approved addition.

Badges are not only things someone "won."

A badge may describe something the person genuinely and repeatedly DOES.

Examples:

- Runner
- Boxer
- Soccer Player
- Basketball Player
- Cyclist / Biker
- Hiker
- Athlete
- other legitimate activity identities

These badges should be inferred only after CalorieBank has sufficient trustworthy evidence that the activity genuinely reflects the user's recurring behavior.

Example:
If provider/activity history shows that a user repeatedly logs substantial running activity over a meaningful period, CalorieBank may qualify them for:
Runner

Do NOT award Runner because:

- they ran once
- they clicked "I like running"
- they viewed running Stories
- they manually selected the badge without qualification

Likewise:
Boxer should reflect recurring boxing activity.
Soccer Player should reflect recurring soccer activity.
Basketball Player should reflect recurring basketball activity.
Hiker should reflect recurring hiking activity.

"Athlete" may eventually represent a broader demonstrated multi-activity or sustained activity identity, but its exact rule remains unresolved.

Exact thresholds for:

- frequency
- duration
- historical window
- provider confidence
- workout classification
- minimum number of qualifying sessions
- overlapping activity identities
- inactivity/expiration behavior

remain OPEN DECISIONS unless already defined elsewhere.

Quantitative thresholds remain OPEN; conceptual names do not supply qualification rules.

Activity identity badges are different from relationship inference.

It is acceptable for CalorieBank to infer:
"This user repeatedly performs running activity -> Runner badge"

It is NOT acceptable to infer:
"This user frequently views Sarah -> Sarah is a Close Connection"

Behavioral badges describe the user's own demonstrated activity pattern.
They do not classify interpersonal relationships.

## Badge trust, provenance, display, and privacy

Every badge should have explainable provenance.

Conceptually every badge definition/award needs:

- badge type/family
- canonical name
- description
- qualification/award rule
- issuer/source
- evidence/provenance reference where appropriate
- awarded/earned date where appropriate
- whether permanent or current-state
- revocation status
- display state

Exact schema remains future implementation design.

Badge source examples:

Founder:

- authoritative CalorieBank role assignment

10K Step Maxxer:

- authoritative eligible Steps history according to future badge rule

Runner:

- sufficiently strong recurring running pattern from eligible activity data

CB Champion:

- authoritative CalorieBank tournament/event result

Badges must not rely on engagement metrics whose primary purpose is increasing usage.

Do NOT award badges merely for:

- opening app X times
- watching Stories
- Pinning many people
- receiving many profile views
- spending X minutes in app
- clicking features
- arbitrary engagement streaks

Badge visibility:

- earned/activity badges may be hidden by user
- user may choose a Featured Badge
- do not force users to socially perform achievements they do not want displayed

Official identity badges:

- may have different display semantics because their purpose is provenance
- exact official-badge visibility rules may remain an open decision
- do not invent special authorization behavior

Featured Badge:

- one prominent user-selected badge may appear in Search/Profile where appropriate
- complete badge collection belongs on Profile
- do not clutter compact Social rows with many badges

Search example:
[avatar] Phillip-Bryan Kouokam
         Founder

Profile example:
Phillip-Bryan Kouokam
@philbk
Founder

Pinned By 18     Pins 10

Badges >

Badge detail:

- tappable/openable
- explains what badge means
- explains qualification/provenance at an appropriate level

Badge count:

- do NOT make total number of badges a major popularity/status metric

Badge visibility does NOT grant underlying metric visibility.

Example:
Sarah:
Steps = Only Me
Badge = Runner, displayed

Viewer may know:
Sarah has Runner badge

Viewer does NOT automatically gain:

- Sarah's current Steps
- running history
- workout details
- provider records

Badges are derived/identity objects with independent display authorization.

Badge permanence:

- generally permanent once legitimately earned if badge represents historical achievement/title
- current-state/activity identity badges may eventually have persistence/expiration rules appropriate to their meaning
- exact expiration semantics for Runner/Boxer/etc. remain unresolved
- do not silently invent them

Badge revocation:
must be possible for legitimate reasons such as:

- fraud
- cheating
- corrupted data
- administrative mistake
- tournament disqualification
- invalid qualification

Ordinary users cannot self-award authoritative badges.

Do not let usernames or mutable display names define badge ownership.
Use immutable user identity.

## Activity identity, overlap and evidence

Recurring activity identities must rest on sufficiently strong trustworthy evidence, never one workout, a preference click, bio text, manual badge selection, Story/photo/caption, views, reactions, Pin count or Connection accumulation. Appropriate canonical workout/activity evidence may qualify Runner, Boxer, Soccer Player, Basketball Player, Cyclist/Biker, Hiker or Athlete under later approved rules. Current provider taxonomy does not prove that all of these classifications exist or can be trusted. Manual activity is eligible only if a future badge rule explicitly approves it.

Users may qualify for multiple activity identities. Do not force mutual exclusion, collapse specific identities into Athlete, or presume Athlete supersedes Runner. Never infer religion, politics, ethnicity, medical conditions, sexual orientation or other sensitive identity from activity. User agency matters: “You qualified for the Runner badge” is preferable to “You are a Runner now.” Earned/activity display remains optional.

Qualification must handle duplicate/overlapping providers, edited/corrected/stale records, spoofing, classification ambiguity and confidence. Awards must be idempotent, bound to immutable identity, auditable, re-evaluable and revocable for fraud, corrupted data, mistakes, invalid qualification or tournament disqualification. A repeated evaluation must not create duplicate awards. Recycled usernames inherit nothing.

Underlying eligible activity patterns may independently support future forecasts or Activity Opportunities under their own approved contracts. The visible badge is never the authoritative input for calorie estimates or activity classification: a Runner badge must not trigger a new running-calorie formula. Badge qualification reads canonical evidence and never writes accounting truth.

## Founder and operational roles

Phillip-Bryan Kouokam may display **Founder** in Profile/Search through authoritative CalorieBank assignment. Tapping may explain that he is CalorieBank's founder. His account has ordinary Social authorization, no private-data backdoor, ranking boost, Pin privilege or special privacy mode. Visible badges and any future administrative/support access roles must be separately modeled and secured. Never derive operational permissions from an award.

CB Champion, CBDBZ Champion and CB Mario Kart Champion are conceptual titles from authoritative future event results. This does not approve tournament rules, scoring, registration, matchmaking, brackets, prizes or CB Games infrastructure.

## Display, explanation and safety

Featured Badge and the full collection belong primarily on Profile; Search may show a restrained meaningful badge. Do not turn compact people rows into trophy walls or make avatar badge decorations compete with Story rings and Pin affordances. Official identity versus user-featured badge priority remains OPEN, as do official-badge hiding rules. New badge visibility is an independent consent decision, not inherited from Steps or other metric sharing.

Badge detail should explain meaning, family, issuer and qualification at an appropriate level, with award/event/date where relevant. It must not reveal private raw workout history, provider records or competition-private records. Preserve conceptual names including 10K Step Maxxer and 20K Step Maxxer; exact catalog, naming/localization and qualification policy require review, not invented thresholds.

Historical achievements/titles generally remain historical. Activity-identity persistence/expiration remains OPEN. Do not create pressure to maintain unsafe activity forever or shame a user for rest. Hiding, expiry and Featured Badge changes are socially silent. Fraud/disqualification public communication is a separate open policy. No automatic Story, Moment, broad notification, Discover boost or My Order change follows an award.

The first meaningful badge can explain itself; do not show a new user hundreds of badges to grind for. Qualification-to-private-collection behavior, user confirmation, owner notifications (push versus in-app/Activity) and official/title notification behavior remain OPEN. No noisy default is approved.

## Consequences

Advanced awards require approved eligible sources, qualification windows, confidence, safety review and correction/revocation policy first. Activity badges may complement Stories without Stories becoming evidence. Meaningful recognition may support product value; maximizing badge count, rarity, points or engagement is not the goal.

## Rejected alternatives

Self-awarded authoritative badges; weak-evidence activity labels; Founder/Creator authorization; sensitive identity inference; badge-driven forecasting; popularity/viral/100-Pins/100-Connections badges; app-open/watch-time streak awards; public badge comparisons/scores; automatic broadcasts; unsafe escalating step targets.

## Open decisions

Exact badge catalog and names; all Step Maxxer and activity qualification rules; eligible provider/manual data and classification; frequency/duration/history/confidence thresholds; overlaps; expiration; re-evaluation/correction and anti-fraud methods; revocation and dispute process; official display versus Featured Badge; collection UI; notifications and confirmation; localization and safety review. None is silently resolved by conceptual badge examples.
