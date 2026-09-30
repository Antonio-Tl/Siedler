@echo off
rem Siedler starten (Windows) - Doppelklick genuegt.
rem Optional anderer Port:  set PORT=8080 ^&^& start.bat
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if "%PORT%"=="" set PORT=5274
set URL=http://localhost:%PORT%

echo.
echo  Siedler - Inselspiel
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js wurde nicht gefunden. Bitte Node.js 18 oder neuer installieren: https://nodejs.org
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 18 (
  echo Node.js ist zu alt. Benoetigt wird Version 18 oder neuer: https://nodejs.org
  pause
  exit /b 1
)
echo OK  Node.js gefunden

if not exist node_modules (
  echo ... Installiere Abhaengigkeiten ^(einmalig^)
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo npm install ist fehlgeschlagen.
    pause
    exit /b 1
  )
)
echo OK  Abhaengigkeiten bereit
echo.
echo  Siedler laeuft auf %URL%
echo  Mitspieler im WLAN nutzen die IPv4-Adresse dieses PCs ^(siehe "ipconfig"^) mit Port %PORT%.
echo  Zum Beenden dieses Fenster schliessen oder Strg+C druecken.
echo.

rem Browser kurz nach dem Serverstart oeffnen
start "" /min cmd /c "timeout /t 2 /nobreak >nul && start %URL%"
node server\index.js
pause
