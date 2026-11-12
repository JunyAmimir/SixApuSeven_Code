# FlowPulse Campus

Bus queue and parking dashboard for an LRT station and a school campus.
Office dashboard and student app, driven by a 2-week weekday simulation.

## Run it
Open `index.html` in a browser (double-click is fine). No build step, no internet needed.
Use `#office` or `#student` at the end of the address to open a view directly.

## Hackathon demo
The page now starts paused. For the simplest presentation, click **Start guided demo** on the Office dashboard, then follow its changing primary button: **Dispatch LRT backup**, **Show backup arrival**, **Show boarding result**, and **View student confirmation**.

The Office dashboard prioritizes the live queue summary, station actions, and dispatch outcomes. Route map, activity logs and preset reports are collapsed until needed. Dispatch results retain the regular/backup passenger split and queue remaining at that departure, separately from the current queue.

1. Click **Load congestion demo**. It pauses at 07:51 with 161 confirmed students at the LRT stop. The demo student has already checked in and is #101.
2. Switch to **Students**: estimated departure without intervention is 08:10.
3. Switch to **Office** and send a backup shuttle to the **LRT station**. The queue stays at 161; the backup is due at 07:56, departing at 08:00.
4. Click **Advance to next event**: the backup arrives at 07:56. The queue still has 161 students.
5. Click it again: at 08:00 the regular bus and backup each have 75 seats. They board 150 students, leaving 11. The student is correctly assigned to the backup.
6. Switch to **Students** to show the boarding confirmation. The fixed scenario demonstrates a 10 simulated-minute improvement for that student.
7. Click **Reset simulation** to clear all demo state, or reload the congestion scenario to repeat it.

Background demand is frozen only in the controlled congestion scenario. Playback and event stepping both use simulated time. Ordinary simulation still generates demand.

After the fixed queue clears, use **Continue normal simulation** in the walkthrough (or **Run normal simulation** in the top controls) to resume background arrivals and the clock without clearing dispatch outcomes.

## Student view
Switch to Students or open `index.html#student`. Students select a starting stop, join, check in using the demo kiosk button, and see their queue position, estimated departure and waiting time. After boarding they see their assigned vehicle and arrival estimate, then can plan another ride.

Office and Students share the original top toolbar: view tabs, Play/Pause, time slider, day and speed. The student view hides the larger congestion demo panel. Use the shared toolbar to advance time while presenting the student journey. Route and parking details remain collapsed.

## Prototype boundaries
- All demand, parking occupancy and bus locations are simulated. No real GPS, bay sensors, QR reader or NFC device is connected.
- Office and Students share state only within this page. Separate tabs/devices do not synchronize. Refresh resets state.
- A backup takes a modelled five minutes to reach the stop, then departs on the next ten-minute timetable slot. The prototype assumes a backup can be dispatched per stop; it does not implement a real fleet availability system.
- Departure estimates use the confirmed queue and scheduled capacity. They are estimates, not seat reservations.
- The weekly report and CSV are precomputed reference scenarios for full weeks, with an automatic backup policy. They are not live activity logs. CSV rows explicitly identify this source.
- Service ends at 22:00. Playback can continue until the current student arrives, at most 22:20, without generating new passengers or departures. Rewinding or changing day resets the active journey.

## Verification
With Node.js installed, run `node tests/simulation.test.cjs` from this folder. The checks cover capacity estimates, dispatch travel time, separate backup boarding, controlled before/after outcomes, cancellation, expiration, parking reset, closing time and report source labels. They exercise production scripts with a minimal DOM stub; they do not replace visual browser testing.

## Structure
```
flowpulse-campus/
├── index.html            Page markup (office view, student view) and script order
├── css/
│   ├── main.css          Design tokens, base elements, header, page layout
│   └── components.css    Cards, alerts, queue panels, seat grid, map, heatmap, tables, parking, student tiles
├── js/                   Plain scripts, loaded in this order
│   ├── config.js         Constants, helpers, shared state
│   ├── mockData.js       Demand model (students joining per minute, peak hours, long peak days)
│   ├── queue.js          Bus rotation schedule, queue engine, student actions
│   ├── history.js        Simulates Week 1 and Week 2 once for the weekly report
│   ├── parking.js        Parking model (underground 700, outside 500) and lot cards
│   ├── map.js            Live bus rotation map (SVG)
│   ├── operations.js     Management summary, guided demo and dispatch outcomes
│   ├── office.js         Stop panels, big alerts and backup bus, weekly report, CSV
│   ├── student.js        Join buttons, big queue numbers, live bus location
│   └── app.js            Clock, day rollover, view switching, 1 second tick
└── assets/
    └── favicon.svg
```

## How it works
- **Queue:** a student taps Join (pending), uses the demo check-in button (on queue), then boards.
  Each bus has 75 seats. Students keep their queue order across departures; the estimator accounts for all required departures and any scheduled backup.
- **Rotation:** 6 buses on a 60 minute loop, one leaves each stop every 10 minutes. Weekdays only.
- **Backup bus:** if a stop has more than 150 on queue, the office sees a big alert with a Send backup shuttle bus button.
- **Peak hours:** 08:00, 10:00, 12:00, 13:00, 15:00, 16:00, 18:00. Week 2 Wednesday and Thursday have a continuous peak 12:00 to 18:00.
- **IDs:** simulated students are `TP` followed by 6 random digits.

## Connecting real data
- Replace `lam()` in `js/mockData.js` and `occ()` in `js/parking.js` with calls to your sensor feed.
- Kiosk scans should call the same logic as `scanMe()` in `js/queue.js`.

