"""Optional driver webhook outbox. Driver inbox works without any external service."""
import json
import os
from datetime import timedelta
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def deliver_one(connect, current):
    url = os.environ.get('DRIVER_WEBHOOK_URL', '')
    if not url:
        return
    parsed = urlsplit(url)
    if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in ('127.0.0.1','localhost')):
        return
    # Claim one pending job transactionally. Idempotency-Key survives retries.
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('''SELECT x.*,d.stop,d.departs_at FROM dispatches x JOIN departures d ON d.id=x.departure_id
            WHERE x.status='requested' AND x.delivery_status IN ('pending','retry') AND x.delivery_attempts<5
            AND (x.next_attempt_at IS NULL OR julianday(x.next_attempt_at)<=julianday(?))
            AND julianday(d.departs_at)>julianday(?) ORDER BY x.created_at LIMIT 1''',
            (current.isoformat(), current.isoformat())).fetchone()
        if not row:
            db.rollback(); return
        row = dict(row)
        # Lease represented as retry with a future timestamp: recovers after crashes.
        db.execute("UPDATE dispatches SET delivery_status='retry',delivery_attempts=delivery_attempts+1,next_attempt_at=? WHERE id=?",
                   ((current+timedelta(minutes=2)).isoformat(), row['id']))
        db.commit()
    payload = {'event':'backup_requested', 'dispatch_id':row['id'], 'departure_id':row['departure_id'],
               'stop':row['stop'], 'departs_at':row['departs_at'], 'seats':75,
               'message':'Backup requested. Accept in the FlowPulse driver inbox; this webhook does not confirm a bus.'}
    headers = {'Content-Type':'application/json', 'Idempotency-Key':row['id']}
    secret = os.environ.get('DRIVER_WEBHOOK_TOKEN')
    if secret: headers['Authorization'] = f'Bearer {secret}'
    try:
        with build_opener(NoRedirect).open(Request(url, data=json.dumps(payload).encode(), headers=headers), timeout=8) as response:
            if not 200 <= response.status < 300: raise ValueError('Provider rejected')
        status = 'delivered'
    except Exception:
        status = 'failed' if row['delivery_attempts'] >= 4 else 'retry'
    with connect() as db:
        db.execute('UPDATE dispatches SET delivery_status=?,delivered_at=? WHERE id=?',
                   (status, current.isoformat() if status == 'delivered' else None, row['id']))
