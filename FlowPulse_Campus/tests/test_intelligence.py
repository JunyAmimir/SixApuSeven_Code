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
