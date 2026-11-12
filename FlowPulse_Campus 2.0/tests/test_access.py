import json
import os
import unittest
from datetime import timedelta
from unittest.mock import patch
import test_backend

srv=test_backend.srv

class AccessTest(unittest.TestCase):
    def setUp(self):
        test_backend.BackendTest.setUp(self)
        self.environment=patch.dict(os.environ,{
            'FLOWPULSE_STAFF_USERNAME':'apu.staff','FLOWPULSE_STAFF_PASSWORD':'APUstaff@2026',
            'FLOWPULSE_DRIVER_USERNAME':'bus.driver','FLOWPULSE_DRIVER_PASSWORD':'Driver@2026',
            'FLOWPULSE_STUDENT_USERNAME':'student','FLOWPULSE_STUDENT_PASSWORD':'Student@2026','FLOWPULSE_STUDENT_ID':'TP123456'})
        self.environment.start();srv.access.configure();srv.access.ATTEMPTS.clear()
    def tearDown(self):
        self.environment.stop();test_backend.BackendTest.tearDown(self)
    def test_three_credentials_create_the_correct_identity(self):
        with srv.connect() as db:
            for role,defaults in srv.access.DEMO_ACCOUNTS.items():
                token,actual=srv.access.login(db,{'username':defaults['username'],'password':defaults['password'],'role':role},srv.now(),'local')
                self.assertEqual(role,actual)
                identity=srv.access.identity_for(db,'flowpulse_session='+token,srv.now())
                self.assertEqual(defaults['username'],identity['username'])
                row=db.execute('SELECT token_hash FROM sessions WHERE token_hash=?',(srv.access.digest(token),)).fetchone()
                self.assertNotEqual(token,row['token_hash'])
                if role=='student':self.assertEqual('TP123456',identity['student_id'])
    def test_username_password_and_selected_role_must_match(self):
        with srv.connect() as db:
            for data in ({'username':'student','password':'Student@2026','role':'staff'},
                         {'username':'apu.staff','password':'wrong','role':'staff'},
                         {'username':'unknown','password':'Student@2026','role':'student'}):
                with self.assertRaises(ValueError):srv.access.login(db,data,srv.now(),'local')
            with self.assertRaises(ValueError):srv.access.login(db,{'role':'staff','password':'APUstaff@2026'},srv.now(),'local')
    def test_sessions_expire_and_public_options_never_include_passwords(self):
        with srv.connect() as db:
            token,_=srv.access.login(db,{'username':'student','password':'Student@2026'},srv.now(),'local')
            self.assertIsNone(srv.access.identity_for(db,'flowpulse_session='+token,srv.now()+timedelta(hours=9)))
        options=json.dumps(srv.access.account_options())
        for defaults in srv.access.DEMO_ACCOUNTS.values():self.assertNotIn(defaults['password'],options)
    def test_failed_login_attempts_are_rate_limited(self):
        with srv.connect() as db:
            for _ in range(6):
                with self.assertRaises(ValueError):srv.access.login(db,{'username':'student','password':'wrong'},srv.now(),'limited')
            with self.assertRaisesRegex(ValueError,'Too many'):
                srv.access.login(db,{'username':'student','password':'Student@2026'},srv.now(),'limited')
    def test_successful_account_switches_do_not_lock_out_the_demo(self):
        with srv.connect() as db:
            for _ in range(3):
                for role,defaults in srv.access.DEMO_ACCOUNTS.items():
                    _,actual=srv.access.login(db,{'username':defaults['username'],'password':defaults['password'],'role':role},srv.now(),'switching')
                    self.assertEqual(role,actual)
