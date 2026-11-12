# Dedicated accounts and motion update

This revision replaces the mixed public workspace and role/password dialog with a dedicated login page and three named demo accounts. Credential details are in DEMO_ACCOUNTS.md.

## Separate experiences

- `/staff`: APU staff navigation for Overview, Departures, Observations, Check-in and Insights. Staff can request support and inspect progress, but cannot accept driver assignments.
- `/driver`: Active requests and request history only, with driver acknowledgement and arrival/completion actions.
- `/student`: Own bookings, own boarding pass, calendar reminders and parking availability. Student ID is bound to the session, not a free-text identity claim.

The root address opens login when signed out and the correct workspace when signed in. Navigating to another role URL returns to the authenticated role's home. API actions enforce the same boundaries, including student ownership of reservation lookup, QR generation and cancellation. The browser scopes cached bookings by username, while server records restore bookings across devices.

The three accounts have stable demo credentials. Password verification uses salted scrypt, cookies are HttpOnly/SameSite=Strict, and raw session tokens are not persisted. Invalid attempts are rate limited by account and client; successful account switches do not lock out the demo. Sessions expire and are revoked at server restart. This is a local-demo account system, not university SSO, registration or employee administration.

## Motion and polish

The login page has a bespoke campus-route illustration, gentle route/bus movement, a focused form entrance, role-card states and a submitting indicator. Workspaces, staff panels, profile dialogs, toasts and buttons use short, restrained transitions. Controls are not replaced just because an unchanged background update arrives. Reduced-motion preferences disable decorative animation and smooth scrolling.

The profile dialog shows the signed-in account and offers sign-out; it no longer mixes all three login forms into a dashboard. Mobile navigation is specific to the account, and active student boarding passes stay prominent.

Existing backend reservations, forecasts, parking, camera review and service notices are preserved. Physical camera testing remains deferred at the user's request. The original Desktop project was not modified.
