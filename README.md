# El Plan del Amigo Secreto

Juego de **revelación** del amigo secreto para una reunión familiar, inspirado en la
mecánica de los juegos de "El Plan del Diablo": compra de información, engaño, dilemas
y una apuesta final. El sorteo se hace aparte; esto solo maneja la revelación.

- **PC anfitrión** con Windows conectado a la TV: sirve el juego y muestra la pantalla grande.
- **Celulares** de los jugadores (5 a 15) entran por el WiFi de la casa, sin instalar nada.
- **Funciona sin internet.** Cero recursos externos en tiempo de ejecución.
- **Voz propia offline.** Dos personajes con voz neuronal (Kokoro), pre-renderizada antes
  de jugar y generada en un hilo aparte para no trabar la partida.
- **El grupier explica cada ronda** en la TV antes de que empiece a correr el reloj.
- Español de Colombia en toda la interfaz.

👉 Si no eres técnico, lee **[docs/GUIA_ANFITRION.md](docs/GUIA_ANFITRION.md)**.

El proyecto sigue evolucionando: el rumbo y las prioridades están en
**[docs/HOJA_DE_RUTA.md](docs/HOJA_DE_RUTA.md)**.

## Arrancar

```bash
git clone https://github.com/Parra0713/Amigo-secreto.git
cd Amigo-secreto
npm install     # solo la primera vez, necesita internet
npm start       # http://localhost:8080/tv/
```

En Windows basta doble clic en `iniciar.bat` (instala si falta, abre la TV y arranca).

| Ruta | Para qué |
|---|---|
| `/tv/` | Pantalla de TV: QR de conexión, marcador, narrador, revelación |
| `/play/` | Celular del jugador |
| `/admin/` | Panel del grupier (PIN en `config/reglas.json`) |

## Pruebas

```bash
npm test                      # 103 pruebas: reglas, pistas, secretos, sesiones, sin-internet, interfaz, arranque
node tests/simulador.js 15          # partida completa de extremo a extremo con 15 bots
node tests/simulador.js 5 --auto    # igual, pero sin tocar el panel: el juego avanza solo
```

El simulador levanta su propio servidor en el puerto 8123 con una carpeta de datos
temporal, juega una partida entera y verifica que ningún cliente haya recibido datos
ajenos. Con 15 bots: ~20 s, 1 % de CPU, 99 MB de RAM.

## Arquitectura en una frase

`engine/` es lógica pura sin I/O (`(estado, acción) -> {estado, efectos}`); `server/` es
una capa delgada de transporte que ejecuta esos efectos y **nunca** manda el estado
completo a un cliente: todo sale por `engine/proyeccion.js`, que arma una vista nueva con
lista blanca por jugador.

Detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). Por qué este stack y no otro,
en [docs/INVESTIGACION.md](docs/INVESTIGACION.md). Reglas de interfaz (derivadas de las
Human Interface Guidelines de Apple) en [docs/HIG.md](docs/HIG.md). Convenciones para
seguir trabajando en el proyecto, en [CLAUDE.md](CLAUDE.md).

```
engine/     reglas puras + rondas como plugins + generador de pistas
server/     Fastify, WebSocket, sesiones por PIN, persistencia JSON atómica
web/        tv/ play/ admin/ shared/   (HTML, CSS y JS planos, sin build)
config/     reglas.json, cuestionario.json, narrador.json, textos.json, groserias.json
tests/      pruebas con node:test + simulador con bots
tools/      voces.html (ver qué voces en español tiene el PC)
```

En Windows: `iniciar.bat` arranca todo, `firewall.bat` da el permiso de red una sola vez
y `diagnostico.bat` imprime qué falta si algo no prende.

## Configuración sin tocar código

| Archivo | Qué cambia |
|---|---|
| `config/reglas.json` | Fichas iniciales, precios, tiempos, bonos, rondas activas, PIN de admin, variantes |
| `config/cuestionario.json` | Preguntas, tipos, opciones, peso y las plantillas de pista de cada nivel |
| `config/narrador.json` | Frases del grupier por evento, el guion de la presentación inicial (`explicacion.pasos`) y los ajustes de voz (`voz`) |
| `config/textos.json` | Textos de la interfaz |
| `config/groserias.json` | Filtro de palabras para apodos y textos libres |

Variable de entorno `PUERTO` (por defecto 8080) y `CARPETA_DATOS` (por defecto `data/`).

## Cómo se arman las pistas

1. Cada respuesta del cuestionario produce **pistas candidatas** en tres niveles de
   detalle (vago / medio / fuerte) usando plantillas en español.
2. El servidor mide **rareza**: cuántos jugadores comparten ese mismo valor derivado.
   Respuesta compartida → pista **fácil** (descarta poco). Respuesta única → **difícil**.
3. Se eligen exactamente **1 fácil + 1 media + 1 difícil**, con temas y preguntas
   distintos, y la fácil **nunca** puede identificar a una sola persona.
4. Filtro de seguridad: ninguna pista puede contener el nombre o apodo de nadie.
5. Las **pistas falsas** se arman con respuestas reales de otros jugadores, verificando
   que no coincidan por accidente con la verdad del montón.
6. Todo es **determinístico con semilla**: la misma partida se puede reproducir tal cual.

## El juego se mueve solo

El grupier ya no tiene que estar apretando botones. En `reglas.json` → `automatico`:

| Momento | Qué hace solo |
|---|---|
| Registro | Cuando todos están listos, cuenta 20 segundos y arranca |
| Rondas 1 y 2 | Cierran cuando todos tocaron "ya terminé" / "no pongo trampa", o cuando ya nadie tiene fichas para actuar |
| Rondas 3 y 4 | Cierran cuando todos eligieron o apostaron |
| Entre rondas | Pausa de 6 segundos y pasa a la siguiente |
| Revelación | Destapa una pareja cada 14 segundos |

Cualquier botón del panel **cancela el temporizador**: intervenir siempre gana. Y el botón
**🤖 Automático / ✋ Manual** apaga el piloto si prefieres manejarlo a mano.

## El narrador

Las voces "Natural" de Microsoft son neuronales pero se transmiten desde la nube y solo
las expone Edge, así que **en una noche sin internet no existen**: Chrome en Windows solo
ve las voces SAPI locales (Sabina, Raúl, Helena, Pablo, Laura). La Web Speech API tampoco
acepta SSML ni deja enrutar su salida al Web Audio API, de modo que no se puede filtrar
ni reverberar la voz.

El carácter del grupier se construye entonces así:

**Dos personajes, dos voces:** el **grupier** (grave, lento) juega con la familia; el
**explicador** (claro, un poco más rápido) enseña las reglas. Si el PC tiene dos voces en
español, cada uno se queda con una; si solo hay una, la comparten con prosodia distinta.

- **Selección de voz por puntaje**: local antes que en línea, `es-CO` > `es-MX` > `es-ES`,
  y voces graves primero para el grupier. El anfitrión puede imponer una voz desde
  `tools/voces.html`.
- **Tono 0.55 y ritmo 0.88**: registro oscuro pero todavía inteligible en una sala.
- **Troceo por frases con pausas reales** (`trocear`): es lo que más ayuda a que un
  sintetizador no suene plano, más que cualquier ajuste de tono.
- **Sub-bajo con batido lento debajo de la voz** mientras habla (`auraEncender`): aporta
  la presencia que la voz sintética no tiene.
- Todo en `config/narrador.json` → `voz`. Si en tu sala no se entiende, sube `pitch` a
  0.70 y `rate` a 0.95.

`tools/voces.html` lista las voces de ese computador, las hace hablar con la prosodia del
juego y deja fijar la elegida.

### Voz neuronal (instalada)

Doble clic en **`descargar-voz.bat`** una vez, con internet: baja el motor
**sherpa-onnx** (Apache-2.0) y la voz **es_MX-claude-high** (Piper, Apache-2.0, ~65 MB).
Después, todo offline.

Con ella el audio lo genera el servidor y llega al navegador como WAV, así que **pasa por
el Web Audio API** — lo que `speechSynthesis` nunca permitió:

| | Grupier | Explicador |
|---|---|---|
| Síntesis / reproducción | 1.10 → 0.87 | 1.0 → 1.0 |
| Tono y formantes | −2,4 semitonos | sin tocar |
| Doblaje desafinado | −16 cents, 24 ms | — |
| Sombra una octava abajo | 13% | — |
| Susurro (pasa-altos, 38 ms) | 9% | — |
| Graves / pecho | +5,5 / +2,5 dB | +1 / 0 dB |
| Presencia 2,5 kHz | −2 dB | +2 dB |
| Sibilancia 6,5 kHz | −5 dB | −2 dB |
| Saturación suave | 0.3 | — |
| Sala (pre-retardo + convolución) | 35 ms, 30% | 12 ms, 8% |
| Eco lejano filtrado | 16% | — |
| Compresión | −22 dB | −18 dB |

El truco central: **se sintetiza rápido y se reproduce lento**. Eso baja tono *y formantes*
sin que el habla se arrastre — bajar solo el tono suena a cinta lenta; bajar los formantes
es lo que hace que la voz suene de un cuerpo más grande. Todos los números están en
`config/narrador.json` → `voces.<personaje>.efectos`, para ajustarlos sin tocar código.
Mientras alguien habla, la música de fondo se agacha sola.

Medido: primera frase 3,2 s (carga del modelo), siguientes ~165 ms, y 0 ms desde caché.
Al arrancar, el servidor **genera de antemano** todas las frases fijas, así que en vivo no
hay espera. Si el modelo no está, o si una frase falla, se usa la voz de Windows como antes.

Detalle completo y comparación de alternativas: [docs/INVESTIGACION_VOZ.md](docs/INVESTIGACION_VOZ.md).
**No subir sherpa-onnx a 2.x**: quitaron el frontend de espeak-ng y la síntesis falla.

## El grupier en 3D

El personaje se construye por procedimiento con **Three.js** (MIT, vendorizado en
`web/shared/vendor/three/`, sin paso de build): capucha abierta por delante, manto
acampanado, ojos dorados con luz propia, y una mesa con cartas, una silla vacía y una vela
que parpadea. La cadera lidera el movimiento, el torso la sigue con 90 ms de retraso y la
capucha con 180 ms.

**La boca se mueve con la amplitud real del audio**, medida con un AnalyserNode sobre la
voz neuronal: abre en las vocales y se cierra en las pausas, sílaba por sílaba. Los ojos
se encienden con ella.

**Pone en escena lo que se está contando.** En la explicación, el personaje ocupa media
pantalla y cada lámina tiene su gesto, su utilería, su encuadre de cámara y **etiquetas
con las cifras encima de la escena** (fácil 1 · media 2 · difícil 4; los pagos del dilema;
el +3 del bono fantasma): las fichas caen y se apilan, las cartas se voltean,
la tarjeta falsa entra desde fuera de cuadro y el personaje se inclina hacia la cámara
como quien cuenta un secreto, las dos puertas del dilema suben, el fantasma flota. Durante
la partida también acompaña: cada fase pone su gesto sin que nadie lo pida.

Todo el diseño responde a [docs/3D_WORLD_HIG.md](docs/3D_WORLD_HIG.md), con su tabla de
verificación. Dos herramientas:

- **`/tv?silueta=1`** renderiza la escena en negro plano, sin luces, para comprobar que el
  personaje se reconoce solo por su contorno.
- Si el PC no tiene WebGL, la TV usa el grupier plano en SVG. Nunca se queda sin personaje.

## La presentación inicial

Al empezar, el grupier explica el juego en la TV, con la boca sincronizada con la voz y
una ilustración SVG animada por lámina (las fichas, el
montón, las tres cartas con su precio, la tarjeta falsa cayendo, las dos puertas del
dilema, el bono fantasma, el telón de la revelación). Diez pasos, con el guion en
`config/narrador.json` → `explicacion.pasos`.

Se lanza con el botón **🎭 Explicar el juego** de la TV o desde el panel del grupier.
Avanza cuando la voz termina cada paso; si el PC no tiene voz en español, avanza por
tiempo estimado, así que nunca se queda congelada. Se salta con cualquier tecla o clic.

## Seguridad y privacidad

- Las parejas y las respuestas del cuestionario **nunca** salen del servidor antes de la
  revelación — ni al admin, ni escondidas en el HTML. Hay pruebas automatizadas que lo
  verifican por jugador.
- El texto de una tarjeta solo viaja al jugador **después** de comprarla.
- La víctima de una trampa no recibe el campo que diría cuál es falsa ni quién la puso.
- PIN de 4 dígitos por jugador, guardado con `scrypt`; máximo 5 intentos por minuto y por IP.
- Todo texto de usuario se limpia (sin HTML) y pasa por un filtro de groserías configurable.
- El servidor escucha en la red local; `firewall.bat` abre el puerto **solo** en perfil privado.

## Hoja de ruta y puntos de extensión

La hoja de ruta viva está en `docs/HOJA_DE_RUTA.md`. Puntos de extensión que el código ya
deja preparados:

- **Más rondas**: un archivo en `engine/rondas/` con `start/handleAction/onTimeout/end`
  y una entrada en `rondasActivas`. No se toca el servidor ni las interfaces.
- **Modo por equipos**: el marcador ya se calcula aparte de los jugadores.
- **Historial y temporadas**: el log `data/eventos.ndjson` es append-only y reconstruye partidas.
- **Redacción con LLM local** (Ollama): detrás de una interfaz `redactor(pista) -> texto`.
  El juego funciona al 100 % sin modelo; un LLM local sería una mejora opcional.
- **SQLite**: reimplementar `server/repositorio.js` (es el único módulo que sabe de disco).

## Limitaciones conocidas

Su estado actualizado está en `docs/HOJA_DE_RUTA.md`.

- La **voz** neuronal suena mejor que la del sistema, pero todavía se percibe sintética, y
  la **presentación del juego** es más plana de lo deseado: son la prioridad de la Etapa 2.

- Con 2 jugadores la ronda de trampa no tiene material (la mentira se arma con la
  respuesta de un tercero), así que el menú no ofrece objetivos y hay que saltar la ronda.
- La **apuesta relámpago** del tercer desempate se marca pero la resuelve el anfitrión a
  mano; no está implementada como ronda.
- No hay voz en **es-CO**: el narrador usa es-MX o es-ES según lo que tenga el PC.
- Dynamic Type real (el ajuste de tamaño de texto del sistema) no lo expone el navegador
  móvil; se aproxima con cuerpo de 17 px y unidades relativas. Ver `docs/HIG.md`.

## Licencia

MIT, ver [LICENSE](LICENSE). Las dependencias y los recursos de terceros conservan la
suya; están listados en [docs/CREDITOS.md](docs/CREDITOS.md).
