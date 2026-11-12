@echo off
title FlowPulse Campus Server
cd /d "%~dp0"
echo Starting FlowPulse from this project folder...
echo Keep this window open while using the app.
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
  "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" launcher.py
) else (
  py -3 launcher.py
)
pause
