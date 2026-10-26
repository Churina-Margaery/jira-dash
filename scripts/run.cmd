@echo off
cd /d "%~dp0\.."
if "%~1"=="" (
  node dist\cli.js run
) else (
  node dist\cli.js %*
)
