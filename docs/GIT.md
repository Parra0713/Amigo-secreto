# Convenciones de trabajo

Notas para cualquiera que vuelva a tocar el proyecto, incluido el autor dentro de seis
meses.

## Invariantes que no se negocian

1. **`engine/` es puro.** Sin red, sin disco, sin reloj y sin `Math.random`. Entra
   `(estado, acción)`, sale `{ estado, efectos }`, y los efectos son datos. Si una
   función necesita el reloj o el azar, los recibe por parámetro.
2. **La proyección es el único punto de salida.** Nada llega a un cliente sin pasar por
   `engine/proyeccion.js`. Las parejas y las respuestas del cuestionario no salen del
   servidor antes de la revelación. Hay pruebas que lo verifican jugador por jugador.
3. **Sin internet en tiempo de ejecución.** Cero CDN, cero fuentes remotas, cero
   telemetría. Las librerías de terceros se copian a `web/shared/vendor/`.
4. **Configuración antes que código.** Reglas, textos y guiones viven en `config/*.json`.
   Si algo se va a querer ajustar la noche del juego, va en configuración.
5. **Los `.bat` son CRLF y solo ASCII.** Con finales de línea de Unix, `cmd.exe` rompe
   los bloques `if errorlevel 1 (...)` y la ventana se cierra sin mensaje.
   `.gitattributes` lo fija y `tests/arranque.test.js` lo vigila.

## Antes de cada commit

```bash
npm test            # 122 pruebas, ~6 s, sin dependencias de desarrollo
npm run simular 6   # partida completa con jugadores virtuales
```

Una prueba que falla es información, no un estorbo: si el cambio es correcto y la prueba
está vieja, se reescribe la prueba y se explica por qué en el mensaje del commit.

## Mensajes de commit

Una línea de asunto en imperativo y sin punto final (`Agrega…`, `Corrige…`, `Deja de…`),
y un cuerpo que explique **por qué**, no qué archivos cambiaron —eso ya lo dice el diff—.
Si el cambio nace de un error observado, se describe el síntoma.

## Ramas y versiones

- `main` siempre arranca y pasa las pruebas.
- Cambios grandes en una rama `trabajo/<tema>` y de vuelta a `main` cuando esté verde.
- Etiquetas `vX.Y.Z` en los estados que se pueden jugar sin sorpresas.

## Lo que nunca se versiona

| Ruta | Por qué |
|---|---|
| `data/` | Respuestas del cuestionario y parejas: son datos personales de la familia |
| `modelos/` | Modelos de voz de cientos de MB; se bajan con `npm run voz` |
| `node_modules/` | Se reconstruye con `npm ci` |
| `config/local.json` | Ajustes de la máquina del anfitrión (PIN, puerto) |
| `Claude outputs/` | Carpeta de trabajo local, no es del proyecto |

Antes de publicar algo nuevo conviene revisar qué quedó dentro:

```bash
git ls-files | grep -Ev "^(web|docs|engine|server|tests|tools|config)/" 
git grep -nIi -e "192\.168\." -e "C:\\\\Users"      # rutas o IPs reales
```

## Publicar

```bash
git remote add origin https://github.com/Parra0713/Amigo-secreto.git
git push -u origin main
git push origin --tags
```
