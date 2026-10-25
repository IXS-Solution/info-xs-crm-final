# CRM feature QC and load test

Tested 25 October 2026 on the local production Worker build, using an isolated D1 database and R2 bucket in `/tmp/crm-qc-state`. No live customer records or hosted services were load-tested. Publication has not occurred: the required Sites source-workflow helper is absent from this environment.

## Implemented features

- Product comparison for two or three offerings: vendor, brand, category, model, pricing/unit, specifications, warranty, availability and suitability. The salesperson can record the client requirements, choose a recommendation and carry it into a proposal. Missing information stays explicitly unrecorded; the app does not invent specifications or recommend a cheapest product automatically.
- Contact, company, vendor and product imports from CSV and Excel `.xlsx`, including column mapping, editable preview, atomic saving and duplicate skipping. New contact companies are linked or created. Owner permissions apply to vendor/product imports. Stable import IDs prevent duplicate simultaneous imports.
- English visiting-card OCR from JPEG/PNG/WebP, PDF text extraction and OCR fallback for scanned PDFs. Extraction runs in the browser with bundled local worker/model assets; fields must be reviewed before saving. PDF layout is not a reliable schema: complex documents may need row corrections. Limits: 10 MB input, 20 PDF pages and 200 imported rows per batch. Excel `.xls` is not supported; save as `.xlsx` or CSV.
- Durable vendor literature storage in R2, with optional product links. PDF/PNG/JPEG brochures up to 10 MB can be selected for proposals. Approved/sent proposals can download a ZIP containing printable `Proposal.html` and the original selected brochures. The existing print/save-PDF action remains available. Brochures are separate enclosures, not merged into the proposal PDF. Attachment downloads require CRM access; clients receive exported files.

## Functional results

All **26 test groups** passed: 5 unit, 8 API, 9 browser and 4 boundary checks. TypeScript and the production build passed.

- **Unit:** shared company linking, duplicate handling scoped by company/email, all-or-nothing validation, permissions, product price/vendor validation and card extraction.
- **API:** anonymous/unregistered access denial; staff/customer import and catalogue restrictions; import atomicity/limits/duplicates; ten simultaneous identical imports creating exactly one contact and company; upload permissions/vendor/product/file-type validation; authenticated byte-for-byte brochure download; proposal totals and approval permissions; brochure retention; stale-version rejection.
- **Browser, real Chromium:** two/three-product comparison and recommendation transfer; quoted CSV mapping/preview/save; actual `.xlsx` parsing/save; actual PDF extraction; image-card OCR; scanned-PDF OCR; vendor upload/list and proposal brochure selection; ZIP contents/original brochure bytes; mobile page overflow. No uncaught page errors.
- **Boundaries:** oversized brochure rejected; nonexistent brochure references rejected; literature metadata cannot bypass the upload endpoint; invalid email and unregistered product vendors rejected.

Details: `api-load-results.json`, `browser-results.json`, `boundary-results.json`.

## Load results

Initial read bursts: 250 authenticated full-CRM reads at each concurrency level, **750 requests, zero errors**.

| Concurrent clients | Requests/sec | p50 | p95 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| 5 | 211 | 21 ms | 43 ms | 72 ms |
| 20 | 226 | 83 ms | 163 ms | 164 ms |
| 50 | 236 | 186 ms | 367 ms | 375 ms |

Larger mixed workload: over 1,100 starting records, including 1,000 imported contacts, the product catalogue and QC fixtures. Three ten-second stages issue a write every twentieth request per client when reached; other requests read the complete CRM. The runtime debugger was disabled for this measured run.

| Concurrent clients | Reads | Writes | Errors | Requests/sec | p50 | p95 | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5 | 870 | 45 | 0 | 91 | 54 ms | 72 ms | 117 ms |
| 20 | 942 | 40 | 0 | 96 | 207 ms | 246 ms | 270 ms |
| 50 | 1,001 | 48 | 0 | 100 | 486 ms | 638 ms | 724 ms |

**2,946 mixed requests passed; 3,696 successful requests across the two measured suites.** These are local measurements, not a production capacity guarantee or an extended soak test. Hosting, network latency, resource limits, larger datasets and actual OCR devices still affect results. The CRM currently retrieves the complete record set; pagination should be considered for substantially larger workspaces.

An earlier debugger-enabled mixed run exhausted the local runtime heap during the 50-client stage. The complete workload passed after disabling the local debugger through Wrangler's supported programmatic API; the debugger proxy's observed resident memory was much lower afterward. The initial failure is retained in `sustained-load-initial-failure.json`; its post-crash connection-refusal attempts are not successful throughput. The exact internal retention mechanism was not established. This does not prove a hosted memory defect or hosted capacity. `qc/server.mjs` uses the debugger-disabled configuration for reproducible load testing.

## Corrections made during QC

- Stable import identities and `INSERT OR IGNORE` protect against concurrent duplicate imports without overwriting existing records.
- Uploads consume a bounded multipart body before returning permission errors, fixing a repeatable follow-up-request failure in the local runtime and bounding chunked request sizes.
- Authentication/database context moved into a shared server module instead of exporting a helper from an API route.
- Excel and PDF readers use the APIs provided by the installed versions; TypeScript and browser tests caught and verified the integration differences.

## Reproduction

Use only a disposable local database. `qc/api-and-load.mjs` expects a newly migrated, empty QC database and seeds synthetic fixtures; it must not be pointed at production. Tests intentionally create synthetic records and upload documents.

1. Install locked dependencies and run `npm run crm:assets` if refreshing the bundled PDF/OCR assets.
2. Run `npm run qc:unit`, `node node_modules/typescript/bin/tsc --noEmit` and `npm run build`.
3. Apply `drizzle/0000_short_tag.sql` with Wrangler `d1 execute DB --local --config dist/server/wrangler.json --persist-to /tmp/crm-qc-state --file drizzle/0000_short_tag.sql`.
4. Start `npm run qc:serve`. If the host's Wrangler config directory is unavailable, set `XDG_CONFIG_HOME` to a writable temporary directory for that command. The server binds only `127.0.0.1:5180` and disables the debugger.
5. Run `npm run qc:api`, then `npm run qc:load` and `npm run qc:boundaries`.
6. Generate fixtures with `python qc/create-fixtures.py` (requires openpyxl, reportlab, Pillow and the DejaVu font). Run `npm run qc:browser` with Playwright available; `CRM_QC_PLAYWRIGHT_MODULE` and `CRM_QC_CHROMIUM` can select an installed Playwright module and Chromium binary. The browser suite removes/recreates only its known synthetic contact emails.

The QC server uses local identity headers to simulate hosting-owned authentication. Production identity headers must continue to be supplied by the hosting layer. Existing Site identity, owner/access policy, approval flow and database schema are preserved; the hosting manifest adds the `BUCKET` R2 binding, to be provisioned at publication.

## Remaining release step

The deployed Site has not been updated. The Sites skill requires source synchronization and packaging with its `scripts/site-workflow.mjs` helper before publishing. That helper is not installed anywhere in the selected environment. Source and build output are ready locally; publication and a hosted smoke test remain blocked until the supported helper is available. No claim of live availability is made.
