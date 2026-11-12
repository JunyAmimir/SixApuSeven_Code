import unittest
from unittest.mock import patch
import launcher

class StartupTest(unittest.TestCase):
    def test_reuses_only_a_server_from_this_project(self):
        with patch.object(launcher,'server_info',return_value={'app':'FlowPulse Campus','project_id':launcher.PROJECT_ID}),patch.object(launcher,'port_available') as available:
            self.assertEqual((8000,True),launcher.choose_port(8000));available.assert_not_called()
    def test_busy_port_from_another_project_uses_next_available_port(self):
        with patch.object(launcher,'server_info',side_effect=[{'app':'FlowPulse Campus','project_id':'another-project'},None]),patch.object(launcher,'port_available',side_effect=[False,True]):
            self.assertEqual((8001,False),launcher.choose_port(8000))
    def test_browser_opens_only_after_the_correct_server_is_ready(self):
        with patch.dict(launcher.os.environ,{'FLOWPULSE_NO_BROWSER':'0'}),patch.object(launcher,'server_info',side_effect=[None,{'project_id':launcher.PROJECT_ID}]),patch.object(launcher.time,'sleep'),patch.object(launcher.webbrowser,'open') as opened:
            launcher.open_when_ready(8000);opened.assert_called_once_with('http://localhost:8000/login.html')
