# Privacy publication candidate — approval and operations holds

September 19,2026. Candidates are ready for final founder review, **not publication**.
Clean text is proposed future published copy; it is not proof that the support channel
is live. [Privacy](privacy-policy-draft.md), [deletion](account-deletion-draft.md),
[retention findings](retention-resolution.md), [evidence](privacy-policy-evidence.md).

## Resolved founder decisions

Near Future I-X is publisher. D-U-N-S issued/available to founder; never request,
enter or retain number in chat/repo. Approved public contact spelling:
`support@caloriebank.philbk.dev`; not yet operationally verified.
Approved no-sale commitment is limited to **personal health information**. Advertising
wording is **current-state**, not permanent. Approved current V1 audience is not
child-directed; no numeric minimum-age or permanent 18+ product identity adopted.
Approved policy-change wording is incorporated exactly.

## Mail infrastructure and setup proposal — nothing created

Read-only authoritative DNS on September 19:
`philbk.dev` NS = ns1.vercel-dns.com/ns2.vercel-dns.com.
Both apex and `caloriebank.philbk.dev` MX responses: NOERROR, zero answers.
No established mail provider is evidenced. Lack of MX alone is not proof no mailbox
could exist elsewhere, but the approved address is **not verified receiving mail**.
Vercel DNS supports MX/TXT; that does not provide an inbox by itself.
[Official DNS documentation](https://vercel.com/docs/domains/working-with-dns).

Recommended setup after founder selects provider/approves any cost:

1. Use an existing organization-controlled mail provider if it supports a custom
   subdomain; otherwise choose a hosted mailbox provider offering inbound and
   authenticated outbound mail. A forwarding-only address is insufficient without
   a tested send-as route. No paid plan/provider selected in this task.
2. Add `caloriebank.philbk.dev` as mail domain in that provider. Create support
   mailbox/alias with founder access, recovery and MFA. Do not forward health/support
   messages into an unapproved shared/personal distribution list.
3. Obtain exact provider verification TXT, MX priorities/targets, SPF and DKIM values.
   In existing Vercel zone, MX name is `caloriebank`; SPF TXT same name; DKIM name is
   provider selector + `._domainkey.caloriebank`; DMARC is `_dmarc.caloriebank`.
   Do not invent MX values or publish duplicate SPF records. Review DMARC policy
   with the provider and verify alignment before enforcement.
4. Preserve portfolio/apex records and existing Clerk/service DNS. If proposed web
   hosting puts a CNAME at the exact mail-domain name, resolve the CNAME/MX coexistence
   conflict with supported A/AAAA or alternative hosting configuration before changes.
   Mail and web can share a hostname only with valid DNS record composition.
5. Test external sender → support inbox → founder reply from the support address →
   external receipt. Check spam placement, Reply-To, SPF/DKIM/DMARC alignment and
   both desktop/mobile access. Use neutral test text, no account or health details.
6. Name monitoring owner/backup, notifications and support-mail retention/access.
   Record test date/results without private headers or credentials. Only then mark live.

No simpler currently operational branded address is evidenced. `support@philbk.dev`
is shorter but also has no evidenced MX and changes the approved identity; not an
automatic substitute. Keep the approved CalorieBank-specific address unless founder
chooses otherwise.

## External deletion-request process — proposed for approval/rehearsal

- Requester emails support, preferably from account email. Do not require app
  reinstallation. Collect only account email and explicit request to delete.
- Do not treat From header alone as ownership proof. Authorized operator checks the
  current Clerk **verified email**, maps Clerk subject to the internal authSubject,
  and starts a fresh confirmation thread to that stored verified email (not an
  arbitrary Reply-To). Ask for an explicit deletion confirmation by reply. No
  passwords, sign-in/email verification codes, diary or unnecessary ID documents.
- Check mail authentication and correspondence; bind approval to that specific
  subject/request. Recheck subject and email immediately before execution, including
  deletion/recreation or email changes. Do not expose whether an account exists to
  an unverified requester. Multiple matches/changed identity require review, not
  deletion by email lookup alone.
- If access to the verified mailbox is lost, use Clerk's legitimate account-recovery
  process or a separately approved support verification process. A claimed email,
  payment receipt or knowledge of health values is not sufficient. Do not bypass
  authentication or invent a document-collection flow. No completion-time SLA set.
- After verification, use an authorized restricted administrative invocation of the
  **existing AccountSafetyService.deleteAccount** with the verified internal identity.
  No public endpoint, direct SQL purge or Clerk-first delete. A reviewed one-time
  admin runbook and disposable-account rehearsal are required before offering this
  support route. This audit does not create or execute an admin deletion tool.
- Confirm live deletion and notification/provider cleanup via minimal safe evidence;
  retry through existing ordered/resumable service if needed. Communicate completion
  only to the verified channel. Keep minimal request/result records under an approved
  support-record retention policy; no unbounded retention invented.

## Publication holds (outside clean text)

1. Inbox creation/cost/provider choice and end-to-end receiving/reply test.
2. Monitoring, secure deletion verification/execution runbook rehearsal and support
   correspondence retention approved. Candidate wording assumes this future operation.
3. Approve concise retention wording with known limits; resolve operational exports,
   Clerk retention and restore handling in retention-resolution.md. Legal review of
   jurisdiction, contracts, rights/health-data consent and any additional identity
   disclosures remains distinct from code evidence.
4. Approve actual Play target-age ranges and separately required health-app description
   disclaimer. No declarations submitted. Set actual last-updated date at publication.

Proposed public URLs remain `https://caloriebank.philbk.dev/privacy` and
`https://caloriebank.philbk.dev/delete-account`. Candidate links point there but are
not tested/live resources. No DNS/mail creation, deploy, Play account, D-U-N-S entry,
terms acceptance or AAB authorized/performed.
