# Arquitectura — El Plan del Amigo Secreto

> Decisiones menores tomadas sobre la marcha se anotan al final, en "Bitácora de decisiones".
>
> Documento vivo: describe la arquitectura **actual** y evoluciona con el proyecto (ver
> `docs/HOJA_DE_RUTA.md`).

## 1. Stack

- **Runtime:** Node.js 22 LTS o 24 LTS (Windows x64).
- **Servidor:** Fastify 5 + `@fastify/static` + `@fastify/websocket`.
- **Cliente:** HTML/CSS/JS plano, sin paso de build. Módulos ES nativos.
- **Persistencia:** JSON con escritura atómica detrás de un puerto `Repositorio`.
- **Pruebas:** `node:test` (integrado en Node). **Cero dependencias de desarrollo.**
- Justificación completa: `docs/INVESTIGACION.md`.

## 2. Mapa del proyecto

```
engine/            lógica pura, sin I/O, sin red, sin reloj propio
  estado.js        crear/validar el estado de la partida
  fichas.js        movimientos de fichas (única vía para sumar o restar)
  pistas/          cuestionario -> candidatas -> rareza -> selección 1F+1M+1D
  rondas/          un módulo por ronda, misma interfaz
  azar.js          PRNG con semilla (mulberry32) — nada de Math.random en engine/
  proyeccion.js    vistaPara(estado, jugadorId) -> solo lo que ESE jugador puede ver
server/
  index.js         arranque, Fastify, estáticos
  ws.js            transporte: sockets, sesiones, reenvío
  sesiones.js      PIN -> jugador, intentos fallidos, reconexión
  repositorio.js   snapshot atómico + log de eventos
  reloj.js         temporizadores de ronda (el engine no mide tiempo)
web/tv|play|admin  3 páginas independientes + web/shared
config/            reglas.json, cuestionario.json, narrador.json, textos.json
```

**Regla de oro:** `engine/` no importa nada de `server/`. Es una función del tipo
`(estado, accion) -> { estado, efectos[] }`. Los efectos son datos (`{tipo:'narrar', evento:'trampa'}`),
no llamadas. El servidor los ejecuta. Por eso el motor se puede probar sin levantar nada.

## 3. Modelo de datos

```js
Partida {
  id, version, semilla,                 // semilla fija => partida reproducible
  fase: 'registro'|'ronda1'|'ronda2'|'ronda3'|'ronda4'|'revelacion'|'fin',
  config,                               // copia de reglas.json al crear la partida
  jugadores: { [id]: Jugador },
  parejas:   { [jugadorId]: receptorId },   // SECRETO. Nunca sale del servidor
  respuestas:{ [jugadorId]: { [preguntaId]: valor } },  // SECRETO
  montones:  { [duenoId]: [Tarjeta] },
  dilema, apuestas, marcador, eventos: [Evento]
}

Jugador  { id, apodo, avatar, pinHash, fichas, conectado, registroCompleto }
Tarjeta  { id, duenoId, nivel:'facil'|'media'|'dificil', texto,
           origen:'auto'|'manual'|'trampa', preguntaId, autorId, comprada }
Evento   { n, ts, tipo, payload }       // log append-only; reconstruye la partida
```

`autorId` de una trampa **solo se revela en la fase `revelacion`**. `parejas` y
`respuestas` no se serializan jamás hacia un cliente.

## 4. Seguridad del estado: proyección por jugador

Todo mensaje al cliente pasa por `proyeccion.vistaPara(estado, jugadorId)`, que **construye
un objeto nuevo** con lista blanca de campos. No existe la operación "mandar el estado y
ocultar unos campos": el default es no enviar nada.

Lo que ve un jugador: sus fichas, su montón (texto solo de las tarjetas que compró),
el marcador público (apodo + fichas), la fase y el tiempo restante.
Lo que ve `/tv`: marcador, fase, textos del narrador, QR. Nunca contenido de tarjetas.
Lo que ve `/admin`: lo de `/tv` + conteos anónimos (cuántas pistas se generaron,
qué montones quedaron incompletos), nunca contenido ni parejas.

Una prueba automatizada (`tests/secretos.test.js`) recorre la proyección de cada jugador
y falla si aparece el id, el apodo o una respuesta de otro.

## 5. Protocolo (WebSocket, JSON)

Un solo socket por cliente. Mensajes `{t: tipo, ...}`.

**Cliente → servidor** (son *intenciones*; el servidor valida todo):

| Tipo | Payload | Validación clave |
|---|---|---|
| `hola` | `{rol:'play'|'tv'|'admin', jugadorId?, pin?}` | PIN correcto; máx. 5 intentos por IP y minuto |
| `registro.cuestionario` | `{respuestas:{}}` | mínimo de respuestas de `reglas.json` |
| `registro.pareja` | `{receptorId}` | no puede ser uno mismo; solo una vez |
| `registro.tarjetas` | `{facil?,media?,dificil?}` | longitud, sanitizado, filtro de groserías |
| `ronda1.comprar` | `{tarjetaId}` | fase correcta, es su montón, fichas suficientes |
| `ronda2.trampa` | `{victimaId, categoria, nivel}` | no es su montón, ≤1 por jugador, ≤2 falsas por montón, 1 ficha |
| `ronda3.elegir` | `{opcion:'cooperar'|'guardar'}` | está emparejado, no eligió aún |
| `ronda4.apostar` | `{sospechosoId, monto}` | `1 <= monto <= fichas`, antes del cierre |
| `ping` | — | mantiene viva la conexión |
| `tv.entradaLista` | — | solo rol `tv`: avisa que terminó de explicar la ronda |

**Servidor → cliente:**

| Tipo | Para quién | Contenido |
|---|---|---|
| `vista` | jugador | su proyección completa (se reenvía entera al reconectar) |
| `publico` | tv/admin/todos | fase, marcador, cuenta regresiva |
| `narrador` | tv (y play en texto) | `{evento, texto, voz:true}` |
| `efecto` | tv | `{tipo:'confeti'|'redoble'|'fichas', ...}` |
| `entradaRonda` | tv / play | tv recibe el guion (`entrada`); el celular, solo `titulo` |
| `entradaLista` | todos | terminó la explicación, ya corre el reloj |
| `error` | quien lo causó | `{codigo, mensaje}` |

**Reconexión:** el cliente guarda `jugadorId` en `localStorage` y reenvía `hola` con su
PIN; el servidor responde con `vista` completa. No hay estado en el cliente que se pueda
perder, porque el cliente nunca es la fuente de la verdad.

## 6. Rondas como plugins

```js
export default {
  id: 'ronda2',
  nombre: 'Trampa',
  start(estado, ctx)                -> { estado, efectos },
  handleAction(estado, accion, ctx) -> { estado, efectos },
  onTimeout(estado, ctx)            -> { estado, efectos },
  end(estado, ctx)                  -> { estado, efectos }
}
```

`ctx` trae `{ azar, config, ahora }`. Añadir una ronda = un archivo en `engine/rondas/` y
una entrada en `reglas.json.rondasActivas`. El servidor y las interfaces no se tocan.

## 7. Diagrama

```
  CELULARES (/play)            TV (/tv)            PC (/admin)
        |  ws                    |  ws                 |  ws
        +------------+-----------+---------------------+
                     |
              server/ws.js  --- sesiones.js (PIN, reconexión)
                     |
              proyeccion.vistaPara()      <-- único punto de salida de datos
                     |
                 engine/  (puro)  ---- rondas/ (plugins)  ---- pistas/
                     |
              repositorio.js  --> data/partida.json (+ eventos.ndjson)
```

## 8. Flujo de una partida

```
registro -> ronda1 compra -> ronda2 trampa -> ronda3 dilema -> ronda4 apuesta
         -> cálculo de bonos fantasma -> desempates -> revelación 1 a 1 -> fin
```

Cada transición se dispara por: todos listos, timeout de la ronda, o el admin.

## 9. Bitácora de decisiones

- **2026-11-22** — Carpeta del proyecto se queda en `OneDrive\Documents`: el usuario
  confirma que OneDrive ya no está instalado y la ruta es solo un rezago. Sin junctions.
- **2026-11-22** — Semilla del PRNG se guarda en la partida: permite reproducir
  exactamente una partida para depurar y es lo que exige el criterio de aceptación.
- **2026-11-22** — PIN de jugador se guarda hasheado (scrypt de `node:crypto`), aunque sea
  de 4 dígitos, para que un volcado del JSON no entregue los accesos.
- **2026-11-22** — Las pruebas se escriben con `node:test` en vez de `vitest`: viene
  integrado en Node, corre sin instalar nada y por tanto funciona en un PC sin internet.
  El proyecto queda con 4 dependencias de producción y ninguna de desarrollo.
- **2026-11-22** — `avanzar()` es idempotente en `revelacion` y `fin`: desde ahí solo
  se avanza con `revelar.siguiente` (lo pilló una prueba de secretos).
- **2026-11-23** — Los `.bat` se reescribieron con **CRLF y solo ASCII**: con finales de
  línea de Unix, `cmd.exe` rompe los bloques `if errorlevel 1 (...)` y la ventana se
  cierra sin mensaje. Se cambiaron los bloques por etiquetas y `goto`, se agregó
  `diagnostico.bat` y una prueba (`tests/arranque.test.js`) que no deja repetir el error.
- **2026-11-23** — La interfaz adopta las reglas aplicables de las Human Interface
  Guidelines de Apple: toque de 44 px, retícula de 8, cuerpo de 17 px, apariencia clara
  y oscura, zonas seguras, `prefers-reduced-motion` / `prefers-contrast`, foco visible,
  etiquetas en los campos, regiones `aria-live`, icono y manifiesto, y confirmación de
  dos pasos en lugar de `confirm()`. Lo aplicado y lo que no aplica, en `docs/HIG.md`;
  lo verificable sin navegador, en `tests/interfaz.test.js`.
- **2026-11-23** — Se escribieron las reglas del proyecto para quien vuelva a tocarlo:
  engine puro, proyección por lista blanca, sin internet en tiempo de ejecución,
  configuración antes que código, y CRLF en los `.bat`. Resumidas en `docs/GIT.md` y
  explicadas en este documento.
- **2026-11-23** — Ronda 2: el servidor calcula qué montones y qué temas **tienen
  material** para una mentira (`categoriasViables` en `engine/pistas/generador.js`) y la
  vista del jugador solo ofrece esas opciones (`objetivos` en la proyección). Antes el
  menú ofrecía combinaciones imposibles y el jugador gastaba intentos. La lista expone
  solo nombres de categoría, nunca respuestas; hay pruebas de que no filtra.
- **2026-11-23** — La interfaz de `/play` limpia la selección también visualmente al
  enviar una acción (`limpiarSeleccion`): antes se borraba en la lógica y las opciones
  quedaban marcadas en pantalla.
- **2026-11-23** — Voz del narrador rehecha. Hallazgo de la investigación: las voces
  "Natural" de Microsoft son neuronales pero **viven en la nube y solo las expone Edge**,
  así que sin internet no existen; Chrome en Windows solo ve las voces SAPI locales. La
  Web Speech API tampoco acepta SSML ni permite enrutar su salida al Web Audio API, de
  modo que no hay filtros ni reverberación posibles sobre la voz. El carácter se logra
  entonces con: puntaje de selección de voz (local > es-CO > es-MX > es-ES, y voces
  graves primero), tono 0.55 y ritmo 0.88, **troceo por frases con pausas reales** —lo
  que más ayuda a que un sintetizador no suene plano—, y un **sub-bajo con batido lento
  debajo de la voz** (`auraEncender` en `audio.js`) que aporta la presencia que la voz no
  puede dar. Todo configurable en `config/narrador.json` → `voz`.
- **2026-11-23** — Presentación inicial: `web/tv/intro.js` dibuja un grupier original
  (encapuchado, ojos encendidos, boca sincronizada con la voz) y una ilustración SVG
  animada por lámina. El guion de 10 pasos vive en `config/narrador.json` →
  `explicacion.pasos`, así que se reescribe sin tocar código. Avanza cuando la voz
  termina cada paso y, si no hay voz, por duración estimada, para que nunca se congele.
  Se lanza desde la TV o desde el panel del grupier (`admin.explicar`).
- **2026-11-23** — Al archivar una partida, los celulares seguían reconectándose con su
  PIN viejo y el servidor respondía `PIN_INCORRECTO`: mensaje equivocado, y además gastaba
  el límite de 5 intentos por minuto. Ahora `autenticar` devuelve `{expirada:true}` cuando
  el jugador ya no existe, el transporte manda `{t:'reiniciada'}` sin contar intento, y
  `nuevaPartida` avisa a los celulares conectados para que borren su sesión y vuelvan al
  registro solos. Cubierto por `tests/sesiones.test.js`.
- **2026-11-23** — **Dos voces.** `narrador.js` pasa de una voz a perfiles por personaje:
  `grupier` (grave, lento, voces masculinas primero) y `explicador` (claro, un poco más
  rápido). Si el PC tiene dos voces en español, cada personaje se queda con una y se evita
  que suenen igual; si solo hay una, la comparten con prosodia distinta. Cada paso de la
  explicación declara su voz en `config/narrador.json`.
- **2026-11-23** — **Grupier en 3D** con Three.js 0.187.0 (MIT) **vendorizado** en
  `web/shared/vendor/three/`, no como dependencia de npm: `web/` sigue siendo autocontenido
  y sin paso de build. La geometría es procedimental (sin archivo `.glb`), diseñada contra
  `docs/3D_WORLD_HIG.md`. Si no hay WebGL, se usa el grupier plano en SVG. `/tv?silueta=1`
  renderiza en negro plano para auditar la regla de silueta.
- **2026-11-23** — **Piloto automático.** El servidor mueve el juego solo: arranca cuando
  todos están listos, cierra cada ronda cuando todos terminaron y destapa la revelación
  pareja por pareja. Un único temporizador cancelable; cualquier acción manual del grupier
  lo cancela, así que intervenir siempre gana. Los tiempos están en `reglas.json` →
  `automatico`. Para que las rondas 1 y 2 puedan cerrarse solas se agregaron las acciones
  `ronda1.listo` y `ronda2.pasar`, y el motor marca listo solo a quien ya no puede actuar
  (sin fichas para comprar, o sin fichas para la trampa).
- **2026-11-23** — La revelación dejó de reescribir `#centro` en la TV: ahora ocupa solo la
  columna derecha, porque en la izquierda vive el lienzo WebGL del grupier y recrearlo
  mataba el contexto.
- **2026-11-23** — **Voz neuronal implementada** (ver `docs/INVESTIGACION_VOZ.md` §4). Se
  acepta a conciencia la única dependencia **nativa** del proyecto, pero como
  `optionalDependencies`: las cuatro obligatorias siguen siendo puras y el juego arranca
  igual sin ella. `server/voz-neural.js` sintetiza y cachea; `web/shared/voz.js` reproduce
  con cadena de efectos por personaje; `web/shared/narrador.js` elige camino neuronal o
  navegador por frase, de modo que un fallo puntual no deja mudo al grupier.
  **Fijada en sherpa-onnx 1.13.6**: la 2.x quitó el frontend de espeak-ng y la síntesis
  falla con "phoneme_codepoints is empty".
- **2026-11-23** — El 3D se rehizo tras ver la pantalla real: la capucha era un cono
  cerrado que se tragaba la cara y los ojos; la vela a intensidad 7 aplastaba la paleta a
  café; la cámara estaba lejos y la mesa tapaba el cuerpo. Ahora la capucha es un casco
  abierto por delante (torno con sector), la clave es fría y la vela es apoyo, hay realce
  dorado de borde, mapeo de tonos ACES con exposición 1.25, y el encuadre va del pecho
  hacia arriba. Se subió el valor del manto: en una TV con poco brillo, el violeta oscuro
  se iba a negro.
- **2026-11-23** — Puesta en escena: el personaje tiene `gesto(nombre)` con utilería
  (fichas, carta falsa, puertas del dilema, fantasma) y **encuadres de cámara por gesto**.
  La explicación lo usa con el `ilustracion` de cada paso, y las fases del juego también.
  Con 3D disponible, la lámina SVG plana se oculta: el personaje es la ilustración.
- **2026-11-23** — "Ya terminé" y "no pongo trampa" que llegan justo cuando la ronda se
  cerró se ignoran en silencio: es un aviso, no una jugada, y el jugador no hizo nada mal.
- **2026-11-23** — **Voz del grupier refinada.** El cambio que más se nota no es un
  efecto, es el desplazamiento de formantes: el servidor sintetiza al **1.10** y el
  navegador reproduce al **0.87**. Tempo neto 0.96 (apenas más lento, que es dramático) y
  tono y formantes **2,4 semitonos abajo**. Bajar solo el tono suena a cinta lenta; bajar
  los formantes es lo que hace que la voz suene de un cuerpo más grande.
  Encima: doblaje desafinado 16 cents con 24 ms de retardo y apertura estéreo (espesor sin
  coro), sombra una octava abajo filtrada al 13%, susurro pasa-altos retrasado al 9%,
  sala con **pre-retardo de 35 ms** (sin pre-retardo suena a lata), eco lejano filtrado con
  poca realimentación, EQ con graves y pecho arriba y 2,5 kHz y 6,5 kHz abajo (los
  sintetizadores sisean), y compresor al final para nivel parejo con gente hablando.
  Todos los números están en `config/narrador.json` → `voces.<personaje>.efectos`.
  La música de fondo **se agacha** mientras alguien habla: claridad antes que atmósfera.
- **2026-11-23** — El 3D **no estaba llegando a la explicación**: la llamada a `crearIntro`
  nunca recibió `personaje`, `montarPersonaje` ni `desmontarPersonaje` (una sustitución
  anterior falló en silencio). Corregido, con prueba que lo verifica. Además la caja del
  personaje ocupa toda la escena de la presentación (antes heredaba los 34vh de la pantalla
  principal) y cada lámina muestra **etiquetas con las cifras** encima de la escena
  (precios, pagos del dilema, el +3 del bono), que es lo que la gente necesita ver.
- **2026-11-23** — **Se cierra el marco de "MVP".** La primera versión jugable está hecha y
  el proyecto pasa a mejora continua hacia un resultado excelente (ver
  `docs/HOJA_DE_RUTA.md`). Se mantienen como **invariantes** la privacidad del juego, el
  funcionamiento sin internet, el motor puro, el servidor autoritativo, el español de
  Colombia y el respaldo de toda pieza opcional. Pasan a ser **decisiones reabribles con
  evidencia** el paso de build, las dependencias, el audio no sintetizado y el LLM local
  opcional. Motivo: tras la primera prueba el anfitrión reportó voces robóticas y una
  explicación plana, y varias restricciones de la Etapa 1 (pensadas para llegar rápido)
  limitaban la solución. Las prioridades de la Etapa 2 están en `docs/HOJA_DE_RUTA.md`.
- **2026-11-23** — **Kokoro reemplaza a Piper como motor de voz**, por escucha a ciegas
  (6-0 entre dos rondas, incluida la prueba con música encima). Como corre a poco más de
  tiempo real, se invierte el enfoque: `tools/prerenderizar.mjs` genera el banco completo
  antes de jugar, con dos tomas por frase; en la partida solo se reproduce (5 ms contra
  2,7 s). Piper queda como motor rápido para frases imprevistas. La clave del banco
  incluye motor y voz, así que cambiar de modelo invalida el banco viejo en vez de servir
  audio equivocado.
- **2026-11-23** — **La cadena de efectos se podó.** Empató 3-3 contra la voz cruda en la
  prueba a ciegas: no aportaba naturalidad. Se quitan voz-sombra, susurro, saturación,
  eco y doblaje; queda un toque de cuerpo y de sala. El código permanece para poder
  volver a subirla desde `config/narrador.json` y compararla otra vez.
- **2026-11-23** — Los apodos se conocen al registrarse, así que las frases que nombran a
  un jugador se generan en segundo plano apenas entra (`alRegistrarJugador`).
- **2026-11-23** — Control de versiones inicializado y el estado estable etiquetado como
  `v1.0.0` antes de empezar la Etapa 2.
- **2026-11-23** — **Cada ronda se explica antes de jugarla.** El reloj de la fase ya no
  arranca al entrar en ella: primero el grupier presenta la ronda en la TV en tres
  momentos —qué va a pasar, qué ves en el celular, qué te conviene— y solo cuando la TV
  avisa (`tv.entradaLista`) empieza a correr. El guion vive en `config/narrador.json`
  (`rondas`), no en el código, y el celular recibe únicamente el título: el texto completo
  es para la pantalla grande, donde todos miran lo mismo. Si no hay TV conectada, o si el
  anfitrión apaga las explicaciones, el juego sigue como antes; y si la TV se cuelga, un
  tope de 60 s (`segundosMaximosEntrada`) arranca la ronda sola. Se reutiliza la máquina
  de la presentación (personaje 3D, gestos, etiquetas, subtítulos) en vez de escribir otra.
- **2026-11-23** — **La voz se genera en un hilo aparte** (`server/voz-hilo.js`).
  `sherpa-onnx` trabaja de forma síncrona: entre 300 ms y 2,6 s por frase, con el modelo
  cargándose la primera vez. Hecho en el hilo del servidor congelaba la partida entera.
  Se vio en el simulador con 6 y 10 jugadores: los mensajes de los celulares se
  acumulaban detrás de la síntesis y el servidor llegaba a rechazar acciones de registro
  con `FASE_INCORRECTA` porque se atendían diez segundos tarde, cuando la partida ya había
  empezado. Con la voz en su propio hilo, el simulador pasa sin un solo rechazo con 6 y
  con 10 jugadores. Si el hilo no se puede abrir o se cae, se genera en el principal: la
  voz nunca desaparece, en el peor caso vuelve a trabar.
