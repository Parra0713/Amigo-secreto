@echo off
setlocal
chcp 437 >nul 2>nul
title El Plan del Amigo Secreto - servidor
cd /d "%~dp0"

echo ============================================
echo    EL PLAN DEL AMIGO SECRETO
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 goto sinnode

echo [1/4] Node.js encontrado:
node -v
echo.

if exist "node_modules\fastify\package.json" goto yainstalado

echo [2/4] Instalando lo que falta. Solo esta vez, y necesita internet...
call npm install --no-audit --no-fund
if errorlevel 1 goto fallainstall
goto listoinstall

:yainstalado
echo [2/4] Dependencias ya instaladas.

:listoinstall
echo [3/4] Abriendo la pantalla de TV en el navegador...
start "" "http://localhost:8080/tv/"

echo [4/4] Arrancando el servidor. NO CIERRES ESTA VENTANA.
echo.
echo     TV:      http://localhost:8080/tv/
echo     Grupier: http://localhost:8080/admin/
echo.
if exist "modelos\vits-piper-es_MX-claude-high" echo     Voz: neuronal en espanol (es_MX)
if not exist "modelos\vits-piper-es_MX-claude-high" echo     Voz: la de Windows. Para una mucho mejor, corre descargar-voz.bat
echo.
echo     Los celulares entran escaneando el codigo QR de la TV.
echo     Para apagar todo: cierra esta ventana.
echo.
node server/index.js
echo.
echo El servidor se detuvo.
goto fin

:sinnode
echo [X] No encontre Node.js en este computador.
echo.
echo     Instalalo desde https://nodejs.org  (escoge la version LTS)
echo     y vuelve a abrir este archivo.
goto fin

:fallainstall
echo.
echo [X] Fallo la instalacion de dependencias.
echo     Conectate a internet y vuelve a intentar.
goto fin

:fin
echo.
echo Presiona una tecla para cerrar esta ventana.
pause >nul
