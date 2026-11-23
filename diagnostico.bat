@echo off
setlocal
chcp 437 >nul 2>nul
title Diagnostico - El Plan del Amigo Secreto
cd /d "%~dp0"

echo ============================================
echo    DIAGNOSTICO
echo ============================================
echo.
echo Carpeta actual:
cd
echo.
echo Node.js:
where node
node -v
echo.
echo npm:
where npm
call npm -v
echo.
echo Archivos clave:
if exist "server\index.js" echo   [OK] server\index.js
if not exist "server\index.js" echo   [X] FALTA server\index.js
if exist "node_modules\fastify\package.json" echo   [OK] node_modules\fastify
if not exist "node_modules\fastify\package.json" echo   [X] FALTA node_modules (hay que correr npm install)
if exist "config\reglas.json" echo   [OK] config\reglas.json
if not exist "config\reglas.json" echo   [X] FALTA config\reglas.json
echo.
echo Voz neuronal:
if exist "modelos\vits-piper-es_MX-claude-high\es_MX-claude-high.onnx" echo   [OK] modelo instalado
if not exist "modelos\vits-piper-es_MX-claude-high\es_MX-claude-high.onnx" echo   [ ] sin modelo - se usa la voz de Windows (corre descargar-voz.bat)
if exist "node_modules\sherpa-onnx-node" echo   [OK] motor de voz instalado
if not exist "node_modules\sherpa-onnx-node" echo   [ ] sin motor de voz
echo.
echo Puerto 8080 en uso por:
netstat -ano ^| findstr ":8080"
echo.
echo Pruebas del motor:
call npm test
echo.
echo ============================================
echo Si todo sale [OK] y las pruebas pasan, abre iniciar.bat.
echo Si algo sale [X], manda esta pantalla completa.
echo ============================================
echo.
pause >nul
