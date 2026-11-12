"""FlowPulse hackathon API: Python standard library + SQLite.
Run: python server.py   Then visit http://localhost:8000
Prototype identities; staff and driver actions require authenticated sessions.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from datetime import datetime, timedelta, timezone
from threading import RLock, Thread, Event
from contextlib import contextmanager
import json
import os
import sqlite3
import uuid
import secrets
import time
import access
import lifecycle
from delivery import deliver_one
from qrcodegen import QrCode
from intelligence import analyze_image, forecasts, dispatch_advice, IntelligenceError
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get('FLOWPULSE_DB',str(ROOT / 'flowpulse.db')))
LOCK = RLock()
PORT = int(os.environ.get('PORT', '8000'))
CAPACITY = 75
STOPS = {'L': 'Bukit Jalil LRT / Stadium', 'C': 'APU Campus'}


def now():
    return datetime.now(timezone(timedelta(hours=8)))


def iso(dt):
    return dt.isoformat(timespec='seconds')


@contextmanager
def connect():
    db = sqlite3.connect(DB, timeout=15, isolation_level=None)
    try:
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('PRAGMA foreign_keys=ON')
        yield db
    finally:
        db.close()


def initialize():
    with connect() as db:
        db.executescript('''
          CREATE TABLE IF NOT EXISTS departures (
            id INTEGER PRIMARY KEY AUTOINCREMENT, stop TEXT NOT NULL,
            departs_at TEXT NOT NULL, capacity INTEGER NOT NULL DEFAULT 75,
            extra INTEGER NOT NULL DEFAULT 0
          );
          CREATE TABLE IF NOT EXISTS reservations (
            id TEXT PRIMARY KEY, student_id TEXT NOT NULL, departure_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'reserved', created_at TEXT NOT NULL,
            checked_in_at TEXT, FOREIGN KEY(departure_id) REFERENCES departures(id),
            UNIQUE(student_id, departure_id)
          );
          CREATE TABLE IF NOT EXISTS sensors (
            id INTEGER PRIMARY KEY AUTOINCREMENT, stop TEXT NOT NULL, people INTEGER NOT NULL,
            source TEXT NOT NULL, created_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS parking (
            lot TEXT PRIMARY KEY, capacity INTEGER NOT NULL, occupied INTEGER NOT NULL DEFAULT 0
          );
          CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, message TEXT NOT NULL,
            created_at TEXT NOT NULL
          );
        ''')
        for lot, capacity in [('Underground', 700), ('Outdoor', 500)]:
            db.execute('INSERT OR IGNORE INTO parking(lot,capacity,occupied) VALUES(?,?,0)', (lot, capacity))
        lifecycle.migrate(db)
    maintenance()


def event(db, kind, message):
    db.execute('INSERT INTO events(kind,message,created_at) VALUES(?,?,?)', (kind, message, iso(now())))


def maintenance():
    with LOCK, connect() as db:
        db.execute('BEGIN IMMEDIATE')
        lifecycle.maintain(db, now(), event)
        db.commit()


def state():
    maintenance()
    with connect() as db:
        departures = [dict(x) for x in db.execute('''
           SELECT d.*, (SELECT COUNT(*) FROM reservations r
             WHERE r.departure_id=d.id AND r.status IN ('reserved','checked_in')) AS booked
           FROM departures d WHERE d.departs_at > ?
             AND strftime('%w',substr(d.departs_at,1,10)) BETWEEN '1' AND '5'
             AND substr(d.departs_at,12,5) BETWEEN '06:00' AND '22:00'
           ORDER BY d.departs_at,d.stop LIMIT 20
        ''', (iso(now()),))]
        parking = [dict(x) for x in db.execute('SELECT * FROM parking ORDER BY lot')]
        readings = [dict(x) for x in db.execute('''SELECT s.* FROM sensors s WHERE s.id=(
            SELECT id FROM sensors WHERE stop=s.stop ORDER BY julianday(created_at) DESC,id DESC LIMIT 1)
            ORDER BY s.stop''')]
        events = [dict(x) for x in db.execute('SELECT * FROM events ORDER BY id DESC LIMIT 12')]
        predictions = forecasts(db, departures, now())
        pending_ids = {r['departure_id'] for r in db.execute(
            "SELECT departure_id FROM dispatches WHERE status IN ('requested','accepted','arrived')")}
        advice = dispatch_advice(predictions, departures, pending_ids, now())
        sensor_history=[dict(x) for x in db.execute('''SELECT stop,people,source,created_at FROM sensors
            WHERE julianday(created_at)>=julianday(?) AND julianday(created_at)<=julianday(?) ORDER BY julianday(created_at) DESC LIMIT 96''',
            (iso(now()-timedelta(hours=6)),iso(now())))]
        notices=[dict(x) for x in db.execute('''SELECT * FROM service_alerts WHERE resolved=0
            AND julianday(expires_at)>julianday(?) ORDER BY created_at DESC LIMIT 10''',(iso(now()),))]
        reservations = [dict(x) for x in db.execute('''
           SELECT r.*,d.stop,d.departs_at FROM reservations r JOIN departures d ON d.id=r.departure_id
           ORDER BY CASE WHEN r.status IN ('reserved','checked_in') THEN 0 ELSE 1 END,r.created_at DESC LIMIT 500
        ''')]
    return {'server_time':iso(now()), 'departures':departures, 'parking':parking,
            'sensors':readings, 'events':events, 'reservations':reservations,
            'prototype_mode':True, 'forecasts': predictions, 'dispatch_advice': advice,
            'camera_configured': bool(os.environ.get('GEMINI_API_KEY')),
            'sensor_history':sensor_history,'notices':notices}


class APIError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status=status


def required_string(data, key, limit=100):
    value=data.get(key)
    if not isinstance(value,str) or not value.strip() or len(value)>limit:
        raise APIError(f'Invalid {key}')
    return value.strip()


def action(path, data):
    maintenance()
    if path == '/api/camera/analyze':
        try:
            observed_at=iso(now())
            return {**analyze_image(data),'observed_at':observed_at}
        except IntelligenceError as exc:
            raise APIError(str(exc), 422)
    with LOCK, connect() as db:
        db.execute('BEGIN IMMEDIATE')
        if path == '/api/reserve':
            student = required_string(data, 'student_id', 40).upper()
            try: dep_id = int(data['departure_id'])
            except (KeyError,TypeError,ValueError): raise APIError('Select a departure')
            dep=db.execute('SELECT * FROM departures WHERE id=?',(dep_id,)).fetchone()
            if not dep or datetime.fromisoformat(dep['departs_at']) <= now()+timedelta(minutes=5):
                raise APIError('Reservations close five minutes before departure')
            booked=db.execute("SELECT COUNT(*) FROM reservations WHERE departure_id=? AND status IN ('reserved','checked_in')",(dep_id,)).fetchone()[0]
            if booked>=dep['capacity']: raise APIError('This departure is fully booked',409)
            existing=db.execute('SELECT id,status FROM reservations WHERE student_id=? AND departure_id=?',(student,dep_id)).fetchone()
            if existing and existing['status']!='cancelled': raise APIError('Student already has a reservation for this departure',409)
            rid=str(uuid.uuid4())
            if existing:
                db.execute("UPDATE reservations SET id=?,status='reserved',created_at=?,checked_in_at=NULL WHERE id=?",
                           (rid,iso(now()),existing['id']))
            else:
                db.execute('INSERT INTO reservations(id,student_id,departure_id,status,created_at) VALUES(?,?,?,?,?)',
                           (rid,student,dep_id,'reserved',iso(now())))
            event(db,'reservation',f'{student} reserved {dep["stop"]} departure at {dep["departs_at"]}')
            result={'reservation_id':rid,'student_id':student,'status':'reserved','stop':dep['stop'],'departs_at':dep['departs_at']}
        elif path == '/api/reservations/lookup':
            rid=required_string(data,'reservation_id')
            student=required_string(data,'student_id',40).upper()
            row=db.execute('''SELECT r.*,d.stop,d.departs_at FROM reservations r JOIN departures d
                ON d.id=r.departure_id WHERE r.id=? AND r.student_id=?''', (rid,student)).fetchone()
            if not row: raise APIError('Reservation not found. Check student ID and private booking code.',404)
            result=dict(row)
            result['reservation_id']=result.pop('id')
        elif path == '/api/ticket':
            rid=required_string(data,'reservation_id')
            student=required_string(data,'student_id',40).upper()
            row=db.execute('SELECT id FROM reservations WHERE id=? AND student_id=?',(rid,student)).fetchone()
            if not row: raise APIError('Booking not found',404)
            payload=json.dumps({'type':'flowpulse','reservation_id':rid,'student_id':student},separators=(',',':'))
            qr=QrCode.encode_text(payload,QrCode.Ecc.MEDIUM)
            size=qr.get_size()+8
            cells=''.join(f'M{x+4},{y+4}h1v1h-1z' for y in range(qr.get_size()) for x in range(qr.get_size()) if qr.get_module(x,y))
            result={'payload':payload,'svg':f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" role="img" aria-label="Private booking QR ticket"><rect width="100%" height="100%" fill="white"/><path d="{cells}" fill="black"/></svg>'}
        elif path == '/api/checkin':
            rid=required_string(data,'reservation_id')
            student=required_string(data,'student_id',40).upper()
            row=db.execute('''SELECT r.*, d.departs_at FROM reservations r JOIN departures d
                              ON d.id=r.departure_id WHERE r.id=? AND r.student_id=?''',(rid,student)).fetchone()
            if not row: raise APIError('Reservation and student ID do not match',404)
            if row['status']=='checked_in':
                db.commit()
                return {'reservation_id':rid,'status':'checked_in','message':'Already checked in'}
            if row['status']!='reserved': raise APIError(f'Reservation is {row["status"]}',409)
            deadline=datetime.fromisoformat(row['departs_at'])-timedelta(minutes=5)
            if now()>deadline:
                db.execute('UPDATE reservations SET status=? WHERE id=?',('missed',rid))
                event(db,'missed',f'{student} missed the check-in deadline')
                result={'reservation_id':rid,'status':'missed','message':'Check-in closed five minutes before departure'}
            else:
                db.execute('UPDATE reservations SET status=?,checked_in_at=? WHERE id=?',('checked_in',iso(now()),rid))
                event(db,'checkin',f'{student} checked in successfully')
                result={'reservation_id':rid,'status':'checked_in'}
        elif path == '/api/cancel':
            rid=required_string(data,'reservation_id')
            student=required_string(data,'student_id',40).upper()
            row=db.execute('SELECT status FROM reservations WHERE id=? AND student_id=?',(rid,student)).fetchone()
            if not row or row['status'] not in ('reserved','checked_in'): raise APIError('Active reservation not found',404)
            db.execute('UPDATE reservations SET status=? WHERE id=?',('cancelled',rid))
            event(db,'cancellation',f'{student} cancelled a shuttle booking')
            result={'status':'cancelled'}
        elif path == '/api/sensor':
            stop=required_string(data,'stop',1)
            if stop not in STOPS: raise APIError('Unknown stop')
            try:
                if type(data['people']) is not int: raise ValueError()
                people=data['people']
            except (KeyError,ValueError,TypeError): raise APIError('Invalid count')
            if not 0<=people<=5000: raise APIError('Count outside accepted range')
            source=required_string(data,'source',25) if data.get('source') else 'demo'
            stamp=now()
            if source=='gemini-reviewed':
                try: stamp=datetime.fromisoformat(data['observed_at'])
                except (KeyError,TypeError,ValueError): raise APIError('Camera observation timestamp is missing; analyze again')
                if stamp.tzinfo is None or not timedelta(0)<=now()-stamp<=timedelta(minutes=15):
                    raise APIError('Camera count is too old. Discard it and analyze a fresh frame.')
            db.execute('INSERT INTO sensors(stop,people,source,created_at) VALUES(?,?,?,?)',(stop,people,source,iso(stamp)))
            event(db,'sensor',f'{STOPS[stop]} count updated to {people} ({source})')
            result={'stop':stop,'people':people,'source':source}
        elif path == '/api/parking':
            lot=required_string(data,'lot',30)
            if data.get('direction') not in ('in','out'): raise APIError('Use direction in or out')
            row=db.execute('SELECT * FROM parking WHERE lot=?',(lot,)).fetchone()
            if not row: raise APIError('Parking lot not found')
            next_value=row['occupied']+(1 if data['direction']=='in' else -1)
            if not 0<=next_value<=row['capacity']: raise APIError('Parking occupancy would be invalid',409)
            db.execute('UPDATE parking SET occupied=? WHERE lot=?',(next_value,lot))
            event(db,'parking',f'{lot}: vehicle {data["direction"]}, {next_value} occupied')
            result={'lot':lot,'occupied':next_value,'available':row['capacity']-next_value}
        elif path == '/api/dispatch':
            try: dep_id=int(data['departure_id'])
            except (KeyError,ValueError,TypeError): raise APIError('Select a departure')
            dep=db.execute('SELECT * FROM departures WHERE id=?',(dep_id,)).fetchone()
            if not dep or dep['departs_at']<=iso(now()): raise APIError('Departure unavailable')
            if data.get('mode') == 'live':
                if datetime.fromisoformat(dep['departs_at']) < now()+timedelta(minutes=5):
                    raise APIError('At least five minutes are needed to request a backup')
                existing=db.execute("SELECT id FROM dispatches WHERE departure_id=? AND status IN ('requested','accepted','arrived')",(dep_id,)).fetchone()
                if existing: raise APIError('A backup is already requested or assigned for this departure',409)
                dispatch_id=str(uuid.uuid4())
                delivery='pending' if os.environ.get('DRIVER_WEBHOOK_URL') else 'in_app'
                db.execute('INSERT INTO dispatches(id,departure_id,created_at,delivery_status) VALUES(?,?,?,?)',
                           (dispatch_id,dep_id,iso(now()),delivery))
                event(db,'dispatch',f'Backup requested for {dep["stop"]} at {dep["departs_at"]}; awaiting driver acceptance')
                db.commit()
                return {'dispatch_id':dispatch_id,'status':'requested','added_seats':0,'simulated':False,
                        'message':'Request sent to driver inbox. Seats will be added when accepted.'}
            # Hackathon simulation: adds one 75-seat bus; no real driver notified.
            db.execute('UPDATE departures SET capacity=capacity+?,extra=extra+1 WHERE id=?',(CAPACITY,dep_id))
            event(db,'dispatch',f'SIMULATED backup bus assigned to {dep["stop"]} at {dep["departs_at"]}')
            result={'departure_id':dep_id,'added_seats':CAPACITY,'simulated':True}
        elif path == '/api/driver/respond':
            dispatch_id=required_string(data,'dispatch_id')
            response=data.get('response')
            row=db.execute('''SELECT x.*,d.departs_at FROM dispatches x JOIN departures d ON d.id=x.departure_id WHERE x.id=?''',(dispatch_id,)).fetchone()
            if not row: raise APIError('Dispatch not found',404)
            allowed={'requested':('accepted','declined'), 'accepted':('arrived',), 'arrived':('completed',)}
            if response not in allowed.get(row['status'],()): raise APIError('Dispatch status changed; refresh before responding',409)
            if response=='accepted':
                db.execute('UPDATE departures SET capacity=capacity+75,extra=extra+1 WHERE id=?',(row['departure_id'],))
            db.execute('UPDATE dispatches SET status=?,acknowledged_at=?,seats_applied=MAX(seats_applied,?) WHERE id=?',
                       (response,iso(now()),1 if response=='accepted' else 0,dispatch_id))
            event(db,'driver',f'Backup {dispatch_id[:8]}: {response}')
            result={'dispatch_id':dispatch_id,'status':response}
        elif path == '/api/history/import':
            records=data.get('records')
            if not isinstance(records,list) or not 1<=len(records)<=1000: raise APIError('Import 1–1000 observations at a time')
            prepared=[]
            for row in records:
                if not isinstance(row,dict) or row.get('stop') not in STOPS or type(row.get('people')) is not int or not 0<=row['people']<=5000:
                    raise APIError('Each observation needs stop L/C and an integer people count (0–5000)')
                try: stamp=datetime.fromisoformat(row['created_at'])
                except (KeyError,ValueError,TypeError): raise APIError('Invalid historical timestamp')
                if stamp.tzinfo is None or stamp>now(): raise APIError('History must have an explicit timezone and cannot be in the future')
                prepared.append((row['stop'],row['people'],iso(stamp.astimezone(timezone(timedelta(hours=8))))))
            inserted=0
            for stop,people,stamp in prepared:
                if db.execute('SELECT 1 FROM sensors WHERE stop=? AND created_at=?',(stop,stamp)).fetchone(): continue
                db.execute("INSERT INTO sensors(stop,people,source,created_at) VALUES(?,?,'historical',?)",(stop,people,stamp))
                inserted+=1
            event(db,'history',f'Imported {inserted} historical queue observations')
            result={'inserted':inserted,'skipped':len(prepared)-inserted}
        elif path == '/api/forecast/evaluate':
            from intelligence import evaluate
            result=evaluate(db,now())
        elif path == '/api/alerts/create':
            title=required_string(data,'title',80)
            message=required_string(data,'message',400)
            severity=data.get('severity','info')
            duration=data.get('duration_minutes',60)
            if severity not in ('info','warning','disruption') or type(duration) is not int or not 5<=duration<=1440:
                raise APIError('Choose a valid notice level and duration (5–1440 minutes)')
            aid=str(uuid.uuid4())
            db.execute('INSERT INTO service_alerts(id,title,message,severity,created_at,expires_at) VALUES(?,?,?,?,?,?)',
                       (aid,title,message,severity,iso(now()),iso(now()+timedelta(minutes=duration))))
            event(db,'notice',f'Service notice published: {title}')
            result={'id':aid,'message':'Service notice published to all views'}
        elif path == '/api/alerts/resolve':
            aid=required_string(data,'id')
            row=db.execute('SELECT id FROM service_alerts WHERE id=? AND resolved=0',(aid,)).fetchone()
            if not row: raise APIError('Active notice not found',404)
            db.execute('UPDATE service_alerts SET resolved=1 WHERE id=?',(aid,))
            event(db,'notice','A service notice was resolved')
            result={'id':aid,'message':'Service notice resolved'}
        else:
            raise APIError('Unknown endpoint',404)
        db.commit()
        return result


class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(ROOT),**kwargs)

    def send_json(self, obj, status=200, cookie=None):
        payload=json.dumps(obj).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(payload)))
        self.send_header('X-Content-Type-Options','nosniff')
        if cookie: self.send_header('Set-Cookie',cookie)
        self.end_headers()
        self.wfile.write(payload)

    def redirect(self,path):
        self.send_response(303)
        self.send_header('Location',path)
        self.send_header('Cache-Control','no-store')
        self.end_headers()

    def do_GET(self):
        if self.path=='/api/health':
            self.send_json({'status':'ok','app':'FlowPulse Campus','project_id':access.digest(str(ROOT).casefold())[:16]});return
        with connect() as db:
            identity=access.identity_for(db,self.headers.get('Cookie'),now())
        role=identity['role'] if identity else None
        if self.path in ('/','/index.html','/staff','/driver','/student'):
            if not identity:self.redirect('/login.html');return
            if self.path!=access.home(role):self.redirect(access.home(role));return
            self.path='/index.html'
            return super().do_GET()
        if self.path in ('/api/state','/api/session'):
            if self.path=='/api/session':
                self.send_json({'role':role,'user':identity,'accounts':access.account_options()});return
            if not identity:self.send_json({'error':'Please sign in to continue'},401);return
            result=state()
            result['role']=role
            result['user']=identity
            if role!='staff':
                result['reservations']=[]
                result['events']=[]
            if role=='student':
                with connect() as db:
                    result['reservations']=[dict(x) for x in db.execute('''SELECT r.*,d.stop,d.departs_at FROM reservations r
                        JOIN departures d ON d.id=r.departure_id WHERE r.student_id=?
                        ORDER BY CASE WHEN r.status IN ('reserved','checked_in') THEN 0 ELSE 1 END,r.created_at DESC LIMIT 500''',
                        (identity['student_id'],))]
            if role in ('staff','driver'):
                with connect() as db:
                    result['dispatches']=[dict(x) for x in db.execute('''SELECT x.*,d.stop,d.departs_at FROM dispatches x
                        JOIN departures d ON d.id=x.departure_id ORDER BY x.created_at DESC LIMIT 30''')]
            else: result['dispatches']=[]
            result['webhook_configured']=bool(os.environ.get('DRIVER_WEBHOOK_URL')) if role=='staff' else False
            self.send_json(result);return
        if self.path.startswith('/api/'):
            self.send_json({'error':'Not found'},404);return
        # Serve only public app assets; never expose the database, code or secrets.
        public = unquote(urlsplit(self.path).path)
        parts = public.strip('/').split('/')
        allowed = public=='/login.html' or (parts[0] in ('js','css','assets') and '..' not in parts and '\\' not in public and Path(public).suffix.lower() in ('.js','.css','.svg','.png','.jpg','.ico'))
        if not allowed:
            self.send_error(404); return
        return super().do_GET()

    def do_HEAD(self):
        self.send_response(405)
        self.end_headers()

    def do_POST(self):
        if not self.path.startswith('/api/'):
            self.send_json({'error':'Not found'},404);return
        try:
            # A custom header prevents cross-origin HTML forms from changing state.
            if self.headers.get('X-FlowPulse-Request')!='1': raise APIError('Use the FlowPulse app to submit this request',403)
            origin=self.headers.get('Origin')
            if origin and urlsplit(origin).netloc != self.headers.get('Host'):
                raise APIError('Cross-origin requests are not allowed',403)
            if self.headers.get('Content-Type','').split(';')[0].strip()!='application/json':
                raise APIError('Expected JSON request',415)
            length=int(self.headers.get('Content-Length','0'))
            limit=4500000 if self.path=='/api/camera/analyze' else 2000000 if self.path=='/api/history/import' else 65536
            if length<=0 or length>limit: raise APIError('Invalid request size')
            data=json.loads(self.rfile.read(length))
            if not isinstance(data,dict): raise APIError('Expected object')
            if self.path=='/api/login':
                with connect() as db:
                    try: token,role=access.login(db,data,now(),self.client_address[0])
                    except ValueError as exc: raise APIError(str(exc),401)
                with connect() as db:
                    user=access.identity_for(db,'flowpulse_session='+token,now())
                self.send_json({'role':role,'user':user,'redirect':access.home(role)},cookie=access.session_cookie(token));return
            if self.path=='/api/logout':
                with connect() as db:
                    db.execute('DELETE FROM sessions WHERE token_hash=?',(access.digest(access.cookie_token(self.headers.get('Cookie'))),))
                self.send_json({'role':None},cookie=access.session_cookie('',clear=True));return
            with connect() as db:
                identity=access.identity_for(db,self.headers.get('Cookie'),now())
            if not identity:raise APIError('Please sign in to continue',401)
            role=identity['role']
            student_paths=('/api/reserve','/api/reservations/lookup','/api/ticket','/api/cancel')
            expected='student' if self.path in student_paths else 'driver' if self.path=='/api/driver/respond' else 'staff'
            if role!=expected:raise APIError('This action is not available to your account',403)
            if role=='student':
                supplied=data.get('student_id',identity['student_id'])
                if not isinstance(supplied,str) or supplied.strip().upper()!=identity['student_id']:
                    raise APIError('You can only manage bookings for your signed-in student account',403)
                data['student_id']=identity['student_id']
                if self.path in ('/api/cancel','/api/ticket','/api/reservations/lookup'):
                    with connect() as db:
                        row=db.execute('SELECT student_id FROM reservations WHERE id=?',(data.get('reservation_id'),)).fetchone()
                    if not row or row['student_id']!=identity['student_id']:raise APIError('Booking not found for your account',404)
            self.send_json(action(self.path,data))
        except APIError as exc:
            self.send_json({'error':str(exc)},exc.status)
        except (ValueError,UnicodeDecodeError,json.JSONDecodeError):
            self.send_json({'error':'Invalid JSON'},400)
        except Exception:
            self.send_json({'error':'Internal server error'},500)
            raise

if __name__=='__main__':
    access.configure(announce=True)
    initialize()
    with connect() as db:
        db.execute('DELETE FROM sessions')
    def upkeep():
        while True:
            try:
                maintenance()
                deliver_one(connect,now())
            except Exception as exc:
                print(f'Maintenance issue: {type(exc).__name__}',flush=True)
            time.sleep(10)
    Thread(target=upkeep,daemon=True).start()
    print(f'FlowPulse: http://localhost:{PORT}',flush=True)
    ThreadingHTTPServer((os.environ.get('FLOWPULSE_HOST','127.0.0.1'),PORT),Handler).serve_forever()
