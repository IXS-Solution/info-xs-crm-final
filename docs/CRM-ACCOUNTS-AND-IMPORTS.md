# Staff accounts and Excel contact imports

These features currently target the repository's Cloudflare Workers + D1 runtime.
They do not convert the application to a Plesk Node.js/MySQL deployment. The old
ChatGPT identity headers no longer grant CRM API access. Staff must activate a
CRM account and sign in at `/login`.

## Install and validate

Use Node 22.13+ and the pinned pnpm 11.25.0. In the existing checkout:

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm test
pnpm run build
```

Tests run actual route handlers against workerd/D1 with a mocked email transport;
no real invitation email is sent. A real `.xlsx` fixture also verifies parsing.

## Database migration

Apply `drizzle/0001_wakeful_randall_flagg.sql` once to the same D1 database that
contains the existing CRM tables. Preserve the existing records. On a new database,
apply `0000_short_tag.sql` first. The generated Drizzle journal and snapshot include
the new users, sessions and rate-limit tables.

For local development, build first, then run the following for each unapplied file:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_wakeful_randall_flagg.sql
```

Use the production host's migration workflow for the production database. Do not
run a local-only command and assume the hosted schema has changed.

## Configure invitation email and administrator

Set these server-side bindings in your hosting environment (or ignored `.dev.vars`
for local Workers development). Never commit credentials:

- `CRM_PUBLIC_URL`: `https://crm.info-xs.com` after DNS and TLS are working.
- `CRM_ADMIN_EMAIL`: `info@info-xs.com`.
- `CRM_EMAIL_FROM`: a sender on a domain verified with Resend, for example
  `Info-XS CRM <crm@info-xs.com>`.
- `RESEND_API_KEY`: a secret API key with sending access. Outbound HTTPS to
  `api.resend.com` must be permitted.
- `CRM_SETUP_TOKEN`: a randomly generated secret, used only for initial setup.

Resend is the implemented transport. Plesk SMTP is not implemented; use a verified
Resend sender or add an SMTP transport in a separate hosting adaptation. Missing
email configuration produces an explicit error and leaves a pending account that
an administrator can retry with **Resend invitation**. No activation token is
returned to the browser or logged.

With those bindings configured, make one same-origin POST to
`/api/auth/bootstrap`, with `Origin: https://crm.info-xs.com`,
`Authorization: Bearer <CRM_SETUP_TOKEN>`, `Content-Type: application/json`, and
body `{}`. Supply the authorization value from a secure variable, not a committed
script or command containing the secret. This creates and emails the initial
administrator. If delivery fails, the same setup request can resend its invitation
while the administrator is still pending. Once activated, bootstrap cannot create
another administrator. Remove the setup-token binding after successful activation.

The administrator opens the email link, sets a password of 12–128 characters, then
signs in. Under **User management**, create staff accounts and send invitations,
resend pending invitations, and disable or re-enable accounts. Accounts must use
exactly `@info-xs.com`; external addresses and subdomains are rejected server-side.
Links expire after 24 hours, are single-use, and resending invalidates the old
link. Disabling revokes sessions immediately. Sessions last eight hours and use
Secure, HttpOnly, SameSite cookies. HTTPS is required, including local auth testing.

Team employment profiles remain separate from login accounts. Create an active
Sales team profile with the matching email to assign a salesperson to leads,
activities and proposals. Disabling portal login is done in User management;
changing an employment profile alone does not revoke login access. Password reset
for an already activated account is not included in this release.

## Excel contact import

Under **Companies & contacts**, select **Import Excel**. Supported input is `.xlsx`
(up to 5 MB, 500 nonempty rows, first worksheet). Save legacy `.xls` files as `.xlsx`
first. The downloadable CSV template opens in Excel; fill it in, remove the example
row, and save as `.xlsx`.

Required headers: `name`, `company`. Optional headers: `email`, `phone`,
`designation`, `role`, `whatsapp`, `notes`. Headers ignore surrounding spaces and
case. Format phone/WhatsApp columns as text to preserve leading zeros. Roles must
be `Influencer`, `Decision Maker`, or `Deal Cracker` (default: `Influencer`).

Existing companies match by name, ignoring case. Ambiguous company names block
import. Explicitly select **Create companies that do not already exist** to create
missing companies. Existing contacts and repeated worksheet contacts are checked
by email, or by name + company when email is absent. No records are saved until
all rows validate. A single D1 statement inserts the validated contacts and new
companies atomically. Concurrent imports should be serialized by the operator to
avoid inserting the same contact in separate simultaneous requests.
