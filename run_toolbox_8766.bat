@echo off
cd /d "%~dp0"
set PORT=8766
set PYTHON_EXE=C:\Users\win\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe
"%PYTHON_EXE%" "%~dp0app.py"
pause
