# Verification — three-account and animation update

Verified on Friday 13 November 2026, Kuala Lumpur.

## 84 automated checks passed

- 29 Python backend/integration checks: all three named credentials, inferred roles, mismatched role/password rejection, rate limiting, repeated successful account switches, session expiry/revocation, role-specific page redirects, staff/driver/student permissions, student ownership, cross-device booking recovery, cancellation/rebooking with invalidated old tickets, source-file privacy, and the existing reservations/forecasting/parking/maintenance/delivery behavior. HTTP checks use real local requests and temporary databases; Gemini and external webhooks are mocked.
- 8 account-workspace checks: per-username browser storage, restoring only owned bookings, planning another ride without an unwanted background selection, preventing live role navigation, preserving the separate staff guided demo, clearing mismatched sessions, reduced-motion scrolling and stable focused navigation during refresh.
- 12 interface checks from the professional redesign.
- 10 existing live-workflow checks, including camera lifecycle and reviewed counts.
- 25 original guided-simulation checks.

JavaScript syntax checks and Python compilation passed. The final archive is verified against a SHA-256 manifest, ZIP integrity and SQLite database integrity. A clean extracted copy is checked for session-schema migration and all three credentials.

## Observed browser flows

- Dedicated login page at desktop size and 360/390-pixel mobile viewports.
- Correct student sign-in, fixed account-bound TP123456 identity, reservation creation and automatic booking recovery after another sign-in.
- Student-only navigation, boarding pass and mobile layout without horizontal overflow.
- Sign-out via sidebar and profile dialog, then APU staff sign-in to a staff-only sidebar.
- Staff check-in of the student booking and creation of a backup request.
- Bus driver sign-in, driver-only active/history navigation and acceptance of that request.
- A driver navigating directly to the staff URL was redirected to the driver workspace.
- Mobile staff navigation showing only the five staff workspaces, without student or driver navigation.
- Client-side empty-password validation and no browser console errors during tested flows.

The login illustration, button states, dialog/panel entrances and hover transitions are implemented in CSS. Reduced-motion media rules disable decorative animations; the scrolling preference is covered by an automated check. Physical mobile hardware and OS accessibility settings were not changed during testing.

## Data and external checks

Browser tests used an isolated preview database under work; its temporary records are excluded from the delivered project. The project database and original Desktop source are preserved. Account defaults are explicitly documented as local demo credentials in DEMO_ACCOUNTS.md and are overridable through environment settings.

Physical laptop-camera testing remains deferred at the user's request. Real Gemini counting/accuracy needs the user's key and real images. Physical QR/card readers, external driver messaging and public deployment were not tested or claimed.

Local forecasting update: 36 Python tests and 56 JavaScript checks passed (92 total). Staff Insights verified in the browser against the local project, including unknown demand and bookings-only states. Camera integration remains deferred. The forecast planning band is uncalibrated; real-world accuracy requires collected observations.

Continuous campus experience: 60 JavaScript workflow checks passed, including four new checks covering arrivals across views, playback through events and dispatch, traffic intensity, and staff navigation preserving simulation. Browser verified automatic start, student/operations navigation, continued clock progression, and 211 generated requests / 172 boardings in a local run. No live booking or dispatch writes were made by this simulation. Existing 36 Python checks passed in the preceding backend update; backend code was unchanged in this update.


Shared simulation extension: 68 JavaScript workflow checks passed, including eight new cases for driver acceptance/decline, demo driver navigation, exact lecture burst size, delayed boarding, closure/reopening, actual wait and backup usage, and combined backup/delay behavior. Browser verified request handoff, acceptance, delayed regular boarding, completed backup boarding and shared student updates. Example browser run: 263 boarded, 20 backup seats used, 4.7-minute served-passenger mean queue wait. This example is simulated and not an accuracy claim. Backend unchanged.

Bug audit, 13 November 2026: 36 backend tests and 73 frontend workflow checks passed (109 total). Reproduced and fixed delayed bus vehicle identity, crowd panel departure inconsistency, stale simulated driver/student details after reset, and unchanged driver inbox being rebuilt on each draw. Added four regression checks and a three-service-day mixed-event stress check. Browser verified delayed boarding and navigation, stale driver cleanup after switching to fixed walkthrough, and no console errors during that run. Camera/provider integration remains untested.
