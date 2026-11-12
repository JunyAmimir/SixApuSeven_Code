# FlowPulse: professional interface and feature update

The current three-account login behavior is documented in [ACCOUNT_UPDATE.md](ACCOUNT_UPDATE.md). This document describes the underlying visual redesign.

## A calmer, clearer workspace

The app now has a coordinated slate-and-teal visual system, consistent typography, purpose-built line icons, lighter cards, clearer status hierarchy, a fixed desktop sidebar and mobile bottom navigation. A light/dark toggle remembers the device preference. The mobile header keeps the FlowPulse brand visible, and active boarding passes appear before the planning form.

Operations is split into Overview, Departures, Observations, Check-in and Insights. Sign-in now has a dedicated page, and account details live in a focused profile dialog. Each role has its own workspace. The check-in workspace includes a searchable booking roster. The driver hub uses clear request cards and a progress sequence.

The underlying booking, queue, parking, forecasting, Gemini and driver API behavior is preserved. Guided demo remains separate from live records. Neither network polling nor switching workspaces advances live bookings through the guided simulation.

## Useful additions

- Route cards and quick departure choices for student bookings, with duplicate-reservation feedback.
- Saved boarding passes, private booking-code copy and a Plan another ride action that retains existing bookings for recovery.
- Calendar download with Kuala Lumpur departure times converted correctly to UTC, a twenty-minute estimated trip and a reminder fifteen minutes before departure. Student IDs and private booking codes are excluded from calendar contents.
- A filtered departure board and CSV export of the visible upcoming schedule. Exported rows identify the live schedule as their source and exclude student identities and booking codes.
- A demand chart from recorded observations and eligible forecasts. It shows an honest empty state until observations exist; no example counts are inserted. Reservation-only figures are labeled Bookings only and are excluded from camera/historical forecast lines.
- Shared staff service notices with information, warning and disruption levels. Notices expire automatically or can be resolved, and are visible across student, operations and driver views. Posting/resolving requires staff permission.
- A staff activity timeline with readable event descriptions, improved connection feedback, confirmation before booking cancellation, and a local appearance preference.

## Quick tour

1. Start the app and open Student rides. Choose LRT station or Campus, select a departure and reserve a seat.
2. Open the boarding pass, save a calendar reminder or copy the private code. Refresh to confirm booking recovery.
3. Sign in as APU staff from the login page. Browse the Operations sidebar. The Check-in tab supports student-ID matching and the existing QR controls.
4. In Departures, filter a stop and Export schedule. This exports the upcoming board currently provided by the backend, not a full historical report.
5. Under Overview, expand Publish a service notice. Publish a short update and view it in Student rides. Resolve it when finished.
6. Request a backup from a station card and sign in as Bus driver to acknowledge it; staff can track progress in Operations.
7. Use Guided demo for the preserved fixed congestion scenario. Physical laptop-camera checks remain deferred until the user is on their laptop.

## What is and is not demonstrated

Browser verification used an isolated local preview database. Its temporary booking, backup request and service notice are not included in the project database. Preview screenshots show local verification data, not measurements of campus traffic. No real Gemini request, camera hardware test, SMS delivery or public deployment is claimed. API credentials and real historical data are still needed for those integrations and accuracy checks.

The source Desktop project is unchanged. The delivered project preserves a consistent copy of its existing database and upgrades its schema when started. Extract the new ZIP to its own folder and run Start_FlowPulse.cmd. If an older version is already running, stop it first.
