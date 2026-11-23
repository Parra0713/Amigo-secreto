# CLAUDE.md — instrucciones para trabajar en este proyecto

Contexto para cualquier sesión de Claude (o cualquier IA) que vuelva a tocar este
repositorio. Léelo antes de escribir código.

> **El proyecto ya no es un MVP.** La primera versión jugable (Etapa 1) está hecha y el
> objetivo ahora es un resultado **excelente**, mejorado por etapas y con evidencia. El rumbo,
> los listones de calidad y los pendientes vivos están en `docs/HOJA_DE_RUTA.md`; el encargo
> de la Etapa 2 está en `docs/PROMPT_ETAPA_2.md`. Las decisiones de la Etapa 1 que no son
> invariantes (más abajo) se pueden reabrir con evidencia.

## Qué es esto

Juego de **revelación** del amigo secreto para una reunión familiar, inspirado en la
mecánica de "El Plan del Diablo". Un PC con Windows conectado a la TV hace de grupier;
los jugadores (5 a 15) entran desde el celular por el WiFi de la casa.
**El sorteo ya se hizo aparte**: aquí solo se revela.

- Reglas del juego: `README.md` y `docs/ARQUITECTURA.md`. La fuente de verdad de las
  reglas es `config/reglas.json` + los módulos de `engine/rondas/`.
- Por qué este stack: `docs/INVESTIGACION.md`.
- Para el anfitrión no técnico: `docs/GUIA_ANFITRION.md`.

## Idioma

- **Todo en español de Colombia**: interfaz, textos, comentarios, mensajes de commit,
  documentación y nombres de variables de dominio (`fichas`, `montones`, `trampa`).
- Se mantienen en inglés solo los términos técnicos establecidos (`socket`, `state`,
  cuando aparecen en APIs externas).
- No tutear al anfitrión en la guía; sí tutear al jugador en `/play`.

## Reglas de arquitectura

Las reglas **1 a 7 son invariantes**: no se cambian sin una razón de peso y una prueba que
lo respalde. Las reglas **8 a 10 son decisiones por defecto, reabribles con evidencia**
(una medición, una comparación o una prueba con personas), anotando la decisión en la
Bitácora de `docs/ARQUITECTURA.md`.

1. **`engine/` es puro.** No importa nada de `server/`, no hace I/O, no lee el reloj, no
   usa `Math.random`. Contrato único: `(estado, accion) -> { estado, efectos }`.
   Los efectos son **datos** (`{tipo:'narrar', evento:'trampa_colocada'}`), nunca llamadas.
2. **Todo el azar pasa por `engine/azar.js`** con la semilla de la partida. Si una
   función necesita azar, recibe `azar` como parámetro. Esto es lo que hace que una
   partida sea reproducible, y hay pruebas que lo verifican.
3. **Toda salida a un cliente pasa por `engine/proyeccion.js`.** Es lista blanca: se
   construye un objeto nuevo campo por campo. Está **prohibido** mandar el estado y
   "borrar" campos secretos. Si agregas un campo a la vista, agrega la prueba en
   `tests/secretos.test.js` que verifique que no filtra nada ajeno.
4. **`parejas` y `respuestas` nunca salen del servidor** antes de la fase `revelacion`.
   Tampoco al admin. El admin solo ve conteos anónimos.
5. **El servidor es la única autoridad.** El cliente manda intenciones; el servidor
   valida fase, pertenencia, fichas y límites. Nunca confiar en el cliente.
6. **Una ronda nueva = un archivo** en `engine/rondas/` con la interfaz
   `start / handleAction / onTimeout / end`, más una entrada en `rondasActivas`.
   No se toca el transporte ni las interfaces.
7. **Nada de internet en tiempo de ejecución.** Ni CDNs, ni fuentes, ni APIs, ni
   archivos de audio descargados. `tests/sin-internet.test.js` lo verifica; si lo haces
   fallar, el cambio está mal, no la prueba.
8. **(Reabrible)** **Cero dependencias nuevas sin justificarlas** en `docs/INVESTIGACION.md`.
   Hoy son 4 de producción (`fastify`, `@fastify/static`, `@fastify/websocket`, `qrcode`),
   una opcional (`sherpa-onnx-node`) y **ninguna** de desarrollo: las pruebas usan
   `node:test`. Si una dependencia mejora de verdad el resultado (voz, animación,
   rendimiento), se puede agregar con su justificación, licencia y respaldo si falta.
9. **(Reabrible)** **Por defecto, sin paso de build.** `web/` es HTML, CSS y JS planos con
   módulos ES nativos. Si una herramienta de animación o de interfaz lo justifica con
   evidencia, se puede cambiar, anotándolo en la Bitácora y cuidando que el anfitrión no
   técnico siga arrancando todo con `iniciar.bat`.
10. **(Reabrible)** **Por defecto los sonidos se sintetizan** con Web Audio API
    (`web/shared/audio.js`). Se pueden agregar archivos de audio (efectos, música, voz
    pre-renderizada) si mejoran el resultado, siempre que sean CC0 o de producción propia,
    queden anotados en `docs/CREDITOS.md` y haya respaldo si faltan. **Nunca** audio ni
    material de la serie.
    Al reabrirla, actualizar la prueba "no hay archivos de audio" de
    `tests/sin-internet.test.js` para que verifique la nueva regla (licencias y créditos) y
    siga prohibiendo audio de terceros no registrado.

## Configuración antes que código

Si algo se puede volver un valor en `config/`, va en `config/`:
`reglas.json` (fichas, precios, tiempos, bonos, rondas activas, PIN de admin, variantes),
`cuestionario.json` (preguntas y plantillas de pista), `narrador.json` (frases por evento,
guion de la presentación inicial y ajustes de voz),
`textos.json` (interfaz), `groserias.json` (filtro).
**Editar esos archivos no debe requerir tocar código**, y hay criterios de aceptación
que lo exigen.

## Interfaz

`docs/HIG.md` tiene las reglas de interfaz que sigue el proyecto (derivadas de las Human
Interface Guidelines de Apple) y la lista de lo que no aplica. Antes de cambiar `web/`:
- Área mínima de toque **44 × 44 px**, separación mínima de 8 px.
- Texto del celular nunca por debajo de 17 px en cuerpo, 11 px en etiquetas.
- `/tv` legible a 3 metros: unidades `vw`, poco texto por pantalla.
- Nunca depender solo del color: siempre un ✓/✗ o una palabra.
- Respetar `prefers-reduced-motion`, `prefers-contrast` y `prefers-color-scheme`.
- Nada de `alert()` ni `confirm()`: confirmación en línea, de dos pasos.

## Windows

- Los `.bat` se escriben con **finales de línea CRLF** y **solo ASCII**. Con LF
  `cmd.exe` rompe los bloques `if (...)` y la ventana se cierra sin mensaje.
  `tests/arranque.test.js` lo verifica.
- No usar caracteres acentuados ni emojis dentro de los `.bat`.
- Preferir etiquetas y `goto` antes que bloques entre paréntesis.
- Rutas con espacios: siempre entre comillas. La carpeta del proyecto tiene espacios.
- El firewall se abre **solo** en perfil privado y solo el puerto 8080.

## Flujo de trabajo

1. `npm test` antes y después de cada cambio. **No avanzar con pruebas en rojo.**
2. Para cambios de reglas o de red: `node tests/simulador.js 15` (partida completa con
   bots, verifica además que no haya fugas de información).
3. Toda regla nueva de la sección 3 del prompt original necesita su prueba, incluidos
   los casos borde: número impar de jugadores, empate, jugador desconectado, apuesta
   mayor a las fichas, trampas en el límite, jugador con pocas respuestas.
4. Las decisiones menores se anotan en la **Bitácora de decisiones** al final de
   `docs/ARQUITECTURA.md`, con fecha.
5. Las mejoras alineadas con `docs/HOJA_DE_RUTA.md` se hacen sin pedir permiso. Preguntar
   solo si el cambio altera las **reglas del juego** o la experiencia de forma notable, o
   si es difícil de deshacer.

## Cosas que ya se decidieron (reabrir solo con evidencia nueva)

- Fastify + WebSocket plano en vez de Socket.IO o Colyseus — ver `docs/INVESTIGACION.md`.
- Persistencia en JSON atómico, no SQLite: `node:sqlite` sigue siendo *release candidate*
  y `better-sqlite3` es módulo nativo (riesgo sin internet).
- Voz: `speechSynthesis` del sistema como **respaldo**; la voz principal es neuronal offline
  (sherpa-onnx + Piper `es_MX-claude-high`). La Etapa 2 busca una voz más natural (ver
  `docs/PROMPT_ETAPA_2.md`). No hay voz es-CO; se usa es-MX o es-ES.
- Pistas con plantillas determinísticas. El juego debe funcionar sin modelo; un LLM local
  opcional (detrás de `redactor(pista)`) podría mejorar la redacción, nunca ser requisito.
- Confeti propio en canvas, no `canvas-confetti`.

## 3D

- El diseño del grupier y del escenario se rige por `docs/3D_WORLD_HIG.md` (HIG-3D v1.0,
  complementado con el arte de TF2 de Valve y las reglas de narrativa de Emma Coats).
  **Cualquier cambio visual se verifica contra la tabla de la parte 3.2 de ese documento.**
- Three.js va **vendorizado** en `web/shared/vendor/three/`, no como dependencia de npm, y
  se importa por ruta local. No agregar CDNs ni un paso de build.
- La geometría es procedimental: nada de archivos `.glb`. Si hace falta una forma nueva, se
  construye con primitivas y se anota a qué regla responde.
- Paleta: tres colores más un acento, en la constante `PALETA`. No introducir colores sueltos.
- El respaldo en SVG (`GRUPIER_SVG` en `web/tv/intro.js`) debe seguir funcionando: hay PCs
  sin WebGL y la TV no puede quedarse sin personaje.
- `/tv?silueta=1` es la herramienta de auditoría de la regla de silueta. No romperla.
- La capucha es un **casco abierto por delante** (`LatheGeometry` con sector), no un cono
  cerrado: si se cierra, desaparecen el rostro y los ojos, que son el punto focal.
- Los gestos (`gesto(nombre)`) se llaman con el mismo identificador que `ilustracion` de
  cada paso del guion. Al agregar un paso nuevo, agregar su gesto o cae en 'reposo'.

## Automatización

- El ritmo del juego lo lleva el servidor (`decidirSiguientePaso` en `server/juego.js`),
  con **un solo temporizador cancelable**. Toda acción manual del grupier lo cancela.
- Los tiempos viven en `reglas.json` → `automatico`. No codificar esperas en el cliente.
- Una ronda nueva que pueda cerrarse sola necesita: marcar `listos` en `start` para quien no
  pueda actuar, una acción de "ya terminé", y llamar a `end` cuando `todosListos`.
- Verificación: `node tests/simulador.js 5 --auto` juega una partida entera sin que nadie
  toque el panel.

## Voz y presentación

- **Dos voces**: `grupier` (grave, dramático) y `explicador` (claro, didáctico). La elección
  de voz y la prosodia de cada uno están en `config/narrador.json` → `voces`. Al agregar
  texto narrado, decidir quién lo dice.

- La voz neuronal **ya está implementada**: sherpa-onnx + voz Piper `es_MX-claude-high`.
  Leer `docs/INVESTIGACION_VOZ.md` antes de tocarla.
- **No subir `sherpa-onnx-node` a 2.x**: quitaron el frontend de espeak-ng integrado y la
  síntesis falla con "phoneme_codepoints is empty". Queda fijada en 1.13.6.
- Es `optionalDependencies` a propósito: las cuatro dependencias obligatorias siguen siendo
  puras y el juego tiene que arrancar sin la voz neuronal, cayendo a `speechSynthesis`.
  Cualquier cambio ahí se prueba también **con el modelo desinstalado**.
- El modelo vive en `modelos/` (ignorado por git) y no se distribuye con el proyecto.
- Sin internet solo existen las voces SAPI locales de Windows: las "Natural" de Microsoft
  son de la nube y exclusivas de Edge. No proponer esas voces como solución offline.
- La Web Speech API no acepta SSML ni permite enrutar su salida al Web Audio API: no se
  puede filtrar ni reverberar la voz. El carácter se logra con prosodia (tono, ritmo,
  troceo por frases con pausas) y con audio puesto **debajo** de la voz.
- El guion de la presentación es datos (`config/narrador.json` → `explicacion.pasos`).
  Si se agrega un paso con una ilustración nueva, hay que dibujarla en `web/tv/intro.js`
  dentro de `LAMINAS`; una prueba verifica que toda ilustración referida exista.
- El personaje del grupier es un **dibujo original**. No imitar personajes, voces ni
  material de la serie: solo la mecánica de juego.

## Pendientes conocidos

La lista viva está en `docs/HOJA_DE_RUTA.md` (sección 5); esto es el resumen.

- Apuesta relámpago (tercer desempate): se detecta y se anuncia, la resuelve el anfitrión
  a mano. No está como ronda.
- Si el tramposo escoge un tema con pocas preguntas puede no haber material; el servidor
  responde `SIN_MATERIAL_PARA_TRAMPA`. Mejora pendiente: ofrecer solo temas viables.
- La reconexión por PIN y el reinicio del servidor a mitad de partida están
  implementados pero no cubiertos por pruebas automáticas.

## Calidad: el listón

- La calidad de **voz y animación se decide escuchando y mirando con personas**, no solo con
  métricas. Antes de cambiar el sonido del grupier, hacer una comparación A/B a ciegas.
- Lo que no se pudo comprobar con ojos, oídos o celulares reales se dice como tal en
  `docs/ESTADO.md` o en la hoja de ruta; no se da por verificado.
- Mantener siempre una versión **estable y jugable**. Cambios pequeños, `npm test` en verde.
- Cada prueba real con personas se anota en la sección 7 de `docs/HOJA_DE_RUTA.md`.
