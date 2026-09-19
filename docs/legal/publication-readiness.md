# Privacy publication candidate — approval and operations holds

September 19,2026. Candidates are ready for final founder review, **not publication**.
Clean text is proposed future published copy; it is not proof that the support channel
is live. [Privacy](privacy-policy-draft.md), [deletion](account-deletion-draft.md),
[retention findings](retention-resolution.md), [evidence](privacy-policy-evidence.md).

## Resolved founder decisions

Near Future I-X is publisher. D-U-N-S issued/available to founder; never request,
enter or retain number in chat/repo. Approved public contact spelling:
`support@caloriebank.philbk.dev`; inbound and outbound delivery verified September 19, 2026.
Approved no-sale commitment is limited to **personal health information**. Advertising
wording is **current-state**, not permanent. Approved current V1 audience is not
child-directed; no numeric minimum-age or permanent 18+ product identity adopted.
Approved policy-change wording is incorporated exactly.

## Support mailbox — delivery verified September 19, 2026

Provider: Zoho Mail Lite (5 GB), one mailbox, founder-approved price of US$12/year
plus applicable taxes. Founder completed account ownership and purchase. The mailbox
is `support@caloriebank.philbk.dev`, with outgoing display name **CalorieBank Support**
saved successfully in Zoho's Send Mail As settings. Founder has authenticated webmail
access at [Zoho Mail](https://mail.zoho.com/). No catch-all was configured.

Only additive mail records were configured in the existing Vercel DNS zone:

| Relative name under philbk.dev | Type | Value / purpose |
| --- | --- | --- |
| caloriebank | TXT | Zoho domain-ownership verification |
| caloriebank | MX | mx.zoho.com, priority 10 |
| caloriebank | MX | mx2.zoho.com, priority 20 |
| caloriebank | MX | mx3.zoho.com, priority 50 |
| caloriebank | TXT | `v=spf1 include:zohomail.com ~all` |
| zmail._domainkey.caloriebank | TXT | Zoho-generated public DKIM key |
| _dmarc.caloriebank | TXT | `v=DMARC1; p=none` |

TTL: 60 seconds. No pre-existing SPF or root/subdomain DMARC record was found.
DMARC is monitoring-only; it does not enforce quarantine/rejection or request aggregate
reports. Zoho verified all three MX records, SPF and DKIM. Authoritative DNS also
confirmed DMARC. Optional ZeptoMail/transactional-email records were not configured.
Existing website, apex and Clerk DNS records were not modified.

| Delivery check | Evidence / result |
| --- | --- |
| External inbound | PASS — founder sent neutral test from Gmail; arrived in Zoho Inbox at 12:00 PM America/Chicago. |
| Reply outbound | PASS — reply sent through Zoho at 12:01 PM; founder confirmed receipt. |
| Sender identity | Configured as `CalorieBank Support <support@caloriebank.philbk.dev>`; Zoho confirmed saved setting. Gmail conversation list abbreviates the name to CalorieBank; full received header was not independently inspected. |
| Spam placement | PASS for this test — founder screenshot shows reply in Gmail Primary inbox. No general deliverability guarantee. |

**Public support contact: VERIFIED for send/receive.** Raw message headers, private
credentials and the founder's external test address are not retained in this document.
SPF/DKIM/DMARC receipt-header alignment was not independently inspected; DNS verification
and successful inbox delivery are the evidence obtained. Monitoring cadence, backup
coverage, MFA/recovery review and correspondence retention remain operational follow-up
items. Founder should monitor this mailbox for support, privacy and deletion requests.

The legal pages remain unpublished. Future web hosting must preserve valid MX/TXT
coexistence at `caloriebank.philbk.dev`; do not replace that hostname with a conflicting
CNAME. This task did not deploy a website or modify application services.

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

1. Mailbox delivery hold resolved: Zoho send/receive verified above. Publication still requires founder approval and the remaining holds below.
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
not tested/live resources. Mail setup was separately authorized and completed as recorded
above. No legal-page publication, website deployment, Play account, D-U-N-S entry,
Google legal acceptance, declaration submission or AAB was performed.
