"""Idempotent schedule and reservation maintenance (Kuala Lumpur timestamps)."""
from datetime import timedelta


def maintain(db, current, emit):
    stamp = current.isoformat(timespec='seconds')
    deadline = (current+timedelta(minutes=5)).isoformat(timespec='seconds')
    expired = db.execute('''SELECT r.id,r.student_id FROM reservations r JOIN departures d
        ON d.id=r.departure_id WHERE r.status='reserved' AND julianday(d.departs_at)<=julianday(?)''', (deadline,)).fetchall()
    for row in expired:
        db.execute("UPDATE reservations SET status='missed' WHERE id=?", (row['id'],))
        emit(db, 'missed', f'{row["student_id"]}: check-in deadline expired; seat released')
    for status, replacement, offset in [('checked_in', 'boarded', 0), ('boarded', 'completed', -20)]:
        boundary = (current+timedelta(minutes=offset)).isoformat(timespec='seconds')
        db.execute('''UPDATE reservations SET status=? WHERE status=? AND departure_id IN
            (SELECT id FROM departures WHERE julianday(departs_at)<=julianday(?))''', (replacement, status, boundary))
    # Rolling next two service days. Weekdays, 06:00-22:00, every ten minutes.
    day = current.replace(hour=0, minute=0, second=0, microsecond=0)
    days = 0
    while days < 2:
        if day.weekday() < 5 and day+timedelta(hours=22) > current+timedelta(minutes=5):
            days += 1
            for minutes in range(360, 1321, 10):
                departure = day+timedelta(minutes=minutes)
                if departure < current+timedelta(minutes=10):
                    continue
                for stop in ('L', 'C'):
                    value = departure.isoformat(timespec='seconds')
                    db.execute('''INSERT INTO departures(stop,departs_at,capacity)
                        SELECT ?,?,75 WHERE NOT EXISTS
                        (SELECT 1 FROM departures WHERE stop=? AND departs_at=?)''', (stop, value, stop, value))
        day += timedelta(days=1)
    db.execute('DELETE FROM sessions WHERE julianday(expires_at)<=julianday(?)', (stamp,))
    # Driver requests cannot be accepted once their departure has left.
    db.execute('''UPDATE dispatches SET status='expired' WHERE status='requested'
        AND departure_id IN (SELECT id FROM departures WHERE julianday(departs_at)<=julianday(?))''', (stamp,))
    db.execute('''UPDATE dispatches SET status='completed' WHERE status IN ('accepted','arrived')
        AND departure_id IN (SELECT id FROM departures WHERE julianday(departs_at)<=julianday(?))''', (stamp,))


def migrate(db):
    db.executescript('''
        CREATE INDEX IF NOT EXISTS departure_time ON departures(departs_at,stop);
        CREATE INDEX IF NOT EXISTS reservation_departure ON reservations(departure_id,status);
        CREATE INDEX IF NOT EXISTS sensor_history ON sensors(stop,created_at);
        CREATE TABLE IF NOT EXISTS service_alerts (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, message TEXT NOT NULL,
            severity TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
            resolved INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY, role TEXT NOT NULL, expires_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS dispatches (
            id TEXT PRIMARY KEY, departure_id INTEGER NOT NULL REFERENCES departures(id),
            status TEXT NOT NULL DEFAULT 'requested', created_at TEXT NOT NULL,
            acknowledged_at TEXT, seats_applied INTEGER NOT NULL DEFAULT 0,
            delivery_status TEXT NOT NULL DEFAULT 'in_app', delivery_attempts INTEGER NOT NULL DEFAULT 0,
            next_attempt_at TEXT, delivered_at TEXT);
    ''')
