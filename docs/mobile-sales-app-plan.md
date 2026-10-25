# Sales mobile app plan

Status: proposed next phase, not implemented. The current CRM additions are a browser-based comparison, import/OCR and brochure workflow. They do not yet provide a native app, offline visit capture, background sync or live team-wide updates.

## Goal

Let sales staff record accurate customer and visit information while visiting clients, and make submitted updates available to the office through the same CRM backend.

## Proposed first release

- Sign in with an individual staff account and see assigned customers, leads and upcoming visits.
- Open a customer before a meeting and record discussion notes, requirements, opportunity stage, outcome and the next follow-up.
- Scan a visiting card with the phone camera, review its fields and link the contact to the customer.
- Compare two or three catalogue products, record a recommendation, and attach the relevant product brochures to a proposal draft. Keep the existing approval requirement before client delivery.
- Save each visit with the salesperson, customer and capture timestamp. Show successful submission, pending sync and failed submission distinctly.
- Refresh office dashboards after synchronization. Use push updates or bounded polling according to the hosting architecture; an ordinary save alone does not make other open screens update in real time.

## Agreed GPS visit verification and fuel review

GPS verification is a confirmed requirement for Android and iPhone. Staff must see what is collected, why it is collected and when capture occurs, and grant the operating system's location permission. Request location only for explicit visit check-in/check-out; do not collect covert or continuous background location or track staff outside those actions. Background synchronization may transmit an already captured visit, with visible pending/synced status; it must not take additional hidden GPS readings.

At each action, record the visit/customer ID, authenticated staff identity, check-in or check-out event, coordinates, horizontal accuracy, device capture timestamp and server receipt timestamp. Display capture success, permission denial, approximate location, stale readings and unavailable GPS honestly. Missing or inaccurate location needs a visible explanation/manual review path rather than a fabricated coordinate or an automatic misconduct finding.

Offline visit events and their location readings must survive an app restart and synchronize later with stable operation IDs. Keep the original capture time and accuracy; never substitute the phone's later synchronization location for the visit location. Protect on-device drafts and restrict server access to each employee's own visit records and authorized reviewers.

Manager-only fuel review should relate claimed dates, visits, start/end odometer readings, mileage, fuel quantity/cost and any receipts. Show verified visit points, odometer-derived distance and any separately labeled route estimate alongside the claim. Two GPS points do not establish the route driven, fuel consumed or the truth of a claim. Do not automatically reject a claim from straight-line distance, poor GPS accuracy, offline delay or absent location alone.

Fuel-review dashboards, comparisons, flags and reviewer comments remain restricted to authorized managers/admins through server-side checks, including exports and direct API requests. Employees can see their own capture/sync status and the information collected about their own visits; they cannot see other employees' locations or manager-only review reports. Log reviewer decisions and corrections. Define a documented retention/deletion schedule and approved reviewer access before release; no indefinite retention or new continuous-tracking purpose is assumed.

## Connectivity and reliability

Offline capture and later synchronization are confirmed requirements. Retain unsent drafts and a durable upload queue on the device; show an offline indicator and sync status. Use stable operation IDs so retries cannot duplicate a visit. Preserve both capture time and server receipt time, and prompt for conflicts when another user changed the same record. Do not discard an unsynced draft on a failed upload, navigation or token expiry.

Before adding device storage, define draft retention, sign-out behavior and recovery for shared/lost devices. Avoid caching customer records globally in a service worker. Brochure/image uploads need retry and size controls, and should not silently consume mobile data in the background.

## Delivery options

1. An installable mobile web app can reuse the CRM UI/backend and serve Android and iPhone from a single codebase. Camera access works over HTTPS. Background sync, notifications and installation behavior vary by browser and operating system and must be tested on actual devices.
2. A cross-platform native app is appropriate if app-store distribution, stronger device integrations or more predictable background behavior are required. Keep the same backend and permission model rather than maintaining a separate customer database.

Android and iOS are confirmed target platforms, including offline capture and later synchronization. A cross-platform native app is the recommended direction for reliable on-device drafts and upload queues on both platforms. The delivery technology has not been finalized.

## Backend prerequisites

The present CRM uses hosting-supplied ChatGPT identity headers. A native client cannot safely invent those headers. Define a supported mobile sign-in/session or token flow first, with server-side ownership enforcement for assigned customers and leads. Preserve owner-only catalogue management and proposal approvals. Add pagination/incremental reads for larger workspaces, authenticated document access and explicit sync conflict handling.

Keep database migrations additive and validate compatibility with the newer repository main branch before merging this feature branch. The current source checkout and its recorded QC results represent an earlier baseline; they do not validate newer main-branch changes.

## Acceptance checks for the mobile phase

- Capture and submit a visit and card scan on both real Android and iPhone devices.
- Verify that a staff member cannot read or modify another salesperson's restricted records.
- Confirm that the office sees submitted updates within an agreed refresh interval, and distinguish device capture time from server submission time.
- Airplane-mode capture, app restart, reconnection, expired login, failed photo upload, duplicate retry, and concurrent edits must preserve data and show a clear outcome.
- Test location permission granted/denied/revoked, approximate location, no GPS fix, stale readings, inaccurate fixes and offline check-in/check-out on both platforms. Confirm no location capture occurs outside explicit check-in/check-out, including while synchronizing or after sign-out.
- Verify capture timestamps/accuracy survive offline synchronization and duplicate retries. Attempt manager-only fuel-report API/export access with staff accounts, and confirm reviewer decisions and manual exceptions are audited.
- Test the complete approval/proposal/brochure journey, mobile accessibility, poor connectivity, battery/data use and realistic concurrent traffic.

Live publication of the CRM additions remains separate from saving their source to GitHub. See `qc/REPORT.md` for completed local checks and publication limitations.
