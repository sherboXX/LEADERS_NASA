@echo off
rem Opens Freefall in your browser. Close this window to stop the local server.
cd /d "%~dp0"
start "" http://127.0.0.1:8765/
python tools\serve.py
