# Implemented update

The latest visual and feature changes are documented in [DESIGN_UPDATE.md](DESIGN_UPDATE.md).

- Main student and office screens use shared backend data in live mode; guided simulation preserved behind a mode selector.
- Automatic missed-check-in expiry, released seats, timetable-based journey states and a rolling weekday schedule.
- Saved booking selection, refresh recovery, private-code recovery across devices and offline-generated QR tickets.
- Staff/driver login, hashed expiring sessions, endpoint permissions, request-origin checks and private state filtering.
- Station QR/barcode camera controls and keyboard-reader input; booking/ID matching with mismatch rejection.
- Laptop-camera preview, one-frame and periodic Gemini analysis, explicit count review, timestamped freshness and camera cleanup.
- Driver inbox requests, acknowledgement workflow, duplicate protection, capacity only after acceptance, opt-in desktop alerts.
- Optional persistent webhook outbox with retry/idempotency support; no external account required for the in-app inbox.
- Historical observation import and leakage-free ten-minute forecast evaluation against a baseline; limited camera extrapolation horizon.
- Responsive layout and a Windows launcher with an optional hidden API-key prompt.

## External checks and limits

Physical laptop-camera and real-photo Gemini testing are deferred until the user is on their laptop. No Gemini key is included. More real historical observations are needed to measure forecast accuracy. The built-in driver inbox was verified; actual external SMS/WhatsApp/Telegram delivery requires a configured provider endpoint and credentials. Actual university card formats, NFC/SSO, real vehicle movements, continuous RTSP CCTV and a production fleet scheduler are not implemented or claimed. Mobile layout testing used a browser viewport, not a physical phone.
