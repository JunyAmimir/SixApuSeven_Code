import threading
import unittest
from urllib.request import urlopen, Request
from urllib.error import HTTPError
import json
import os
from unittest.mock import patch
from http.cookiejar import CookieJar
from urllib.request import build_opener, HTTPCookieProcessor
import test_backend

srv = test_backend.srv


class HTTPTest(unittest.TestCase):
    setUp = test_backend.BackendTest.setUp
    tearDown = test_backend.BackendTest.tearDown

    def test_public_assets_state_and_private_file_blocking(self):
        http = srv.ThreadingHTTPServer(('127.0.0.1', 0), srv.Handler)
        worker = threading.Thread(target=http.serve_forever, daemon=True)
        worker.start()
        base = f'http://127.0.0.1:{http.server_port}'
        try:
            for path in ('/', '/js/live.js', '/css/main.css'):
                with urlopen(base+path) as response:
                    self.assertEqual(200, response.status)
            with urlopen(base+'/api/state') as response:
                self.assertEqual(20, len(json.load(response)['forecasts']))
            for path in ('/flowpulse.db', '/server.py', '/.env', '/js/../server.py'):
                with self.assertRaises(HTTPError) as error:
                    urlopen(base+path)
                self.assertEqual(404, error.exception.code)
            with self.assertRaises(HTTPError) as error:
                urlopen(Request(base+'/flowpulse.db', method='HEAD'))
            self.assertEqual(405, error.exception.code)
            headers={'Content-Type':'application/json','X-FlowPulse-Request':'1'}
            req = Request(base+'/api/sensor', data=json.dumps({'stop':'C','people':88}).encode(), headers=headers)
            with self.assertRaises(HTTPError) as error: urlopen(req)
            self.assertEqual(401,error.exception.code)
            with patch.dict(os.environ,{'FLOWPULSE_STAFF_PASSWORD':'staff-test-only','FLOWPULSE_DRIVER_PASSWORD':'driver-test-only'}):
                srv.access.configure()
            srv.access.ATTEMPTS.clear()
            client=build_opener(HTTPCookieProcessor(CookieJar()))
            login=Request(base+'/api/login',data=json.dumps({'role':'staff','password':'staff-test-only'}).encode(),headers=headers)
            with client.open(login) as response:
                self.assertIn('HttpOnly',response.headers['Set-Cookie'])
                self.assertEqual('staff',json.load(response)['role'])
            with client.open(req) as response: self.assertEqual(88,json.load(response)['people'])
            # Driver cannot use staff-only mutation endpoints.
            driver=build_opener(HTTPCookieProcessor(CookieJar()))
            with driver.open(Request(base+'/api/login',data=json.dumps({'role':'driver','password':'driver-test-only'}).encode(),headers=headers)): pass
            with self.assertRaises(HTTPError) as error: driver.open(Request(base+'/api/sensor',data=json.dumps({'stop':'C','people':88}).encode(),headers=headers))
            self.assertEqual(401,error.exception.code)
            for opener in (urlopen,driver.open):
                with self.assertRaises(HTTPError) as error:
                    opener(Request(base+'/api/alerts/create',data=json.dumps({'title':'No access','message':'Should not publish','duration_minutes':30}).encode(),headers=headers))
                self.assertEqual(401,error.exception.code)
            with self.assertRaises(HTTPError) as error:
                client.open(Request(base+'/api/sensor',data=b'{}',headers={'Content-Type':'application/json'}))
            self.assertEqual(403,error.exception.code)
            # Public state does not disclose students, private codes or event log.
            dep=srv.state()['departures'][0]
            booking=srv.action('/api/reserve',{'student_id':'TP654321','departure_id':dep['id']})
            with urlopen(base+'/api/state') as response:
                data=json.load(response)
                self.assertEqual([],data['reservations']);self.assertEqual([],data['events'])
            lookup=Request(base+'/api/reservations/lookup',data=json.dumps(booking).encode(),headers=headers)
            with urlopen(lookup) as response: self.assertEqual('TP654321',json.load(response)['student_id'])
            with client.open(Request(base+'/api/logout',data=b'{}',headers=headers)): pass
            with self.assertRaises(HTTPError) as error: client.open(Request(base+'/api/sensor',data=json.dumps({'stop':'C','people':88}).encode(),headers=headers))
            self.assertEqual(401,error.exception.code)
        finally:
            http.shutdown()
            http.server_close()
            worker.join()
