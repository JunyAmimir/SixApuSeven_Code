import threading
import unittest
from urllib.request import urlopen, Request, build_opener, HTTPCookieProcessor, HTTPRedirectHandler
from urllib.error import HTTPError
from http.cookiejar import CookieJar
from unittest.mock import patch
import os
import json
import test_backend

srv=test_backend.srv

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args):return None

class HTTPTest(unittest.TestCase):
    def setUp(self):
        test_backend.BackendTest.setUp(self)
        self.environment=patch.dict(os.environ,{
            'FLOWPULSE_STAFF_USERNAME':'apu.staff','FLOWPULSE_STAFF_PASSWORD':'APUstaff@2026',
            'FLOWPULSE_DRIVER_USERNAME':'bus.driver','FLOWPULSE_DRIVER_PASSWORD':'Driver@2026',
            'FLOWPULSE_STUDENT_USERNAME':'student','FLOWPULSE_STUDENT_PASSWORD':'Student@2026',
            'FLOWPULSE_STUDENT_ID':'TP123456'})
        self.environment.start();srv.access.configure();srv.access.ATTEMPTS.clear()
        self.http=srv.ThreadingHTTPServer(('127.0.0.1',0),srv.Handler)
        self.worker=threading.Thread(target=self.http.serve_forever,daemon=True);self.worker.start()
        self.base=f'http://127.0.0.1:{self.http.server_port}'
        self.headers={'Content-Type':'application/json','X-FlowPulse-Request':'1'}
    def tearDown(self):
        self.http.shutdown();self.http.server_close();self.worker.join();self.environment.stop()
        test_backend.BackendTest.tearDown(self)
    def client(self):return build_opener(HTTPCookieProcessor(CookieJar()),NoRedirect())
    def post(self,client,path,body):return client.open(Request(self.base+path,data=json.dumps(body).encode(),headers=self.headers))
    def sign_in(self,role):
        username,password={'staff':('apu.staff','APUstaff@2026'),'driver':('bus.driver','Driver@2026'),'student':('student','Student@2026')}[role]
        client=self.client()
        with self.post(client,'/api/login',{'username':username,'password':password,'role':role}) as response:
            self.assertIn('HttpOnly',response.headers['Set-Cookie']);self.assertEqual(role,json.load(response)['role'])
        return client
    def assert_http(self,code,call):
        with self.assertRaises(HTTPError) as error:call()
        self.assertEqual(code,error.exception.code)
        return error.exception
    def test_login_page_and_routes_require_the_right_account(self):
        anonymous=self.client()
        for path in ('/','/index.html','/staff','/driver','/student'):
            error=self.assert_http(303,lambda p=path:anonymous.open(self.base+p))
            self.assertEqual('/login.html',error.headers['Location'])
        with anonymous.open(self.base+'/login.html') as response:self.assertIn(b'accountLoginForm',response.read())
        for path in ('/js/login.js','/css/login.css','/js/portal.js'):
            with anonymous.open(self.base+path) as response:self.assertEqual(200,response.status)
        with anonymous.open(self.base+'/api/session') as response:
            data=json.load(response);self.assertIsNone(data['user']);self.assertEqual(3,len(data['accounts']))
        self.assert_http(401,lambda:anonymous.open(self.base+'/api/state'))
        for role,path in [('staff','/staff'),('driver','/driver'),('student','/student')]:
            client=self.sign_in(role)
            with client.open(self.base+path) as response:self.assertIn(b'portal.js',response.read())
            other='/staff' if role!='staff' else '/student'
            error=self.assert_http(303,lambda:client.open(self.base+other))
            self.assertEqual(path,error.headers['Location'])
    def test_staff_driver_and_student_permissions_are_separate(self):
        staff,driver,student=[self.sign_in(role) for role in ('staff','driver','student')]
        for client in (driver,student):
            self.assert_http(403,lambda:self.post(client,'/api/sensor',{'stop':'L','people':4}))
            self.assert_http(403,lambda:self.post(client,'/api/alerts/create',{'title':'No','message':'No'}))
        for client in (staff,student):self.assert_http(403,lambda:self.post(client,'/api/driver/respond',{'dispatch_id':'missing','response':'accepted'}))
        dep=srv.state()['departures'][0]
        for client in (staff,driver):self.assert_http(403,lambda:self.post(client,'/api/reserve',{'departure_id':dep['id']}))
        with self.post(staff,'/api/sensor',{'stop':'L','people':88}) as response:self.assertEqual(88,json.load(response)['people'])
        self.assert_http(403,lambda:staff.open(Request(self.base+'/api/sensor',data=b'{}',headers={'Content-Type':'application/json'})))
    def test_student_ownership_and_cross_device_booking_recovery(self):
        student=self.sign_in('student');dep=srv.state()['departures'][0]
        self.assert_http(403,lambda:self.post(student,'/api/reserve',{'departure_id':dep['id'],'student_id':'TP999999'}))
        with self.post(student,'/api/reserve',{'departure_id':dep['id']}) as response:own=json.load(response)
        self.assertEqual('TP123456',own['student_id'])
        foreign=srv.action('/api/reserve',{'student_id':'TP999999','departure_id':dep['id']})
        for endpoint in ('/api/ticket','/api/cancel','/api/reservations/lookup'):
            self.assert_http(404,lambda p=endpoint:self.post(student,p,{'reservation_id':foreign['reservation_id']}))
        other_device=self.sign_in('student')
        with other_device.open(self.base+'/api/state') as response:
            data=json.load(response);self.assertEqual([],data['events']);self.assertEqual([],data['dispatches'])
            self.assertEqual([own['reservation_id']],[r['id'] for r in data['reservations']])
        with self.post(other_device,'/api/ticket',{'reservation_id':own['reservation_id']}) as response:self.assertIn('<svg',json.load(response)['svg'])
    def test_student_can_cancel_and_rebook_with_a_new_ticket(self):
        student=self.sign_in('student');dep=srv.state()['departures'][0]
        with self.post(student,'/api/reserve',{'departure_id':dep['id']}) as response:first=json.load(response)
        with self.post(student,'/api/cancel',{'reservation_id':first['reservation_id']}) as response:self.assertEqual('cancelled',json.load(response)['status'])
        with self.post(student,'/api/reserve',{'departure_id':dep['id']}) as response:second=json.load(response)
        self.assertNotEqual(first['reservation_id'],second['reservation_id'])
        self.assert_http(404,lambda:self.post(student,'/api/ticket',{'reservation_id':first['reservation_id']}))
    def test_signout_revokes_sessions_and_private_files_are_blocked(self):
        client=self.sign_in('staff')
        with client.open(self.base+'/api/state') as response:self.assertEqual(20,len(json.load(response)['forecasts']))
        for path in ('/flowpulse.db','/DEMO_ACCOUNTS.md','/server.py','/.env','/js/../server.py'):
            self.assert_http(404,lambda p=path:client.open(self.base+p))
        self.assert_http(405,lambda:client.open(Request(self.base+'/flowpulse.db',method='HEAD')))
        with self.post(client,'/api/logout',{}) as response:self.assertEqual(0,response.status-200)
        self.assert_http(401,lambda:client.open(self.base+'/api/state'))
        self.assert_http(401,lambda:self.post(client,'/api/sensor',{'stop':'L','people':1}))
