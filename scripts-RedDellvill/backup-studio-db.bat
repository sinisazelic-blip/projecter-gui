@echo off
REM Backup baze studio_db (MySQL) u folder backups/ sa datumom u imenu.
REM Zahtijeva: mysql klijent u PATH (npr. MySQL Server ili MySQL Workbench instalacija).
REM
REM Postavi varijable (ili ih dodaj u sistemske env):
REM   MYSQL_HOST=localhost
REM   MYSQL_USER=root
REM   MYSQL_PWD=tvoja_lozinka

setlocal
set DB=studio_db
set MYSQL_HOST=db-mysql-nyc3-63902-do-user-31436457-0.e.db.ondigitalocean.com
if "%MYSQL_HOST%"=="" set MYSQL_HOST=localhost

set MYSQL_USER=doadmin
if "%MYSQL_USER%"=="" set MYSQL_USER=root

set BACKUP_DIR=%~dp0backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=1-3 delims=/ " %%a in ('echo %date%') do set D=%%c%%a%%b
for /f "tokens=1-3 delims=:." %%a in ('echo %time%') do set T=%%a%%b%%c
set T=%T: =0%
set OUT=%BACKUP_DIR%\%DB%_%D%_%T%.sql

echo Backup: %DB% -> %OUT%
REM Za DigitalOcean dodaj: --port=25060 --ssl-ca="putanja\do-ca-certificate.crt" (prije %DB%)
REM Ako ne koristis MYSQL_PWD, mysqldump ce pitati za lozinku (-p).
mysqldump -h %MYSQL_HOST% -u %MYSQL_USER% -p --port=25060 --ssl-ca="C:\Users\Studio\OneDrive\mysql tools\DO Studio TAF\ca-certificate.crt" --single-transaction --set-gtid-purged=OFF --routines --triggers %DB% > "%OUT%"
if %errorlevel% neq 0 (
  echo Greska pri backupu. Provjeri lozinku, port, SSL putanju i da je mysqldump u PATH.
)
echo.
echo Gotovo: %OUT%
pause
endlocal
