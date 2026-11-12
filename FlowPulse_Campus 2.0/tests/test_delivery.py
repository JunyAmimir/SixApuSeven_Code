import os
import unittest
from datetime import timedelta
from unittest.mock import patch
import json
import test_backend
import delivery

srv=test_backend.srv


class DeliveryTest(unittest.TestCase):
    setUp=test_backend.BackendTest.setUp
    tearDown=test_backend.BackendTest.tearDown

    def test_webhook_outbox_retry_and_success(self):
        dep=srv.state()['departures'][0]
        with patch.dict(os.environ,{'DRIVER_WEBHOOK_URL':'https://driver.example.test/dispatch'}):
            job=srv.action('/api/dispatch',{'departure_id':dep['id'],'mode':'live'})
            with patch.object(delivery,'build_opener') as factory:
                factory.return_value.open.side_effect=TimeoutError()
                delivery.deliver_one(srv.connect,srv.now())
            with srv.connect() as db:
                row=dict(db.execute('SELECT * FROM dispatches WHERE id=?',(job['dispatch_id'],)).fetchone())
                self.assertEqual('retry',row['delivery_status']);self.assertEqual(1,row['delivery_attempts'])
            later=srv.now()+timedelta(minutes=3)
            with patch.object(delivery,'build_opener') as factory:
                factory.return_value.open.return_value.__enter__.return_value.status=204
                delivery.deliver_one(srv.connect,later)
                request=factory.return_value.open.call_args.args[0]
                self.assertEqual(job['dispatch_id'],request.get_header('Idempotency-key'))
                self.assertEqual(job['dispatch_id'],json.loads(request.data)['dispatch_id'])
            with srv.connect() as db:
                row=dict(db.execute('SELECT * FROM dispatches WHERE id=?',(job['dispatch_id'],)).fetchone())
                self.assertEqual('delivered',row['delivery_status'])
                self.assertEqual('requested',row['status'])
                self.assertEqual(75,db.execute('SELECT capacity FROM departures WHERE id=?',(dep['id'],)).fetchone()[0])
            with patch.object(delivery,'build_opener') as factory:
                delivery.deliver_one(srv.connect,later)
                factory.assert_not_called()

    def test_insecure_external_webhook_is_not_called(self):
        with patch.dict(os.environ,{'DRIVER_WEBHOOK_URL':'http://driver.example.test/dispatch'}),patch.object(delivery,'build_opener') as factory:
            delivery.deliver_one(srv.connect,srv.now());factory.assert_not_called()
