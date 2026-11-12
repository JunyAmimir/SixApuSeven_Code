> Active VS Code project: edits now happen directly in this folder. See RUN_IN_VSCODE.md.

# FlowPulse Campus

A campus shuttle and parking prototype with three separate account workspaces, a dedicated sign-in page and responsive, animated screens.

## Start

Extract the ZIP and double-click **Start_FlowPulse.cmd**. The browser opens when the server is ready; no camera key is required for login. Open the local address printed by the launcher (normally http://localhost:8000). Stop any older FlowPulse server first.

Choose APU staff, Bus driver or Student on the login page. The username is filled in for the selected role. Credentials are in [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md).

| Account | Username | Password |
|---|---|---|
| APU staff | `apu.staff` | `APUstaff@2026` |
| Bus driver | `bus.driver` | `Driver@2026` |
| Student | `student` | `Student@2026` |

The student account is linked to TP123456. These are local project demo accounts, not university accounts.

Python 3.10+ is required; no pip or npm installation is needed to run the app. On this computer the launcher uses the installed Python 3.12 interpreter. If you run manually, use `python server.py` from this folder. Node is needed only for JavaScript tests.

## Your own workspace

- **APU staff** (`/staff`): overview, departures, observations/camera controls, station check-in, insights, parking and service notices.
- **Bus driver** (`/driver`): active backup requests, acceptance/arrival updates and request history.
- **Student** (`/student`): bookings under the account's student ID, boarding pass, calendar reminders, saved bookings and parking availability.

The server routes each login to its own page and enforces permissions on every action. Student bookings are tied to the signed-in identity; entering another student's ID is not supported. Booking history is recovered from the account on a new device. Staff cannot accept driver assignments, and drivers cannot use staff controls.

See [START_HERE.md](START_HERE.md) for the demonstration flow and configuration, [ACCOUNT_UPDATE.md](ACCOUNT_UPDATE.md) for account separation and animation details, and [VERIFICATION.md](VERIFICATION.md) for test results.

## Verification

From this folder:

```text
python -m unittest discover -s tests -p "test_*.py" -v
node tests/portal.test.cjs
node tests/studio.test.cjs
node tests/live.test.cjs
node tests/simulation.test.cjs
```

Tests use temporary databases and mocked Gemini/webhook responses. No external messages or real camera images are sent.

## Files

- `login.html`, `css/login.css`, `js/login.js`: dedicated three-account sign-in screen.
- `js/portal.js`, `css/portal.css`: authenticated entry, role navigation, ownership-aware booking sync and reduced-motion-friendly transitions.
- `server.py`, `access.py`, `lifecycle.py`: APIs, named account verification, hashed sessions, role checks, maintenance and schema upgrades.
- `intelligence.py`, `delivery.py`: reviewed Gemini counts, explainable forecasts and optional notification delivery.
- `js/studio.js`, `css/studio.css`: dashboards, booking interface, charts, notices and exports.
- Original guided-simulation scripts remain available in the staff workspace.

The bundled `qrcodegen.py` is the MIT-licensed Project Nayuki QR encoder. Its full license is preserved in the source; booking codes are never sent to an external QR service.

Physical laptop-camera testing remains deferred. Live Gemini access needs the user's API key and real images. More real historical data is needed to establish forecasting accuracy. The driver inbox works locally; external SMS/WhatsApp/Telegram delivery needs a configured provider. University SSO, real card/NFC validation, GPS and production deployment are not claimed.
