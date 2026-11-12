"""Start this project, reuse a matching server and open the browser only when ready."""
import getpass
import hashlib
import json
import os
import runpy
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parent
PROJECT_ID=hashlib.sha256(str(ROOT).casefold().encode()).hexdigest()[:16]


def server_info(port):
    try:
        with urlopen(f'http://127.0.0.1:{port}/api/health',timeout=0.6) as response:
            data=json.load(response)
        return data if isinstance(data,dict) else None
    except (OSError,ValueError):
        return None


def port_available(port):
    try:
        with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as candidate:
            candidate.bind(('127.0.0.1',port))
        return True
    except OSError:
        return False


def choose_port(preferred):
    for port in range(preferred,min(preferred+10,65536)):
        info=server_info(port)
        if info and info.get('app')=='FlowPulse Campus' and info.get('project_id')==PROJECT_ID:
            return port,True
        if port_available(port):return port,False
    raise OSError('No available local port was found. Stop another FlowPulse window and try again.')


def open_when_ready(port):
    if os.environ.get('FLOWPULSE_NO_BROWSER')=='1':return
    for _ in range(60):
        info=server_info(port)
        if info and info.get('project_id')==PROJECT_ID:
            webbrowser.open(f'http://localhost:{port}/login.html')
            return
        time.sleep(0.2)


def main():
    os.chdir(ROOT)
    print('FlowPulse Campus — your VS Code project',flush=True)
    try:
        preferred=int(os.environ.get('PORT','8000'))
        if not 1<=preferred<=65535:raise ValueError()
    except ValueError:
        print('The PORT setting must be a number between 1 and 65535.',flush=True)
        return
    try:port,reused=choose_port(preferred)
    except OSError as error:
        print(str(error),flush=True);return
    if '--camera' in sys.argv and not os.environ.get('GEMINI_API_KEY'):
        key=getpass.getpass('Optional Gemini key (hidden; Enter to skip): ').strip()
        if key:os.environ['GEMINI_API_KEY']=key
    os.environ['PORT']=str(port)
    url=f'http://localhost:{port}/login.html'
    if reused:
        print('This project is already running. Opening '+url,flush=True)
        open_when_ready(port);return
    if port!=preferred:print(f'Port {preferred} is in use. Using {port} for this project.',flush=True)
    print('Open '+url,flush=True)
    print('Keep this server window open while using FlowPulse.',flush=True)
    print('Account credentials are in DEMO_ACCOUNTS.md. Camera setup can wait.',flush=True)
    threading.Thread(target=open_when_ready,args=(port,),daemon=True).start()
    try:runpy.run_path(str(ROOT/'server.py'),run_name='__main__')
    except KeyboardInterrupt:print('FlowPulse stopped.',flush=True)
    except OSError as error:print('FlowPulse could not start: '+str(error),flush=True)


if __name__=='__main__':main()
