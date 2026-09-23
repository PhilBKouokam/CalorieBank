# CalorieBank public legal resources

Publication authorized by founder September 19, 2026. Published to isolated Vercel production hosting.

- Privacy: https://caloriebank.philbk.dev/privacy
- Account deletion: https://caloriebank.philbk.dev/delete-account
- Operator: Near Future I-X
- Contact: CalorieBank Support, support@caloriebank.philbk.dev (send/receive verified)

`web/legal/` is an isolated static Vercel deployment directory containing only the
consumer HTML, shared CSS and static hosting configuration. It has no dependencies,
JavaScript, analytics, account access or API connection. Clean URLs expose the two
HTML files. Existing app/portfolio projects must not be reconfigured for this site.
The Markdown sources remain in `docs/legal/`; HTML text must stay equivalent.

Publication text preserves the approved current advertising, audience, policy-change,
retention and external-data distinctions. Retention is intentionally qualitative:
verified three-day Render recovery and seven-day Hobby dashboard logs are internal
configuration evidence, not a universal all-provider erasure deadline.

External deletion requests use the founder-approved identity-verification and ordered
service procedure in [publication readiness](../legal/publication-readiness.md).
No new deletion implementation or production data modification is part of publication.

Health Apps categories remain Nutrition and Weight Management plus Activity and
Fitness. Play Health Connect scope remains READ_NUTRITION; direct Fitbit provides
burn/activity. No Google declaration is submitted by publishing these resources.

## Verification

Local preview: 320px privacy/deletion screenshots inspected; text wraps without
horizontal overflow. Semantic heading/main/navigation and support/cross-links checked.
390px deletion rendering also checked, with keyboard-focusable skip link. Both pages
have one H1, semantic main/navigation, English language metadata, visible focus styles
and wrapping support links. This is basic accessibility QA, not a formal audit.

Deployment: `dpl_FSSbUbDeWpiroAzjjq3tb4tb5YUt`, project `caloriebank-legal`.
Artifact: https://caloriebank-legal-iscndmc1m-philbkouokams-projects.vercel.app
No application build or API/lifecycle deployment. Four static files uploaded.

Both custom-domain GET requests returned HTTP 200 with TLS verification result 0
against Vercel's verified public IP (no authentication/cookies). Local negative DNS
caching initially required curl --resolve; Cloudflare's public resolver returned both
new addresses. Public bodies were compared to repository HTML.

Only additive A records at `caloriebank.philbk.dev`: `216.198.79.1`, `64.29.17.1`,
as recommended by Vercel's domain verifier. No CNAME was added at the mail hostname.
MX, SPF, DKIM, DMARC and Clerk mail CNAME checked unchanged through public DNS;
portfolio GET remained HTTP 200. Mailbox send/receive evidence remains valid from the
same day's test; no extra test email was sent during web deployment.

## Future publication updates

Edit approved Markdown and corresponding static HTML together; verify equivalent text,
links and mobile rendering. Deploy only `web/legal` to `caloriebank-legal` using the
founder account and production target. Do not deploy the repository root/legacy app or
change portfolio, Clerk or Zoho records. Do not put credentials or internal audit notes
in this directory. Production custom-domain routes require no Vercel login.

Final browser QA used the public Vercel production alias because this Mac/Chrome
retained a negative DNS result for the new custom hostname. Deployed privacy at
390px and navigation to deletion passed without login; custom-domain HTTP/TLS
verification used the public DNS-resolved IP explicitly, with certificate validation
enabled. The initial local-resolver propagation limitation is not concealed.

Validation: public-body byte comparison, placeholder/internal-annotation scan, local
document links, HTML semantics, cross-links and git diff --check passed. No app release
gate was run because only static web and documentation files changed. Existing Data
Safety legal classifications remain review items; published statements do not assert
that infrastructure transfers are universally excluded from Google's sharing definition.

## September 23 approved Manual Intake clarification

Founder explicitly approved the exact calorie-estimates paragraph and publication.
The HTML and Markdown policy now carry September 23, 2026. Published through the
existing isolated project: `dpl_6mEwxhXcBo8FQDxehwP5Uqxb6vwX`, artifact
https://caloriebank-legal-7t8s6730s-philbkouokams-projects.vercel.app.
Public policy matched repository bytes; deletion page remained byte-identical.
320px paragraph wrapping and no horizontal overflow verified. No DNS, portfolio,
Clerk, mail, app release or store declaration changes accompanied publication.
