# Instalar el juego en otro PC

Quince minutos la primera vez, y de ahí en adelante es doble clic. El PC que hace de
anfitrión es el que se conecta al TV; los celulares no instalan nada.

## Lo que hace falta

- Un PC con **Windows 10 u 11** (también sirve macOS o Linux, ver abajo).
- **Node.js 22 o superior**: https://nodejs.org — el instalador de siempre, "Next" hasta
  el final. Para comprobarlo, abre PowerShell y escribe `node -v`.
- Internet **solo para instalar**. La noche del juego no hace falta.
- Unos **600 MB** libres: 415 MB de voces y el resto del banco de frases ya preparadas.
- El PC y los celulares en **el mismo WiFi**.

## 1. Traer el proyecto

Con Git instalado, en PowerShell:

```powershell
cd $HOME\Documents
git clone https://github.com/Parra0713/Amigo-secreto.git
cd Amigo-secreto
```

Sin Git: en la página del repositorio, botón verde **Code → Download ZIP**, y
descomprimir donde quieras. Si vas a actualizar el juego cada tanto, mejor con Git.

## 2. Instalar y probar

Doble clic en **`iniciar.bat`**. La primera vez instala lo que falta (necesita internet),
abre la pantalla de TV en el navegador y arranca el servidor. **No cierres esa ventana
negra**: es el juego corriendo.

Si se abre y se cierra sola, corre **`diagnostico.bat`**, que dice qué falta.

Deberías ver la pantalla de TV con un código QR. Ciérrala por ahora.

## 3. La voz del grupier

Doble clic en **`descargar-voz.bat`**. Descarga las dos voces (415 MB) y después prepara
las frases, lo que toma entre 5 y 15 minutos según el PC. Déjalo corriendo.

Esto es lo que hace que el grupier hable con voz propia y no con la de Windows. **Se hace
una sola vez** y después el juego funciona sin internet.

Si lo saltas, el juego funciona igual con la voz del sistema, que suena peor.

## 4. Dejar pasar el WiFi

Doble clic en **`firewall.bat`** (pide permiso de administrador). Abre el puerto 8080
solo en redes privadas, que es lo que necesitan los celulares de la casa para entrar.

Sin esto, el QR de la TV no abre nada en los celulares.

## 5. La noche del juego

1. Conecta el PC al TV por HDMI.
2. Doble clic en `iniciar.bat`.
3. Pon la pantalla de TV (`http://localhost:8080/tv/`) en pantalla completa con **F11**.
4. Abre en otra pestaña el panel del grupier: `http://localhost:8080/admin/`. El PIN está
   en `config\reglas.json` (por defecto **2468**; cámbialo si quieres).
5. Cada invitado escanea el QR de la TV con la cámara del celular.

El resto está en **[GUIA_ANFITRION.md](GUIA_ANFITRION.md)**, que es la guía de la noche.

## macOS y Linux

No hay `.bat`, pero es lo mismo:

```bash
git clone https://github.com/Parra0713/Amigo-secreto.git
cd Amigo-secreto
npm install
npm run voz kokoro     # la voz buena, 350 MB
npm run voz alta       # la rápida de respaldo, 65 MB
npm run voces          # prepara las frases: tarda unos minutos
npm start              # http://localhost:8080/tv/
```

El firewall lo abres a mano para el puerto 8080 en la red local.

## Actualizar a la última versión

```powershell
cd $HOME\Documents\Amigo-secreto
git pull
npm install            # por si entraron dependencias nuevas
npm run voces          # por si cambiaron frases del guion
```

`git pull` **no borra** tus partidas ni las voces descargadas: `data/` y `modelos/` no
están en el repositorio, viven solo en tu PC.

Si `git pull` se queja de cambios locales porque tocaste algún archivo de `config/`:

```powershell
git stash              # guarda tus cambios aparte
git pull
git stash pop          # los vuelve a poner encima
```

## Si algo no funciona

| Lo que pasa | Qué hacer |
|---|---|
| La ventana negra se abre y se cierra | Corre `diagnostico.bat`: dice qué falta |
| `node` no se reconoce | Node no quedó instalado o falta reiniciar PowerShell |
| El QR no abre nada en el celular | Falta `firewall.bat`, o el celular está en otro WiFi (ojo con las redes de 5 GHz separadas) |
| El grupier no habla | Corre `descargar-voz.bat`. Mientras tanto usa la voz de Windows |
| El grupier se ve plano, sin 3D | El navegador no dio WebGL. Prueba con Chrome o Edge actualizados |
| Se cayó el PC a mitad de partida | Vuelve a abrir `iniciar.bat`: la partida sigue donde estaba y los celulares se reconectan solos |

## Lo que se queda en tu PC y nunca se sube

Las respuestas del cuestionario y las parejas del sorteo son datos de tu familia: viven
en `data/`, que está excluido del repositorio. Las voces descargadas (`modelos/`) y el
banco de frases tampoco se suben, por tamaño.
