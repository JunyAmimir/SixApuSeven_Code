import unittest
from datetime import datetime,timedelta,timezone
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
import test_backend

srv=test_backend.srv


class OperationsTest(unittest.TestCase):
    def setUp(self):
        self.clock=datetime(2026,11,12,7,0,tzinfo=timezone(timedelta(hours=8)))
        self.patcher=patch.object(srv,'now',side_effect=lambda:self.clock)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
        test_backend.BackendTest.setUp(self)
    tearDown=test_backend.BackendTest.tearDown

    def book(self,student='TP000001'):
        dep=srv.state()['departures'][0]
        return dep,srv.action('/api/reserve',{'student_id':student,'departure_id':dep['id']})

    def test_expiry_releases_seats_without_checkin_and_completed_states(self):
        dep,b=self.book()
        _,checked=self.book('TP000002')
        srv.action('/api/checkin',checked)
        self.clock=datetime.fromisoformat(dep['departs_at'])-timedelta(minutes=5)
        srv.maintenance()
        self.assertEqual('missed',srv.action('/api/reservations/lookup',b)['status'])
        current=next(x for x in srv.state()['departures'] if x['id']==dep['id'])
        self.assertEqual(1,current['booked'])
        with self.assertRaises(srv.APIError):srv.action('/api/reserve',{'student_id':'LATE','departure_id':dep['id']})
        self.clock+=timedelta(minutes=5)
        srv.maintenance()
        self.assertEqual('boarded',srv.action('/api/reservations/lookup',checked)['status'])
        self.clock+=timedelta(minutes=20)
        srv.maintenance()
        self.assertEqual('completed',srv.action('/api/reservations/lookup',checked)['status'])

    def test_rollover_is_idempotent_and_skips_weekend(self):
        self.clock=datetime(2026,11,13,22,5,tzinfo=self.clock.tzinfo)
        srv.maintenance();srv.maintenance()
        trips=srv.state()['departures']
        self.assertEqual('2026-11-16',trips[0]['departs_at'][:10])
        with srv.connect() as db:
            duplicates=db.execute('SELECT COUNT(*) FROM (SELECT stop,departs_at FROM departures GROUP BY stop,departs_at HAVING COUNT(*)>1)').fetchone()[0]
        self.assertEqual(0,duplicates)

    def test_live_backup_waits_for_acceptance_and_applies_capacity_once(self):
        dep,_=self.book()
        request=srv.action('/api/dispatch',{'departure_id':dep['id'],'mode':'live'})
        self.assertEqual(0,request['added_seats'])
        with self.assertRaises(srv.APIError):srv.action('/api/dispatch',{'departure_id':dep['id'],'mode':'live'})
        srv.action('/api/driver/respond',{'dispatch_id':request['dispatch_id'],'response':'accepted'})
        with self.assertRaises(srv.APIError):srv.action('/api/driver/respond',{'dispatch_id':request['dispatch_id'],'response':'accepted'})
        trip=next(x for x in srv.state()['departures'] if x['id']==dep['id'])
        self.assertEqual(150,trip['capacity'])
        srv.action('/api/driver/respond',{'dispatch_id':request['dispatch_id'],'response':'arrived'})
        srv.action('/api/driver/respond',{'dispatch_id':request['dispatch_id'],'response':'completed'})

    def test_ticket_recovery_and_wrong_identity(self):
        _,b=self.book()
        self.assertEqual('reserved',srv.action('/api/reservations/lookup',b)['status'])
        ticket=srv.action('/api/ticket',b)
        self.assertIn('<svg',ticket['svg']);self.assertIn(b['reservation_id'],ticket['payload'])
        with self.assertRaises(srv.APIError):srv.action('/api/reservations/lookup',{**b,'student_id':'WRONG'})
        with self.assertRaises(srv.APIError):srv.action('/api/ticket',{**b,'student_id':'WRONG'})

    def test_history_import_is_atomic_deduplicated_and_does_not_replace_latest(self):
        srv.action('/api/sensor',{'stop':'L','people':99,'source':'manual'})
        record={'stop':'L','people':40,'created_at':srv.iso(self.clock-timedelta(days=7))}
        self.assertEqual(1,srv.action('/api/history/import',{'records':[record,record]})['inserted'])
        self.assertEqual(99,srv.state()['sensors'][0]['people'])
        with self.assertRaises(srv.APIError):srv.action('/api/history/import',{'records':[{**record,'created_at':srv.iso(self.clock-timedelta(days=14))},{**record,'people':-1}]})
        with srv.connect() as db:self.assertEqual(2,db.execute('SELECT COUNT(*) FROM sensors').fetchone()[0])

    def test_concurrent_bookings_cannot_exceed_capacity(self):
        dep=srv.state()['departures'][0]
        def reserve(i):
            try:srv.action('/api/reserve',{'student_id':f'TP{i:06}','departure_id':dep['id']});return True
            except srv.APIError:return False
        with ThreadPoolExecutor(max_workers=8) as pool:results=list(pool.map(reserve,range(80)))
        self.assertEqual(75,sum(results))

    def test_backtest_uses_only_past_observations(self):
        from intelligence import evaluate
        with srv.connect() as db:
            for minute in range(0,121,10):
                db.execute("INSERT INTO sensors(stop,people,source,created_at) VALUES('L',?,'demo',?)",(20+minute,srv.iso(self.clock-timedelta(minutes=120-minute))))
            before=evaluate(db,self.clock)
            db.execute("INSERT INTO sensors(stop,people,source,created_at) VALUES('L',5000,'demo',?)",(srv.iso(self.clock+timedelta(days=1)),))
            after=evaluate(db,self.clock)
        self.assertGreaterEqual(before['samples'],5)
        self.assertEqual(before,after)
        self.assertIn('demo',before['sources'])

    def test_camera_forecasts_do_not_extrapolate_overnight(self):
        from intelligence import forecasts
        srv.action('/api/sensor',{'stop':'L','people':161,'source':'manual'})
        with srv.connect() as db:
            far=[{'id':1,'stop':'L','departs_at':srv.iso(self.clock+timedelta(hours=5)),'booked':4,'capacity':75}]
            result=forecasts(db,far,self.clock)[0]
        self.assertEqual(4,result['demand'])
        self.assertIn('one-hour',result['basis'])

    def test_review_cannot_make_an_old_camera_frame_fresh(self):
        old={'stop':'L','people':21,'source':'gemini-reviewed','observed_at':srv.iso(self.clock-timedelta(minutes=16))}
        with self.assertRaises(srv.APIError):srv.action('/api/sensor',old)
        recent={**old,'observed_at':srv.iso(self.clock-timedelta(minutes=2))}
        srv.action('/api/sensor',recent)
        self.assertEqual(recent['observed_at'],srv.state()['sensors'][0]['created_at'])

    def test_service_notices_are_shared_resolvable_and_expire(self):
        payload={'title':'Pickup point change','message':'Use the marked campus bay.','severity':'warning','duration_minutes':30}
        created=srv.action('/api/alerts/create',payload)
        self.assertEqual(created['id'],srv.state()['notices'][0]['id'])
        self.clock+=timedelta(minutes=31)
        self.assertEqual([],srv.state()['notices'])
        another=srv.action('/api/alerts/create',payload)
        srv.action('/api/alerts/resolve',{'id':another['id']})
        self.assertEqual([],srv.state()['notices'])
        with self.assertRaises(srv.APIError):srv.action('/api/alerts/create',{**payload,'severity':'invalid'})
        with self.assertRaises(srv.APIError):srv.action('/api/alerts/create',{**payload,'duration_minutes':0})
