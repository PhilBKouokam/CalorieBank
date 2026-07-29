# ADR 013: Banking Goals

Date: 2026-07-28

## Status

Accepted as a progressively discovered V1 Planning capability.

The capability name, one-bank invariant, conservation rules, planning boundaries, discovery treatment, and conceptual allocation methods are approved. Production implementation is blocked until the protection model and the policy for reconciling Banking Goal allocations after finalized withdrawals are approved.

## Context

Available Bank is one authoritative, finalized, ledger-backed calorie balance. Planning Database entries estimate future foods and events, and the current Planned Treat gives one plan an awareness target, but neither capability organizes portions of Available Bank among several purposes.

Users may want to preserve progress toward a longer-term plan while temporarily prioritizing an upcoming meal or event. CalorieBank needs a planning model that gives finalized savings a purpose without creating parallel banks, duplicate calories, manual food tracking, or a second authoritative ledger.

The approved user-facing name is **Banking Goals**. Do not describe the capability as multiple independent banks, separate calorie accounts, calorie wallets, parallel ledgers, extra calories, or additional bank balances.

## Decision

Banking Goals organize real finalized calories already contained in Available Bank:

> CalorieBank maintains one authoritative finalized calorie balance. Banking Goals only organize portions of the Available Bank.

Conceptually:

```text
Finalized calorie savings
├── Available Bank
│   ├── Banking Goal allocations
│   └── Unassigned calories
└── Emergency Bank
```

The following invariants are mandatory:

```text
total_active_goal_allocations + unassigned_available_calories
  = available_bank

total_active_goal_allocations
  <= available_bank
```

The same finalized calorie may be allocated to at most one active Banking Goal. Allocations must not create duplicate, virtual, borrowed, projected, or otherwise unearned calories.

Emergency Bank remains a separate protected allocation under its own policy. It is excluded from ordinary Banking Goal funding. A user-created goal named `Emergency` does not gain Emergency Bank behavior.

## Relationship To Existing Planning

Banking Goals belong to the Planning layer.

- A Banking Goal may optionally reference a Planning Database item, Planned Treat, restaurant item, packaged food, homemade meal, event, or user-created plan.
- Planning Database values may help estimate a target but remain estimates.
- Changing a planning estimate must not silently rewrite a Banking Goal target.
- Creating or editing a goal does not record intake.
- Actual consumption remains in the connected intake tracker.
- Finalized provider intake and expenditure remain the only automatic source of daily deposits or withdrawals.

The existing one-active-Planned-Treat implementation remains a simpler planning-awareness capability. Banking Goals is the approved broader V1 allocation model, but this ADR does not migrate, replace, or expand that implementation.

Until migration is approved, Planned Treat continues to compare its requirement with total Available Bank under its existing contract. Enabling Banking Goals may require that relationship to change or that a Planned Treat become an associated Banking Goal; the product must resolve this before both models are active for the same user.

## Goal Properties And States

A Banking Goal may conceptually include:

- User-facing name.
- Optional target calorie amount.
- Current allocated amount.
- Optional target date.
- Optional description or note.
- Priority position.
- Allocation method.
- Status.
- Optional associated planning item.
- Creation timestamp.
- Completion, cancellation, or archival state.

Potential states include `Active`, `Unfunded`, `Partially funded`, `Ready`, `Used`, `Completed`, `Paused`, `Cancelled`, and `Archived`. These are product concepts, not an approved schema or final state machine.

`Ready` means the user has chosen to reserve enough real Available Bank calories for the goal. It does not mean the food is recommended, eaten, logged, withdrawn, or required to be consumed.

`Used` or `Completed` requires appropriate user confirmation or a separately approved attribution process. A funded goal must not become consumed automatically.

## Allocation Methods

The capability supports three conceptual approaches.

### Priority Allocation

Goals are ranked. New eligible finalized deposits fund the highest-priority goal until its target is reached, then overflow continues to the next eligible goal and finally to Unassigned.

Priority allocation is the preferred default candidate because it minimizes daily work and supports temporary prioritization. The default is not authoritative until product resolves its interaction with Emergency Bank, corrections, untargeted goals, ties, and withdrawal protection.

### Percentage Allocation

Users may assign percentages of the portion available to Banking Goals:

```text
70% -> Long-term goal
30% -> Weekend event
```

Percentages must not allocate more than `100%` of the eligible portion. Interaction with Emergency Bank contribution percentages remains unresolved.

### Manual Allocation

Finalized calories may remain Unassigned until a user allocates them. Manual allocation should remain available where practical, but it must not become required daily work.

No allocation method changes the daily bank formula or the Available Bank total.

## Deposit Flow And Overflow

Banking Goal allocations occur only after a positive contribution has become a real finalized balance-changing event:

```text
positive completed-day contribution
-> apply approved Emergency Bank allocation policy
-> allocate the remaining Available Bank contribution under Banking Goal policy
-> leave any remainder Unassigned
```

This sequence is conceptual. Existing documentation establishes Emergency Bank allocation from positive contributions, but it does not fully resolve corrections or the exact policy boundary between reserve allocation and Banking Goal allocation. Implementation must wait for that order and its versioning requirements to be approved.

Negative completed-day changes are withdrawals, not goal deposits.

Overflow must never disappear. Valid conceptual destinations include:

- Next prioritized eligible goal.
- Other percentage-based goals.
- Unassigned Available Bank.
- A user-selected fallback goal.

The supported use case is:

```text
Available Bank: 4,000 kcal

Crumbl:       4,000 / 10,000 kcal
Aunt's event:     0 /  2,000 kcal, Saturday

Temporary priority:
1. Aunt's event
2. Crumbl
3. Unassigned

New eligible finalized deposits: 2,300 kcal

Aunt's event: 2,000 / 2,000 kcal, Ready
Crumbl:       4,300 / 10,000 kcal
Overflow:       300 kcal routed to the next eligible goal
```

This reallocates finalized savings; it does not modify `daily_bank_change`. Automatic priority overflow is an approved use case, while its exact default and fallback policy remain open.

## Conservation And Traceability

Banking Goal allocation events may be required for auditability, but they are not a second calorie ledger.

```text
allocate 500 kcal:
  Available Bank unchanged
  Unassigned -500
  Goal allocation +500

release 500 kcal:
  Available Bank unchanged
  Goal allocation -500
  Unassigned +500
```

Creating, editing, pausing, reordering, cancelling, deleting, completing, or archiving a goal must not independently change Available Bank.

Allocation history should explain:

- Which finalized calories were eligible.
- How Emergency Bank policy affected the eligible portion.
- How allocation rules routed a deposit.
- Why overflow moved.
- Which goal allocations were released or reduced.
- Which values are finalized and which targets are planning estimates.

The authoritative bank ledger remains responsible for finalized deposits, withdrawals, Available Bank, Emergency Bank, and recovery. Banking Goal records organize only the Available Bank portion and must be reconstructable or reconcilable against it.

## Goal Changes

Approved conceptual behavior:

- Cancelling or deleting an unused goal releases its allocated calories to Unassigned.
- Pausing a goal stops future automatic allocation but does not automatically release existing allocation.
- Archiving preserves history and stops future allocations.
- Increasing a target creates no calories.
- Reducing a target below its allocation releases the excess under an approved overflow policy.
- Fully funding a goal marks it Ready; it does not mark it consumed or create a withdrawal.

Confirmation, undo, recovery of deleted goals, retention, and exact overflow behavior remain open.

## Withdrawals And Usage Attribution

Bank usage remains automatic under ADR 004. Users do not manually withdraw calories before eating.

A finalized negative daily change reduces the authoritative balance. A Banking Goal cannot remain represented as funded beyond the Available Bank that still exists:

```text
goal allocations + Unassigned = current Available Bank
```

The exact allocation-reduction policy is not approved. Candidates include:

- Reduce Unassigned first.
- Reduce the goal explicitly associated with the event.
- Reduce goals in reverse priority.
- Reduce goals proportionally.
- Ask the user.
- Apply soft-reservation behavior and report reduced coverage.

The intended user outcome is that unrelated spending should not silently destroy protected planning progress. That intent does not override conservation. The protection model and withdrawal-allocation policy are blocking Open Product Decisions.

After a relevant finalized withdrawal, CalorieBank may offer lightweight attribution:

> Did this bank usage belong to Aunt's event?

Potential actions are `Yes`, `Partially`, `No`, and `Decide later`. Attribution organizes planning history only. It must not create, duplicate, reverse, or edit the ledger withdrawal.

For partial use, a user may keep leftover allocation, move it to another goal, release it to Unassigned, or apply an approved overflow preference. The system must not move leftovers silently without an approved rule.

## Relationship To Other Bank And Guidance Concepts

| Concept | Authoritative meaning |
| --- | --- |
| Available Bank | One finalized, ledger-backed, non-negative balance for ordinary planned flexibility. |
| Banking Goal allocation | A purpose label on a portion of Available Bank; not an independent balance or ledger. |
| Unassigned calories | The portion of Available Bank not allocated to an active Banking Goal. |
| Emergency Bank | Separate optional protected reserve for unexpected events; excluded from ordinary Banking Goal funding. |
| Today's Eating Budget | Current-day, non-ledger eating guidance; it does not allocate or consume Banking Goals. |
| Today's Forecast | Estimated future expenditure guidance; projected activity cannot fund a Banking Goal. |

A planning comparison must label whether it uses Remaining Today, Unassigned calories, a specific Banking Goal, or total Available Bank.

Projected Daily Burn, activity estimates, and current-day awareness must never appear as saved goal progress. Goal progress uses finalized calories only. No Projected Bank is permitted.

## Progressive Feature Discovery

Banking Goals is an approved post-foundation V1 Planning capability. It is not mandatory onboarding and need not appear on the Foundation-stage dashboard. Planning -> Banking Goals is the intended complementary progression when organizing saved calories naturally extends the user's active planning workflow.

Conceptual eligibility signals include:

- A meaningful Available Bank exists.
- The user preserves savings over time.
- The user creates or approaches a planned food, meal, treat, or event.
- The user has both a longer-term plan and a near-term event.
- The user explicitly asks to organize savings.
- The user opens Planning, Available Bank details, or Customize Today.

These signals may establish relevance but are not proof of intent, familiarity, or complementarity, and do not approve automated behavioral inference or machine learning. A proactive recommendation requires all three ADR 014 gates. A goal must be user-created or explicitly confirmed.

Introductions must be relevant, complementary, appropriately paced, explainable, optional, dismissible, non-repetitive, and manually discoverable where practical. Potential manual entry points include Planning, Available Bank details, Customize Today, a `Create goal` action, or a planned-item flow. Exact navigation remains open. Manual creation must not be blocked while the system waits for familiarity evidence.

Do not require new users to name goals, set targets, rank priorities, configure percentages, learn overflow, or attribute withdrawals before they understand Available Bank.

## Notifications

The morning finalized-bank update remains the primary V1 notification. Do not notify on every allocation change.

A future morning update may include concise progress:

```text
+420 kcal finalized yesterday
Aunt's event is now ready.
```

Potential goal-funded, approaching-date, user-requested progress, allocation-conflict, or withdrawal-impact notifications require separate threshold, consent, frequency, and fatigue-control decisions.

## Safety, Privacy, And Language

Prefer language such as `saving for a meal you care about`, `reserving part of your Available Bank`, `progress toward your goal`, and `ready when you choose to use it`.

Avoid `earn permission to eat`, `pay for food with exercise`, `work off a meal`, `binge fund`, `cheat-day account`, punishment, debt, and failure language.

Banking Goals are planning tools, not medical approval or nutrition recommendations. The product must not gamify extreme calorie targets or encourage unsafe restriction to build allocations.

Discovery and recommendation may use only approved, visible product data. CalorieBank must not create named goals from intake history, location, calendar, messages, browsing, or inferred cravings. Avoid invasive or unsupported claims about what a user intends to eat or attend.

Analytics must not include raw Banking Goal names, dates, descriptions, or free-text notes. Retention, export, and deletion requirements must be approved before broader use.

## Validation

V1 research should evaluate:

- Whether users understand that goals organize one Available Bank.
- Whether allocated and Unassigned calories are clear.
- Whether priority allocation and overflow are predictable.
- Whether `Ready` is distinguished from consumed or withdrawn.
- Whether temporary priorities preserve longer-term planning.
- Whether create, edit, pause, reorder, cancel, and complete concepts are understandable.
- Whether leftover and withdrawal effects are explainable.
- Whether Emergency Bank remains clearly separate.
- Whether the feature supports a real food or event decision without exercise-for-food pressure.
- Whether progressive discovery is timely and manual discovery is possible.

Goal creation and app-open counts alone do not establish product value.

## Open Product Decisions

- Is Banking Goals implemented in first-10-user V1 or later in the post-foundation V1 rollout?
- What Available Bank amount or other context makes introduction useful?
- Where is Banking Goals manually discoverable?
- Is priority allocation the default?
- Are percentage and manual allocation included in the first implementation?
- What is the exact order between Emergency Bank allocation and Banking Goal allocation?
- Can rules differ by goal?
- May users allocate all Available Bank, or must some remain Unassigned?
- Are allocations soft reservations or protected allocations?
- Can allocated calories be considered spendable outside their goal?
- How are unrelated finalized withdrawals allocated?
- Is Unassigned reduced first?
- Can users choose which goal funded a withdrawal?
- Can attribution occur before finalization?
- How is partial use confirmed and represented?
- What happens to leftover allocation after use?
- What is the default overflow destination?
- Can overflow automatically resume a previously paused long-term goal?
- How are equal priorities resolved?
- May a goal omit a target or target date?
- Are recurring goals included?
- Can a funded goal's target change?
- What confirmation and undo apply when reducing a target below allocation?
- Are deleted goals recoverable?
- How long is goal history retained, and can goals be archived?
- Are nested goals or categories supported?
- What is the maximum active-goal count?
- Can one planning item belong to multiple goals?
- Can a goal reference a Planning Database item?
- Does Planned Treat become a Banking Goal, reference one, or remain a separate whole-Available-Bank awareness view after Banking Goals launches?
- Can changed planning estimates update targets, and what confirmation is required?
- What rounding applies to goal allocations?
- Do allocations update synchronously with provisional posting?
- How do provisional corrections change allocations, including goals already marked Used or Completed?
- How are correction-driven allocation changes explained?
- When may goal-progress notifications be sent?
- Can users disable Banking Goal recommendations?
- How long does dismissal suppress another introduction?
- Which discovery signals are approved?
- What safeguards prevent extreme-consumption gamification?

The protection model, finalized-withdrawal allocation, Emergency Bank ordering, and correction behavior block production implementation. The remaining decisions can be staged if conservation and traceability remain enforceable.

## Consequences

- Banking Goals is part of V1 scope without becoming mandatory onboarding or Foundation-stage UI.
- Existing one-active-Planned-Treat behavior remains valid until a separately approved migration.
- No schema, migration, API, test, route, dashboard card, notification, or production allocation logic is approved by this documentation-only decision.
- Future implementation must use named, versioned allocation policy and auditable allocation events without creating a second authoritative calorie ledger.
- Existing bank calculation, provisional reconciliation, and current-day awareness behavior remain unchanged.
