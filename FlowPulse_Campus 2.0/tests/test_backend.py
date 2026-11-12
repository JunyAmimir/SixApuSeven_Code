import importlib.util
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('flowpulse_server', Path(__file__).resolve().parents[1]/'server.py')
srv=importlib.util.module_from_spec(spec)
spec.loader.exec_module(srv)

class BackendTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        srv.DB=Path(self.tmp.name)/'test.db'
        srv.initialize()

    def tearDown(self):
        self.tmp.cleanup()

    def test_reservation_checkin_cancel(self):
        dep=srv.state()['departures'][0]
        r=srv.action('/api/reserve',{'student_id':'TP123456','departure_id':dep['id']})
        self.assertEqual('reserved',r['status'])
        with self.assertRaises(srv.APIError):
            srv.action('/api/reserve',{'student_id':'TP123456','departure_id':dep['id']})
        with self.assertRaises(srv.APIError):
            srv.action('/api/checkin',{'student_id':'WRONG','reservation_id':r['reservation_id']})
        checked=srv.action('/api/checkin',{'student_id':'TP123456','reservation_id':r['reservation_id']})
        self.assertEqual('checked_in',checked['status'])
        self.assertEqual('cancelled',srv.action('/api/cancel',{'student_id':'TP123456','reservation_id':r['reservation_id']})['status'])

    def test_capacity_and_dispatch(self):
        dep=srv.state()['departures'][0]
        for i in range(75):
            srv.action('/api/reserve',{'student_id':f'TP{i:06d}','departure_id':dep['id']})
        with self.assertRaises(srv.APIError):
            srv.action('/api/reserve',{'student_id':'OVER','departure_id':dep['id']})
        srv.action('/api/dispatch',{'departure_id':dep['id']})
        self.assertEqual('reserved',srv.action('/api/reserve',{'student_id':'OVER','departure_id':dep['id']})['status'])

    def test_parking_bounds_and_sensor(self):
        with self.assertRaises(srv.APIError):
            srv.action('/api/parking',{'lot':'Outdoor','direction':'out'})
        self.assertEqual(1,srv.action('/api/parking',{'lot':'Outdoor','direction':'in'})['occupied'])
        self.assertEqual(0,srv.action('/api/parking',{'lot':'Outdoor','direction':'out'})['occupied'])
        srv.action('/api/sensor',{'stop':'L','people':91,'source':'demo'})
        self.assertEqual(91,srv.state()['sensors'][0]['people'])

if __name__=='__main__': unittest.main()
