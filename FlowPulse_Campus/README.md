# FlowPulse Campus

Campus shuttle reservations, queue observations, demand forecasts and parking status, with shared student, staff and driver screens.

## Professional interface update

This version includes a redesigned operations overview, dedicated staff workspaces, a simpler student booking flow, a mobile boarding pass, a driver hub and saved light/dark appearance. It also adds route filters, private schedule export, calendar reminders, booking search and shared service notices. See [DESIGN_UPDATE.md](DESIGN_UPDATE.md).

## Start on Windows

Extract the ZIP and double-click **Start_FlowPulse.cmd**. Enter a Gemini API key when prompted, or press Enter to skip camera analysis. Staff and driver passwords are printed in that terminal window. Open http://localhost:8000 in your browser. Keep the terminal open. Stop any older FlowPulse server before starting this version.

Alternatively, run `python server.py` from this folder (Python 3.10+). There are no required pip or npm installations. `qrcodegen.py` is the bundled MIT-licensed Project Nayuki QR encoder, with its license included in the source file.

Read [START_HERE.md](START_HERE.md) for configuration and demo instructions, [CHANGES.md](CHANGES.md) for the implemented features and remaining external dependencies, and [VERIFICATION.md](VERIFICATION.md) for test results.

## Modes

- **Shared live data** (default): SQLite-backed student bookings, station check-in, office forecasts, parking events and driver requests. Tabs share backend state. Booking codes survive refresh and allow recovery on another device.
- **Guided simulation**: the preserved original 161-student congestion walkthrough, simulated buses, parking model and reference reports. It uses a separate simulation clock and never changes live bookings.

The main Office and Students screens now show the selected mode consistently. Use the Data selector to switch modes. Opening index.html directly supports only the original simulation; use the Python server for live features.

## Verification

From this folder:

```text
python -m unittest discover -s tests -p "test_*.py" -v
node tests/studio.test.cjs
node tests/live.test.cjs
node tests/simulation.test.cjs
```

Node is needed only for JavaScript tests. Python tests use temporary databases. No tests send real driver messages or contact Gemini.

## Structure

- `server.py`: HTTP API and static public app assets; staff-only mutations and private booking lookup.
- `lifecycle.py`: rolling weekday schedule, check-in expiry and timetable-based journey transitions.
- `access.py`: staff/driver password verification and expiring sessions.
- `intelligence.py`: Gemini structured counts, explainable forecast, rolling historical backtest.
- `delivery.py`: optional persistent driver webhook outbox and retries.
- `js/live.js`: shared live data, booking recovery, driver inbox and history import.
- `js/studio.js` and `css/studio.css`: redesigned screens, workspaces, charts, notices, route filters, calendar and schedule export.
- `js/devices.js`: laptop camera capture, reviewed counts, barcode/QR check-in controls.
- Original simulation scripts, styles and views remain available.

This is a local hackathon prototype, not an authenticated university identity service, GPS tracking system or production fleet scheduler. Physical camera testing is deferred until the user is on their laptop. Live Gemini access and counting accuracy require their API key and real images. External messaging requires a configured webhook; driver inbox delivery works without it.
