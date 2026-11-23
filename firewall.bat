@echo off
setlocal
chcp 437 >nul 2>nul
title Permiso de firewall - El Plan del Amigo Secreto

echo ============================================
echo    PERMISO DE FIREWALL
echo ============================================
echo.
echo Esto permite que los celulares entren al juego.
echo Solo hay que hacerlo UNA VEZ.
echo.
echo Abre SOLO el puerto 8080 y SOLO en redes privadas (tu casa).
echo No expone nada a internet.
echo.
echo Si no lo abriste como administrador, cierra esta ventana,
echo haz clic derecho en el archivo y escoge "Ejecutar como administrador".
echo.
pause

netsh advfirewall firewall add rule name="El Plan del Amigo Secreto" dir=in action=allow protocol=TCP localport=8080 profile=private
if errorlevel 1 goto error

echo.
echo [OK] Listo. Ya puedes abrir iniciar.bat.
goto fin

:error
echo.
echo [X] No se pudo crear la regla.
echo     Cierra esto, haz clic derecho en el archivo
echo     y escoge "Ejecutar como administrador".

:fin
echo.
echo Presiona una tecla para cerrar esta ventana.
pause >nul
