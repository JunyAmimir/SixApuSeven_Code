import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import test_backend
srv = test_backend.srv
from unittest.mock import patch
from datetime import datetime, timedelta, timezone
import base64
import io
import json
import intelligence as ai
import unittest


class ForecastTest(unittest.TestCase):
    def setUp(self):
        clock=datetime(2026,11,13,7,0,tzinfo=timezone(timedelta(hours=8)))
        patcher=patch.object(srv,'now',return_value=clock)
        patcher.start()
        self.addCleanup(patcher.stop)
        test_backend.BackendTest.setUp(self)
    tearDown = test_backend.BackendTest.tearDown
    def test_queue_carries_after_departure_and_stale_reading_expires(self):
        srv.action('/api/sensor', {'stop': 'L', 'people': 161})
        forecasts = [x for x in srv.state()['forecasts'] if x['stop'] == 'L']
        self.assertEqual([161, 86, 11], [x['demand'] for x in forecasts[:3]])
        self.assertEqual(2, forecasts[0]['extra_buses'])
        with srv.connect() as db:
            db.execute('UPDATE sensors SET created_at=?', (srv.iso(srv.now()-timedelta(minutes=16)),))
        self.assertEqual(0, srv.state()['forecasts'][0]['demand'])

    def test_history_uses_days_not_camera_frequency(self):
        current = srv.now()
        target = current+timedelta(minutes=15)
        departures = [{'id': 1, 'stop': 'L', 'departs_at': srv.iso(target), 'booked': 120, 'capacity': 75}]
        with srv.connect() as db:
            for count in (10, 10, 10):
                db.execute('INSERT INTO sensors(stop,people,source,created_at) VALUES(?,?,?,?)',
                           ('L', count, 'demo', srv.iso(target-timedelta(days=7))))
            result = ai.forecasts(db, departures, current)[0]
        self.assertEqual(1, result['historical_days'])
        self.assertEqual(120, result['demand'])

    def test_missing_and_reservations_only_are_not_full_demand(self):
        dep={'id':1,'stop':'L','departs_at':srv.iso(srv.now()+timedelta(minutes=10)), 'booked':0,'capacity':75}
        with srv.connect() as db:
            f=ai.forecasts(db,[dep],srv.now())[0]
            self.assertEqual('none',f['evidence'])
            self.assertEqual('needs_data',ai.dispatch_advice([f],[dep],set(),srv.now())[0]['status'])
            dep['booked']=30
            f=ai.forecasts(db,[dep],srv.now())[0]
            self.assertEqual('bookings_only',f['evidence'])
            self.assertEqual(30,f['reserved_floor'])
            self.assertEqual('needs_data',ai.dispatch_advice([f],[dep],set(),srv.now())[0]['status'])

    def test_manual_count_support_has_band_and_never_auto_dispatches(self):
        srv.action('/api/sensor',{'stop':'L','people':161,'source':'manual'})
        state=srv.state()
        f=next(f for f in state['forecasts'] if f['stop']=='L')
        a=next(a for a in state['dispatch_advice'] if a['departure_id']==f['departure_id'])
        self.assertEqual(['manual'],f['sources'])
        self.assertLessEqual(f['planning_low'],f['demand'])
        self.assertGreaterEqual(f['planning_high'],f['demand'])
        self.assertEqual(86,a['shortfall'])
        self.assertEqual(2,a['suggested_buses'])
        self.assertTrue(a['requires_staff_approval'])
        with srv.connect() as db:
            self.assertEqual(0,db.execute('SELECT COUNT(*) FROM dispatches').fetchone()[0])

    def test_pending_and_cutoff_prevent_duplicate_suggestions(self):
        dep={'id':1,'stop':'L','departs_at':srv.iso(srv.now()+timedelta(minutes=10)), 'booked':0,'capacity':75}
        f={'departure_id':1,'demand':200,'evidence':'observations','planning_high':230}
        a=ai.dispatch_advice([f],[dep],{1},srv.now())[0]
        self.assertEqual('pending',a['status']);self.assertFalse(a['can_request'])
        dep['departs_at']=srv.iso(srv.now()+timedelta(minutes=5))
        a=ai.dispatch_advice([f],[dep],set(),srv.now())[0]
        self.assertEqual('closed',a['status']);self.assertFalse(a['can_request'])

    def test_history_median_resists_an_outlier_and_labels_demo(self):
        target=srv.now()+timedelta(minutes=15)
        dep={'id':1,'stop':'L','departs_at':srv.iso(target),'booked':0,'capacity':75}
        with srv.connect() as db:
            for weeks,count in [(1,40),(2,42),(3,1000)]:
                db.execute('INSERT INTO sensors(stop,people,source,created_at) VALUES(?,?,?,?)',
                    ('L',count,'demo',srv.iso(target-timedelta(weeks=weeks))))
            f=ai.forecasts(db,[dep],srv.now())[0]
        self.assertEqual(42,f['demand']);self.assertEqual(3,f['historical_days'])
        self.assertTrue(f['demo_data']);self.assertEqual('low',f['confidence'])


class CameraTest(unittest.TestCase):
    def test_missing_key(self):
        with patch.dict(ai.os.environ, {'GEMINI_API_KEY': ''}):
            with self.assertRaises(ai.IntelligenceError): ai.analyze_image({})

    def test_provider_response_and_invalid_count(self):
        data = {'mime_type': 'image/png', 'image': base64.b64encode(b'\x89PNG\r\n\x1a\n'+b'x'*20).decode()}
        def response(value):
            return io.BytesIO(json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(value)}]}}]}).encode())
        with patch.dict(ai.os.environ, {'GEMINI_API_KEY': 'test-only'}):
            with patch.object(ai, 'urlopen', return_value=response({'people': 42, 'confidence':'medium','notes':'Occlusion'})) as request:
                self.assertEqual(42, ai.analyze_image(data)['people'])
                payload=json.loads(request.call_args.args[0].data)
                self.assertIn('inlineData', payload['contents'][0]['parts'][1])
            with patch.object(ai, 'urlopen', return_value=response({'people': -1, 'confidence':'high','notes':''})):
                with self.assertRaises(ai.IntelligenceError): ai.analyze_image(data)
            with self.assertRaises(ai.IntelligenceError):
                ai.analyze_image({'mime_type':'image/png', 'image':'invalid'})


if __name__ == '__main__': unittest.main()
