"""Optional interactive launcher. API key is kept in this process only."""
import getpass
import os
import runpy
from pathlib import Path

if __name__=='__main__':
    os.chdir(Path(__file__).resolve().parent)
    print('FlowPulse Campus — laptop camera and shared dashboards')
    if not os.environ.get('GEMINI_API_KEY'):
        key=getpass.getpass('Gemini API key (hidden; Enter to skip and use manual counts): ').strip()
        if key:os.environ['GEMINI_API_KEY']=key
    print('Open http://localhost:'+os.environ.get('PORT','8000')+' in Chrome, Edge or Opera.')
    print('Staff and driver passwords will be printed below. Camera starts only when you click Start laptop camera.')
    runpy.run_path('server.py',run_name='__main__')
