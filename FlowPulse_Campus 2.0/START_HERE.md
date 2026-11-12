# Start and demonstrate the three-account version

## 1. Start the project

Extract the new ZIP into a new folder. Run Start_FlowPulse.cmd and keep its server window open. The browser opens when the server is ready; no camera key is required for normal startup. Keep the terminal open. Open http://localhost:8000, or the address printed by the server if PORT is configured. Stop an older server using that port before starting the new one.

If needed, use your installed Python 3.10+ interpreter. On this desktop the working command from the project folder is:

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" launcher.py
```

The original Desktop project is unchanged. Do not open index.html directly: sign-in and role permissions require the Python server.

## 2. Choose an account

Credentials are in DEMO_ACCOUNTS.md:

| Login type | Username | Password | Student ID |
|---|---|---|---|
| APU staff | apu.staff | APUstaff@2026 | — |
| Bus driver | bus.driver | Driver@2026 | — |
| Student | student | Student@2026 | TP123456 |

Select the matching account type, then enter the password. Passwords are case-sensitive and remain the same across restarts unless explicitly overridden. There is no university SSO or registration flow in this local demo.

After sign-in, navigation shows only the current account's workspace. Use the profile button or desktop sidebar to sign out. To demonstrate all roles simultaneously, use separate browser profiles, private windows or devices. Ordinary tabs in the same profile share cookies; switching accounts in one tab also changes that browser profile's session.

## 3. Demonstrate the full journey

1. **Student:** reserve a future shuttle. The student ID is fixed to TP123456. Show the QR ticket, download a calendar reminder or view My bookings. Refresh or sign in on another device: the account's own records return automatically.
2. **APU staff:** sign in separately, open Check-in, select the booking and scan/paste the matching ID or ticket payload. This checks the reservation; it does not authenticate a physical university card against university records.
3. **APU staff:** request a backup from a stop card. Its capacity stays unchanged while the request is pending.
4. **Bus driver:** sign in separately. Accept the request only when a vehicle is available; acceptance adds 75 seats once. Mark arrival and completion from the driver workspace.
5. **APU staff:** observe the updated capacity and request progress. Publish or resolve a service notice to inform all roles.

Only staff can change observations, parking, service notices or dispatch requests. Only drivers can respond to dispatches. Only students can reserve/cancel or retrieve their own tickets. Staff see the booking roster needed for check-in; drivers do not receive student reservation data.

## 4. Smooth navigation and account behavior

The login page has role cards, clear validation, a password-visibility control and a loading state. Account landing pages and staff panels use short entrance transitions, while buttons and cards respond subtly to interaction. Navigation and departure controls are kept stable when background polling returns unchanged data.

Reduced-motion preferences disable decorative motion and smooth programmatic scrolling. Camera streams stop on sign-out or when their workspace is left. Expired or changed sessions return to sign-in. Passwords are not stored in browser storage; session cookies are HttpOnly and SameSite=Strict. Session tokens are stored as hashes and expire after eight hours. A server restart revokes sessions but does not change account passwords.

Students can plan another ride without deleting an existing booking. Cancelled departures can be reserved again if still open, with a new ticket code; the cancelled ticket is invalidated. Client caches are scoped to the username, and the server always checks booking ownership.

## 5. Existing features

- Rolling weekday timetable: Monday–Friday, 06:00–22:00 MYT, next two service days, ten-minute intervals. The visible departure board shows the next twenty departures across both stops.
- Check-in closes five minutes before departure. Unchecked reservations expire and release capacity. The maintenance worker checks every ten seconds and requests also trigger maintenance.
- Checked-in bookings move through timetable-based departure and completion states. Those are scheduled states, not GPS-confirmed physical boarding or arrival.
- Calendar reminders are fifteen minutes before departure; the calendar does not include the private booking code or student ID.
- Staff can filter/export the upcoming schedule. CSV identifies its source and omits student identities and booking codes.
- Staff notices can be informational, a warning or a disruption. They expire automatically or can be resolved.
- Queue forecasts use reviewed observations, matching history and reservations without adding them together. Empty data is not displayed as an observed zero; reservations-only figures are labeled. Camera extrapolation stops after one hour. No artificial history is inserted.
- Staff Insights supports historical JSON import and a rolling ten-minute backtest against a persistence baseline. More real observations are still needed to validate accuracy.
- Guided demo is available only in the staff workspace. Its simulated student preview is separate from live student accounts and bookings.

## 6. Laptop camera and external delivery

Physical camera testing remains deferred until the user is on their laptop. When ready, configure GEMINI_API_KEY, sign in as staff and open Observations. Start laptop camera shows a local preview; analyzing a frame sends it to Gemini. Periodic analysis is opt-in and sends another frame only when no count awaits staff review. Saving records the reviewed count, not the image. Counts older than fifteen minutes are rejected.

Snapshots up to 3 MB (JPEG, PNG or WebP) are supported. Camera access requires localhost or HTTPS. Supported browsers can scan QR/barcodes; a keyboard reader or pasted payload remains available. Continuous RTSP feeds and NFC are not connected.

The driver inbox works without external services. DRIVER_WEBHOOK_URL and DRIVER_WEBHOOK_TOKEN optionally connect an HTTPS provider bridge. The outbox retries up to five times with a two-minute lease and an Idempotency-Key; the receiver must deduplicate. Delivery does not mean the driver accepted a vehicle assignment. No external provider was contacted in verification.

## 7. Configuration and data

Optional environment variables:

| Setting | Purpose |
|---|---|
| FLOWPULSE_STAFF_USERNAME / FLOWPULSE_STAFF_PASSWORD | Override the staff demo account |
| FLOWPULSE_DRIVER_USERNAME / FLOWPULSE_DRIVER_PASSWORD | Override the driver demo account |
| FLOWPULSE_STUDENT_USERNAME / FLOWPULSE_STUDENT_PASSWORD | Override the student demo account |
| FLOWPULSE_STUDENT_ID | Student identity linked to the student account |
| GEMINI_API_KEY / GEMINI_MODEL | Gemini configuration (default model gemini-2.5-flash) |
| PORT / FLOWPULSE_DB | Server port or separate demo database |
| DRIVER_WEBHOOK_URL / DRIVER_WEBHOOK_TOKEN | Optional external driver delivery |
| FLOWPULSE_SECURE_COOKIE | Set to 1 only behind HTTPS |

The server listens on this computer by default. Actual phone/device access needs a reachable host and HTTPS for camera use. Local browser viewport testing does not replace testing real devices or production deployment.

The delivered database is a consistent copy of the project database. New session columns are migrated automatically, preserving reservations and observations. Preview-only test records are excluded. Back up the database before resetting it, or set FLOWPULSE_DB to a new filename for a separate demo.
