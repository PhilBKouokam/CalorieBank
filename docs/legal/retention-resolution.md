# Retention resolution — September 19, 2026

Internal evidence, not a public vendor-retention schedule. No settings changed.
This supplements [claim matrix](privacy-policy-evidence.md); newer findings here
supersede its September 18 unresolved-status entries.

| Layer | Current evidence | What remains uncertain |
| --- | --- | --- |
| A — live CalorieBank database | AccountSafetyService deletes Clerk user then internal user with cascades after push disable and required provider revocation. Prior physical deletion verified user-linked rows absent. No universal age-based purge. | No new destructive test performed; successful live deletion is not all-copy erasure |
| B — Render database recovery | Authenticated dashboard: My Workspace **Hobby**, caloriebank-beta-db **0.1c-256mb**, Recovery offers any timestamp in past **3 days**. Export panel says exports retained **at least 7 days**. No export/restore created. | No inventory of downloaded/off-platform exports; deletion-aware restore procedure not yet approved |
| C — runtime/service logs | Official Render documentation: Hobby dashboard logs **7 days**; Pro 14 days, Scale/Enterprise 30 days. Live workspace Hobby verified. App logger records request path/status/timing and error metadata with key redaction. | This is dashboard log availability, not proof of erasure from every internal security system. External log streams/exports not independently verified |
| D — Clerk | Live identity deletion API is implemented. Official dashboard-log documentation: Application Logs Hobby 1 day / Pro 7 days / Business 30 days / Enterprise custom; Admin Logs Business 30 days / Enterprise custom. | Clerk dashboard currently sign-in; actual plan/overrides not verified. User deletion does not establish audit/backup erasure timing. Seek account-specific support confirmation before any numeric per-user promise |
| D — Expo | Payload held in memory/queues for delivery, not notification-content database; receipts cleared after 24 hours. Tickets indicate acceptance, receipts provider handoff, not necessarily physical delivery. | Not a 24h erasure promise for all Expo operational data. CalorieBank separately persists ticket/status rows until account cascade |
| D — FCM | Undelivered message default up to 4 weeks absent TTL. Firebase installation IDs retained until explicit ID-deletion API; documented removal within 180 days after that call. | CalorieBank account deletion removes server push registration; no Firebase installation-ID deletion call found. Do not start a 180-day clock at CalorieBank deletion. Device installation identity may be reused across accounts |
| D — APNs | Apple documents undelivered storage up to 30 days or specified earlier expiry. | Delivery queue lifetime is not all Apple log retention; no recall of accepted payloads verified |
| E — original provider data | Fitbit/FatSecret/Cronometer accounts and Apple Health/Health Connect records remain independently controlled. | CalorieBank deletion is not a request to delete the user's original external diary/account |

Existing `apps/api/src/modules/morning-bank-update/morning-bank-update.service.ts`
ExpoPushTransport sends no ttl/expiration. Expo describes omitted TTL as provider
default (4 weeks); Apple independently documents up to 30 days. Record the distinction,
not a single precise end-to-end deadline. No notification semantics changed.
Registration cleanup prevents subsequent server targeting; it does not prove recall
of a message already accepted by a platform queue. No new delivery defect claimed.

Clerk's DPA section9 describes deletion within 90 days after **agreement termination**
for defined Customer Personal Data. It is not a per-user delete SLA; its definitions
also distinguish Account Information. No legal-role classification or acceptance is
made by reading the document.

Public candidate uses concise categories: live records removed on successful
deletion; backup/log and independent service copies can remain. It does not promise
instant purge, a universal 30-day period, or that every copy is deleted automatically.

## Official sources checked

- [Render backups/PITR](https://render.com/docs/postgresql-backups)
- [Render runtime log retention](https://render.com/docs/logging)
- [Clerk log plans](https://clerk.com/docs/guides/dashboard/logs/overview)
- [Clerk DPA — distinguish termination from user deletion](https://clerk.com/legal/dpa)
- [Expo payload handling](https://docs.expo.dev/push-notifications/faq/)
- [Expo receipts and TTL](https://docs.expo.dev/push-notifications/sending-notifications/)
- [FCM message lifespan](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan)
- [Firebase installation-ID retention](https://firebase.google.com/support/privacy)
- [APNs delivery storage](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns)

## Remaining operational review

Founder should confirm off-platform backups/log exports, Clerk plan and per-user
retention, service contracts, support-mail retention, and any applicable legal holds.
Approve a restore runbook that rechecks Clerk subjects/deletion records before
restored data serves users; do not silently re-provision deleted accounts from backups.
This is a proposed operational safeguard, not a newly implemented feature or public
promise. Do not retain a new permanent deletion ledger without approving purpose,
minimal contents and retention. No private records exported during this audit.
