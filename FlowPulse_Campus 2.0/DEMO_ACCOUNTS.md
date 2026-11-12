# FlowPulse demo accounts

| Account | Username | Password | Workspace |
|---|---|---|---|
| APU staff | `apu.staff` | `APUstaff@2026` | `/staff` |
| Bus driver | `bus.driver` | `Driver@2026` | `/driver` |
| Student | `student` | `Student@2026` | `/student` |

The student account is linked to **TP123456**. Choose the matching account type on the login page. Passwords are case-sensitive. These are local demo accounts for this project, not university credentials.

Start the server and open its local address. The app opens the login page, then routes each account to its own workspace. Sign out from the profile button (or the desktop sidebar) to use another account. For simultaneous staff, driver and student sessions, use separate browser profiles, private windows or devices; ordinary tabs in one browser share the same login cookie.

The credentials stay the same across restarts unless you override them using FLOWPULSE_STAFF_PASSWORD, FLOWPULSE_DRIVER_PASSWORD or FLOWPULSE_STUDENT_PASSWORD. Corresponding *_USERNAME settings override account names. FLOWPULSE_STUDENT_ID changes the student account ID. Password verification uses salted scrypt hashes, and raw session tokens are not stored in the database.
