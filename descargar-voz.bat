@echo off
setlocal
chcp 437 >nul 2>nul
title Voz neuronal - El Plan del Amigo Secreto
cd /d "%~dp0"

echo ============================================
echo    VOZ NEURONAL DEL GRUPIER
echo ============================================
echo.
echo Esto descarga una voz en espanol mucho mejor que la de Windows.
echo Se hace UNA sola vez y necesita internet (unos 65 MB).
echo Despues el juego sigue funcionando sin internet.
echo.
pause

where node >nul 2>nul
if errorlevel 1 goto sinnode

echo.
echo [1/2] Instalando el motor de voz...
call npm install sherpa-onnx-node@1.13.6 --no-audit --no-fund
if errorlevel 1 goto fallo

echo.
echo [2/2] Descargando la voz...
call node tools/descargar-voz.mjs
if errorlevel 1 goto fallo

echo.
echo [OK] Listo. Abre iniciar.bat y el grupier hablara con la voz nueva.
goto fin

:sinnode
echo [X] No encontre Node.js. Instalalo desde https://nodejs.org y vuelve a intentar.
goto fin

:fallo
echo.
echo [X] Algo fallo. El juego sigue funcionando con la voz de Windows.
echo     Puedes volver a intentar cuando quieras.

:fin
echo.
echo Presiona una tecla para cerrar esta ventana.
pause >nul
