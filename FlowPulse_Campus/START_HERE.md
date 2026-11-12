# Start and demonstrate FlowPulse Campus

Target: Friday 13 November 2026, noon Kuala Lumpur.

The new interface uses Operations, Student rides and Driver hub navigation (a bottom bar on mobile). Staff access is behind the profile button at the top right. Operations tools are grouped into Overview, Departures, Observations, Check-in and Insights. The data selector switches between Live workspace and Guided demo. Times use the 24-hour clock in Kuala Lumpur.


## 1. Run the updated project

Extract the ZIP into a new folder, open FlowPulse_Campus, then double-click **Start_FlowPulse.cmd**. It uses the Python 3.12 installation found on this computer, or falls back to the Python launcher.

When asked for a Gemini key, press Enter to skip it for now. The key, if entered, is hidden and kept only in the running process. The launcher does not save it to a file. The server prints a different temporary password for Staff and Driver. Open http://localhost:8000. Keep the terminal open; Ctrl+C stops the server. The original Desktop project has not been overwritten.

If the launcher cannot find Python, run this from the extracted project folder:

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" launcher.py
```

Or use your installed Python 3.10+ interpreter. No pip install is required. Do not double-click index.html for live bookings.

## 2. Demonstrate the shared student/staff journey

1. In Student rides, choose your starting stop, enter a student ID, select a departure and click Reserve my seat.
2. Keep the private booking code. The browser also stores up to 20 bookings on this device. Refresh the page: the active booking returns automatically.
3. Click Show QR ticket. On another device, use Recover a booking with the same student ID and private code. Those two values act as the booking credentials; never share them publicly.
4. Open Operations and use the top-right profile button to sign in as Campus staff using the terminal password. The main stop cards, forecasts, parking cards and reservation totals all use the same backend.
5. Open the Check-in tab. Scan a FlowPulse QR or select a reservation and enter/scan the student's matching ID. Confirm check-in. The Students page updates on its next poll.
6. For physical barcode readers that type like a keyboard, focus the scan field and scan. QR/barcode camera support depends on the browser's BarcodeDetector API. Unsupported browsers retain keyboard/paste entry. This matches a booking, not a university identity database, NFC reader or face identity.

Reservations close and unchecked bookings expire exactly five minutes before departure. A maintenance worker checks every ten seconds; requests also perform maintenance before using data. Capacity is released without a check-in attempt. Checked-in bookings transition to Departure recorded at their scheduled time, and Scheduled journey complete twenty minutes later. These labels describe timetable progress, not verified physical boarding or GPS arrival.

The rolling timetable covers the next two service days, Monday–Friday, 06:00–22:00 MYT, every ten minutes. Maintenance is idempotent and skips weekends. Existing old prototype records are preserved; legacy out-of-hours departures are not listed for new bookings.

## 3. Driver request and acknowledgement

In Operations, Request a backup shuttle on a stop card. The request appears in Driver hub within four seconds. In a separate browser profile or device, sign in as Driver, accept when a vehicle is available, then mark arrival/task completion. Staff can also access the driver workflow for a single-computer presentation.

A requested backup adds zero seats. Acceptance adds 75 seats once. Duplicate active requests for the same departure and repeated acceptance are rejected. Requests not accepted before departure expire; accepted/arrived tasks are marked complete at departure by the timetable. An optional Enable desktop alerts button requests notification permission for new requests while this page is open. The persistent inbox remains available without notifications.

Use Guided demo for simulated shuttle scenarios. Live workspace support requests use driver acknowledgement. Vehicle availability is confirmed by the driver, not a fleet inventory or GPS service.

## 4. Laptop camera (test later on your laptop)

Physical camera testing is deferred at the user's request. All other work can be demonstrated on the desktop.

When ready, start the server with a Gemini API key, sign in as Campus staff, open Observations, then click Start laptop camera. Allow camera access in your ordinary browser. Preview stays on the device. Analyze camera frame sends one JPEG frame to Gemini. Start 30-second analysis sends another frame only when no count awaits review. Save reviewed count records the reviewed/edited count; Discard count allows another analysis. No automatic count writes occur.

Stop camera stops the media tracks and periodic sends. Leaving Office, hiding the tab or signing out stops camera capture. Permission requests time out after fifteen seconds; a camera granted later is immediately released. Stop cannot retract an image already submitted to Gemini. QR scanning uses the same camera exclusively. Uploaded JPEG/PNG/WebP snapshots up to 3 MB are also supported.

FlowPulse does not store images. Google handles submitted frames under your Gemini API account terms. Observations record the analysis request time, not the file's original EXIF capture time, so upload only current stop snapshots. Reviewed counts older than fifteen minutes are rejected. Camera counting can be wrong under occlusion and requires staff review. No identity recognition is requested.

Set environment variables before running server.py if you prefer:

```powershell
$env:GEMINI_API_KEY = "your key"
$env:GEMINI_MODEL = "gemini-2.5-flash"
python server.py
```

Model availability and quota depend on your Google account. Reference: https://ai.google.dev/api/generate-content . Camera permissions require localhost or HTTPS. Browser support references: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia and https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API . This build supports a laptop/USB camera through the browser; RTSP or a direct CCTV network connection is not included.

## 5. Demand forecasting and real historical data

Forecasts use a fresh observation (up to fifteen minutes old), recent nonnegative net queue growth, a matching weekday/time-of-day historical average, and a reservation floor. They do not add bookings to camera counts. They project each departure in order and subtract its capacity before the next forecast. Camera-based extrapolation stops beyond one hour; farther departures use matching history and bookings. With both camera and history, weights are 65% recent projection / 35% history. These are prototype assumptions, not calibrated ML weights.

The history uses one observation per matching historical date within fifteen minutes of the target time to avoid overweighting frequent cameras. Confidence remains low without a fresh near-term camera reading and at least three matching historical days. Net queue growth is not a true arrival rate; boarding and occlusion can distort it. Suggestions are advisory and never dispatch automatically.

Import real observations in the Insights tab as a JSON array (1–1000 per request), for example:

```json
[{"stop":"L","people":42,"created_at":"2026-11-06T08:00:00+08:00"}]
```

The row above is a format example, not measured data. Do not use invented rows to claim accuracy. Each row must have stop L/C, integer people 0–5000 and a past timezone-aware timestamp. Duplicate stop/timestamp records are skipped; invalid files are rejected atomically. Reviewed camera and manual counts accumulate history automatically. No synthetic history is seeded.

Click Check forecast accuracy for a rolling ten-minute backtest: mean absolute error, RMSE, bias and a persistence baseline. It trains each target only on observations available when that prediction would have been made. It evaluates at most 100 eligible targets from the latest 200 records and needs at least five targets with preceding observations. Demo sources are included and explicitly labeled. More real history is still needed to establish real-world accuracy.

## 6. Configuration and external delivery

Optional environment variables:

| Variable | Purpose |
|---|---|
| FLOWPULSE_STAFF_PASSWORD | Fixed staff password instead of a per-run temporary one |
| FLOWPULSE_DRIVER_PASSWORD | Fixed driver password |
| GEMINI_API_KEY / GEMINI_MODEL | Server-side Gemini configuration |
| PORT | Server port (default 8000) |
| FLOWPULSE_DB | Alternate SQLite database path, useful for isolated demos |
| DRIVER_WEBHOOK_URL | Optional HTTPS endpoint receiving driver requests |
| DRIVER_WEBHOOK_TOKEN | Optional bearer token for that endpoint |
| FLOWPULSE_SECURE_COOKIE | Set to 1 only behind HTTPS |

Passwords are verified using salted scrypt; session tokens are stored as hashes. Sessions expire after eight hours and are revoked when the server starts. Staff-only endpoints reject students and drivers. Public state omits reservation codes, student identities and event logs. Student access is still a demo ID plus a private booking code, not university SSO. Keep private codes off shared screenshots. There are shared Staff and Driver roles, not individual employee accounts.

Driver inbox delivery works locally without an external account. An optional webhook sends a backup_requested JSON event with dispatch_id, departure_id, stop, departs_at, seats and message. It has a persistent outbox, up to five attempts, two-minute retry leases and an Idempotency-Key header; receivers must deduplicate that key. A successful webhook is delivery only, never vehicle acceptance. Redirects are not followed and external destinations must use HTTPS (localhost HTTP is allowed for tests). No real external webhook was configured or contacted in verification. SMS, WhatsApp and Telegram need your chosen provider/bridge; this package does not silently sign you up or send messages.

The default server listens only on this computer. Actual phone/driver-device access needs a reachable host and a properly configured HTTPS deployment. Setting FLOWPULSE_HOST changes the bind address, but authentication, TLS, device networking and deployment still require review before public exposure. The responsive UI was checked at 390 px; this was not a real-phone hardware test.

## 7. Data and switching modes

The package preserves a consistent copy of the source demo database. Verification used a working copy; its temporary test bookings and sessions are excluded from the delivered database. SQLite schema upgrades run automatically. To start a separate demo, point FLOWPULSE_DB at a new filename. Back up the database before changing it; use SQLite backup or stop the server first.

Use the data selector → Guided demo to show the original 161-student walkthrough. It has its own clock, queues, maps and reference reports. Switching back restores the shared live screens and keeps live database records. The simulation never populates the live forecast history automatically.
