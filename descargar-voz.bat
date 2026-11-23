@echo off
setlocal
chcp 437 >nul 2>nul
title Voz del grupier - El Plan del Amigo Secreto
cd /d "%~dp0"

echo ============================================
echo    LA VOZ DEL GRUPIER
echo ============================================
echo.
echo Esto deja al grupier hablando con voz de verdad, sin internet
echo durante el juego. Se hace UNA sola vez.
echo.
echo Va a descargar unos 415 MB y despues va a preparar las frases,
echo que toma entre 5 y 15 minutos segun el PC. Puedes dejarlo
echo corriendo y hacer otra cosa.
echo.
pause

where node >nul 2>nul
if errorlevel 1 goto sinnode

echo.
echo [1/4] Instalando el motor de voz...
call npm install sherpa-onnx-node@1.13.6 --no-audit --no-fund
if errorlevel 1 goto fallo

echo.
echo [2/4] Descargando la voz buena (Kokoro, 350 MB)...
call node tools/descargar-voz.mjs kokoro
if errorlevel 1 goto fallo

echo.
echo [3/4] Descargando la voz rapida de respaldo (Piper, 65 MB)...
call node tools/descargar-voz.mjs alta
if errorlevel 1 goto fallo

echo.
echo [4/4] Preparando las frases. Esto es lo que tarda.
call node tools/prerenderizar.mjs 2
if errorlevel 1 goto fallofrases

echo.
echo [OK] Listo. Abre iniciar.bat y el grupier ya habla.
goto fin

:fallofrases
echo.
echo [!] Las voces quedaron descargadas pero no alcance a preparar las frases.
echo     El juego funciona igual: las genera sobre la marcha.
echo     Puedes volver a correr este archivo cuando quieras.
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
