# Social Design and Repository Audit

Date: 2026-09-12

## Scope and authority

This audit records the repository inspected for the founder-approved future Social documentation pass. It is implementation evidence and planning, not product authority. The [Social specification](../product/social-system-spec.md), ADRs [025](../product/adr-025-caloriebank-social-foundation.md), [026](../product/adr-026-social-authorization.md), [027](../product/adr-027-cb-stories-and-moments.md), [028](../product/adr-028-cb-badges.md) and [implementation plan](../product/social-implementation-plan.md) contain the durable product contract. No production functionality was changed.

## Observed implementation

| Inspected surface | Finding and implication |
| --- | --- |
| Root and mobile AGENTS.md | Implementation guardrails defer canonical product/calculation behavior to PRD/spec/ADRs. No Social implementation rules or nested documentation AGENTS.md were found. Root guardrails now link to the future decisions. |
| Root/mobile READMEs and V1 PRD | PRD explicitly excluded Social feeds and friends/family sharing from V1. No prior dedicated Social specification or Social ADR was found. Future design approval does not change that launch boundary. |
| Product ADRs 001, 004–006, 011–015; bank calculation authority | Connection-first, automatic bank usage, provider-neutral inputs, distinct awareness/planning, all three discovery gates, and existing numeric-feature blockers remain binding. Social cannot invent calorie values or unlock unresolved product features. |
| ADRs 019–024, Phase 1, current architecture and release documents | Identity/Opening Bank/corrections, current limited Banking Goal, prediction-only features and implemented Morning Bank Update require precise compatibility. Two distinct files already use ADR 024; this pass leaves them intact and allocates 025–028 to Social. |
| `apps/mobile/app/(tabs)/_layout.tsx` and Settings routes | Active tabs are Today, History and Settings. No Social tab, user-facing Social Profile, Story, Moment or Activity route exists. Future bottom-navigation Social is a design contract, not current navigation. |
| `apps/api/prisma/schema.prisma` | Internal UUID User, Clerk subject, account profile, provider state, normalized aggregates, accounting and morning-notification models exist. No Social activation, graph, access exceptions, media, reaction or badge model was found. Profile existence is not Social participation. |
| `apps/api/src/app.ts`, authentication and current module inventory | Account-owned `/v1/me/*` routes and provider callbacks exist. No cross-user Social authorization service/endpoints were found. Authentication and owner request isolation are prerequisites, not permission to expose those responses to viewers. |
| `packages/domain/src/index.ts`, `packages/schemas/src/index.ts` | Canonical calculations, normalized activity taxonomy and owner-facing API schemas are reusable boundaries. They are not viewer-safe Social DTOs. Proposed badge activity names do not prove trustworthy source classification exists. |
| Dashboard preferences repository and mobile Today behavior | Fixed canonical ordering and persisted card visibility exist; no viewer custom Home-layout model was found. Future Shared Home falls back to canonical ordering until separately approved arrangement support exists. |
| Morning Bank Update models/module and release stabilization | Delivery preferences, device ownership and daily deduplication exist. They do not implement Social events, Activity or creator-scale aggregation. Social delivery needs its own privacy/event review. |
| Legacy and backup search | Prototype CSS `social-bg`, README technology badges, founder calibration copy and ordinary “social events”/“moment” language are unrelated to Social graph functionality. No supported Social implementation was inferred from these matches. |

The initial worktree was clean. No unrelated worktree changes, application code, dependency files, migrations, database state or external service configuration were modified.

## Contradictions and reconciliation

| Finding | Resolution |
| --- | --- |
| README numbered AGENTS.md first under source-of-truth hierarchy | Product PRD/specs and focused ADRs now precede audit and derived implementation guardrails. AGENTS.md explicitly points back to product authority. |
| PRD blanket “Social feeds, friends/family sharing” V1 exclusion could be mistaken for rejection of future approved design | Kept current V1/beta exclusion and added a clearly future-facing Social authority section. Feed remains deferred even within that future design. Ordinary friends/family release-cohort wording is not a formal Social relationship. |
| No existing Followers/Close Connections/Feed implementation or affirmative product requirement found | Recorded these as rejected/deferred alternatives; did not fabricate a historical follower migration or delete harmless ordinary-language occurrences. |
| “Finalized Bank” could be read as locked days only, or exclude Opening Bank | Social explicitly preserves canonical provisional postings, immutable Opening Bank, append-only correction and permanent locking. Available Bank remains the non-negative presentation of one effective balance; unavailable is not zero. |
| Future Home layout examples differ from current fixed ordering | Viewer-relative future contract uses canonical order as fallback. No current layout engine or Today redesign is claimed. |
| Shareable Banking Goals/Eating Budget/Emergency Bank examples could imply approved implementations | Social respects their canonical feature status and blockers. Current singular Banking Goal is the Phase 1 Planned Treat rename; ADR 013 allocations remain separate and blocked. |
| Founder identity or activity badges could be confused with authorization, forecast evidence or existing data capability | Badges are presentation metadata. Canonical eligible evidence, not badges or Stories, drives qualification and any independently approved forecasting. No Founder/Creator privilege or unverified activity classification is claimed. |
| Everyone resource sharing versus private discovery | Everyone is limited to otherwise reachable viewers. Explicit resource grants provide limited reachability; direct-profile grants do not grant resource values. Everyone Story reachability outside that context remains OPEN. |
| Relationship grandfathering versus immediate privacy revocation | Pins may survive deliberate reconciliation; data access never inherits grandfathering. Blocks have no grandfather option. Inaccessible retained-row and post-unblock grant behavior are explicitly OPEN. |
| Older audit prose describes prototype/earlier foundation phases | Added a dated Social-specific evidence section; historical non-Social migration discussion remains scoped historical context and is not used to override newer canonical product rules or release holds. |

## Implementation status and prerequisites

All Social capabilities are designed future work, not shipped: activation, identity/privacy, discovery, graph, My Order, Shared Home, Activity, Moments, Stories and badges. Existing core identity, normalized data, read models and notification infrastructure provide boundaries to assess, not completed Social milestones.

Future sequence: policy/identity/activation and security tests; authorized discovery/requests; Connections/Pins/My Order; per-resource sharing and safe Shared Home; meaningful event/Activity delivery; Moments; secure Stories; qualified badges; verified external discovery if feasible. Policy support for exceptions, blocking and safe serialization must precede broad exposure, and notifying actions require event safety from their first release. See the implementation plan for the full dependency gates and OPEN register.

No official Instagram/Meta graph capability, Contacts matching protocol, media vendor/CDN, quantitative badge rule or Social privacy compliance policy was verified or selected. These are open future investigations, not supported integrations or resolved architecture. External lookup was unnecessary for this pass because no current external capability claim was made. Exact API access, permissions, terms and app review must be verified at implementation time.

## Current priority and recommendation

The [September release candidate](../deployment/friends-family-release-candidate.md) revokes its earlier PASS, and [stabilization](../deployment/friends-family-stabilization.md) requires corrected-binary physical regression checks. PB.1/PB.2 and automated results do not certify that checklist. No new live deployment or physical-device assessment was performed here. Continue core beta stabilization/certification first; later authorize the smallest Social domain/authorization, privacy, activation and basic identity milestone. Do not implement all Social as the next milestone.

## Requirement coverage

The founder direction was consolidated by responsibility rather than duplicated as a conversation transcript:

| Approved concern | Durable home |
| --- | --- |
| Constitution, primitives, activation and independent consent | Social specification: constitution, governing philosophy, activation, invariants and consent |
| Search, Contacts, direct links and desired external discovery | Social specification: discovery/ranking; ADR 026: reachability; implementation plan: blockers |
| Requests, cross-requests, denials, privacy reconciliation | Social specification: Connections/Pins; ADR 026: transaction and lifecycle rules |
| My Order, first five Pins, metrics, private counts and identity lists | Social specification: Pins/ordering/Home; ADR 026: authorized projection |
| Resource audiences/exceptions, limited reachability and viewer-relative Shared Home | Social specification: sharing/Shared Home; ADR 026: separate policy decisions |
| Block, deactivation, deletion, identity reuse, reports and revocation | ADR 026 plus lifecycle open decisions |
| Notify/silent events, Activity, no profile surveillance | ADR 027: notifications and profile views |
| Moments, co-recipient privacy, snapshots, reactions and external copies | ADR 027 and implementation-plan acceptance journeys |
| Stories, audience, rings, filters, viewers, expiration and secure delivery | ADR 027 and Story-specific open decisions |
| Badge families, Founder, trust, identity evidence, display, overlap, notifications and integrity | ADR 028 and qualification/open-policy register |
| Canonical Bank/Forecast/Goal/provider boundaries and no food/activity duplication | Social specification compatibility, ADR 025 and bank-spec cross-reference |
| Simplicity, progressive familiarity, safety, analytics and non-gamified growth | Social specification discovery/consent/learning and implementation-plan verification |
| Deferred Feed/comments/DMs/Highlights/analytics/business/CB Games | Social specification scope and ADR rejected alternatives |
| Concrete expected private/family/creator/empty/mature experiences | Implementation-plan acceptance journeys |
| Open decisions, phased dependencies and future test matrix | Social implementation plan |

## Documentation verification

Verification is limited to documentation consistency: whitespace/diff checks, local Markdown link resolution, repository-wide terminology/conflict review, source-to-document coverage review and changed-file scope. No documentation-specific lint/check script was found in root/workspace package manifests. Existing lint/typecheck/test scripts target application code; no production code or consumer screens changed, so application tests and rendered visual QA are not claimed for this pass. Current physical release holds remain unchanged.

Checks run for this pass: `git diff --check` passed; all 13 changed files were confirmed to be Markdown; all 68 local Markdown link targets resolved; changed-file whitespace checks passed. The repository-wide terminology scan covered 883 matches across 50 Markdown files, with focused review of prohibited Social concepts and canonical compatibility. No documentation-specific lint script was available. Application lint, typechecks, tests and physical/rendered UI checks were not run for this documentation-only change.
