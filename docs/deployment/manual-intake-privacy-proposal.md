# Phase 1B privacy wording — approved and published

Founder approved the exact paragraph and publication on 2026-09-23. Publish with
an updated effective date before Manual Intake enablement. Approval does not
extend to unrelated legal or store declaration changes.

The published policy at `https://caloriebank.philbk.dev/privacy` was inspected on
2026-09-23 and matched `web/legal/privacy.html`. It already describes nutrition
totals, settings, calculation history, purposes, processors, retention and account
deletion. Its collection paragraph specifically describes **connected/imported**
information. Explicitly describing user-entered estimates would make the new
collection path clear; do not claim that this narrower wording already names it.

Proposed exact addition in section 2, after “Connected health and fitness
information” and before “Your settings and calculated information”:

> **Your calorie estimates.** If you choose CalorieBank estimate, CalorieBank
> stores your usual daily calorie estimate, changes you make for a specific day,
> and the dates and source information needed to calculate your bank and preserve
> your history. These estimates stay in your CalorieBank account; CalorieBank does
> not write them to Apple Health or Health Connect.

Update the policy's effective date on publication. No other public wording change
is proposed. The founder's explicit approval above authorizes this exact legal
publication; publication completed on September 23. Vercel deployment `dpl_6mEwxhXcBo8FQDxehwP5Uqxb6vwX` is ready on the existing `caloriebank-legal` production project. Public `/privacy` matched the approved repository HTML byte-for-byte; `/delete-account` matched its unchanged HTML. The added paragraph was visually checked at 320px without horizontal overflow.

No new processor, advertising use, health-store permission or sharing purpose is
introduced. Estimates fit the existing nutrition/health category and app
functionality purpose. Store declaration conclusions still require comparison to
the actual current declarations before distribution. Existing account deletion
wording covers account-owned estimates; database deletion evidence must confirm
the implementation. No public deletion-page change is proposed.
