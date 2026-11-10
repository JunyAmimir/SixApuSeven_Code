# FlowPulse Campus

Bus queue and parking dashboard for an LRT station and a school campus.
Office dashboard and student app, driven by a 2-week weekday simulation.

## Run it
Open `index.html` in a browser (double-click is fine). No build step, no internet needed.
Use `#office` or `#student` at the end of the address to open a view directly.

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
│   ├── office.js         Stop panels, big alerts and backup bus, weekly report, CSV
│   ├── student.js        Join buttons, big queue numbers, live bus location
│   └── app.js            Clock, day rollover, view switching, 1 second tick
└── assets/
    └── favicon.svg
```

## How it works
- **Queue:** a student taps Join (pending), scans a QR code or NFC tag at the kiosk (on queue), then boards.
  Each bus has 75 seats. Student 76 waits for the next bus and goes first on it.
- **Rotation:** 6 buses on a 60 minute loop, one leaves each stop every 10 minutes. Weekdays only.
- **Backup bus:** if a stop has more than 150 on queue, the office sees a big alert with a Send backup shuttle bus button.
- **Peak hours:** 08:00, 10:00, 12:00, 13:00, 15:00, 16:00, 18:00. Week 2 Wednesday and Thursday have a continuous peak 12:00 to 18:00.
- **IDs:** simulated students are `TP` followed by 6 random digits.

## Connecting real data
- Replace `lam()` in `js/mockData.js` and `occ()` in `js/parking.js` with calls to your sensor feed.
- Kiosk scans should call the same logic as `scanMe()` in `js/queue.js`.
