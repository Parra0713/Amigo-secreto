# ETAPA 2 — De "funciona" a "memorable"

> Este documento es el encargo de la segunda etapa de **El Plan del Amigo Secreto**. Está escrito para un modelo muy capaz: te doy contexto, intención, límites y criterios. **Cómo lograrlo lo investigas, lo piensas y lo decides tú.** Donde sugiero algo es una pista, no una orden. Si encuentras algo mejor, hazlo y déjalo justificado.

## 0. Cómo leer esto

El proyecto ya **no es un MVP**. La primera etapa dejó un juego completo y probado; esta etapa y las que siguen buscan un resultado **excelente**, no solo funcional. Eso cambia las reglas de trabajo:

- Las decisiones técnicas de la Etapa 1 (stack, "sin paso de build", "los sonidos solo se sintetizan", "sin archivos de audio", plantillas sin LLM, etc.) fueron **razonables para llegar rápido, no dogmas**. Puedes reabrirlas si tienes evidencia (una medición, una comparación, una prueba con personas) y dejas la decisión anotada en la Bitácora de `docs/ARQUITECTURA.md`.
- Lo que **sí es intocable** son los invariantes de la sección 3: privacidad del juego, funcionamiento sin internet, servidor autoritativo, español de Colombia y que nunca quede mudo o sin pantalla por una dependencia opcional.
- Ya no hace falta preguntarme por cada mejora. Si está alineada con este documento y con `docs/HOJA_DE_RUTA.md`, hazla. Pregunta solo si cambia las **reglas del juego** o la experiencia de forma notable, o si algo es difícil de deshacer.

**Lee primero, en este orden:** `docs/ESTADO.md`, `CLAUDE.md`, `docs/HOJA_DE_RUTA.md`, `docs/ARQUITECTURA.md` (incluida la bitácora), `docs/INVESTIGACION_VOZ.md` y `docs/3D_WORLD_HIG.md`. Luego corre `npm test` y `node tests/simulador.js 8 --auto` para ver el estado real antes de tocar nada.

## 1. Dónde estamos (resumen)

Hay un juego completo: motor puro con 4 rondas, cuestionario con generación de pistas por rareza, servidor Fastify + WebSocket, interfaces `/tv`, `/play` y `/admin`, piloto automático, un grupier en 3D (Three.js vendorizado), una presentación de 10 láminas, dos voces (grupier y explicador) y voz neuronal offline (sherpa-onnx + Piper `es_MX-claude-high`). 103 pruebas en verde y partidas simuladas de 2 a 15 jugadores sin fugas de información.

**Equipo real donde correrá:** un PC con Windows, **Ryzen 5 7600 y Radeon RX 6600 (AMD, sin CUDA)**, conectado por HDMI a una TV TCL con Android TV (no OLED, con brillo moderado). La TV solo muestra lo que renderiza el navegador del PC. Ten en cuenta que muchos modelos de voz y de imagen asumen una GPU NVIDIA; aquí no se puede dar eso por hecho.

**Lo que se vio al probarlo (retroalimentación del anfitrión):**
1. **Las voces suenan robóticas.** Se quiere algo claramente más natural.
2. **Las explicaciones son planas.** La presentación del juego informa, pero no engancha ni se entiende con la facilidad que debería.

Esas dos cosas son la **prioridad de esta etapa**.

## 2. Qué pido

### 2.1 Voces naturales (prioridad 1)

**Meta:** que el grupier y el explicador suenen como *personas con intención*, no como un sintetizador. Que alguien de la familia, a ciegas, no piense "es un robot" en la primera frase.

Qué me importa y qué te dejo decidir:

- **Diagnostica antes de cambiar.** ¿Qué hace que suene robótico: el modelo, la prosodia plana, el texto escrito para leer y no para hablar, o el procesamiento de efectos? La cadena actual (desplazamiento de formantes, doblaje, voz-sombra, eco, sala, EQ, compresor) puede estar *quitando* naturalidad. Construye un **laboratorio de escucha A/B** (por ejemplo una página en `tools/`) que permita comparar voz cruda contra procesada, modelos, parámetros y tomas, y que me deje elegir a ciegas.
- **Investiga el estado del arte actual y abierto**, con licencias compatibles con uso familiar y funcionamiento offline, sin asumir que el camino de hoy es el mejor. Evalúa de verdad (no por reputación) modelos más expresivos que Piper: familias tipo Kokoro, Matcha, StyleTTS, F5/E2, Chatterbox multilingüe, otras voces Piper, y lo que encuentres que sea más reciente. Considera tamaño, calidad en español, velocidad en esa CPU, si hay ruta viable en una RX 6600 (DirectML, Vulkan, etc.) o si conviene quedarse en CPU, y qué tan fácil es instalarlo en un PC de casa.
- **Español de Colombia.** Hoy no hay voz es-CO. Mira si existe algo utilizable o si hay una vía realista (datos abiertos de habla colombiana, afinado de un modelo existente) y qué costaría. Verifica licencias antes de usar cualquier cosa.
- **Aprovecha que casi todo es predecible.** El banco de frases es fijo y los nombres de los jugadores se conocen desde el registro. Eso permite **pre-renderizar con un modelo más lento y mejor** (en la instalación, o en segundo plano mientras los jugadores se registran), con **varias tomas por frase** para no repetirse. La latencia en vivo ya no tiene por qué ser el criterio dominante. Decide cómo manejar lo que no se pueda prever.
- **Escribe para el oído, no para el ojo.** Revisa y reescribe el banco de `config/narrador.json` y el guion de la explicación: frases cortas, ritmo, respiraciones, variedad, humor, modismos colombianos usados con gusto (sin caricatura), números y nombres bien normalizados, un diccionario de pronunciación para nombres propios. Un buen texto mejora más que cualquier ajuste de modelo.
- **Prosodia y emoción:** que el grupier pueda susurrar, crear suspenso, celebrar o burlarse con cariño, y que el explicador sea claro y cálido. Las dos voces deben ser **realmente distintas**, no la misma con otro tono.
- **El carácter nunca debe costar naturalidad.** Si el grupier "misterioso" suena a robot, gana la naturalidad. Reduce o elimina procesamiento si hace falta.
- **Inteligibilidad en sala:** con la música de fondo y gente hablando. Mídelo.
- **Red de seguridad intacta:** si el modelo falta o falla, cae a la voz del sistema; el juego nunca queda mudo. Prueba también con el modelo desinstalado.

Está permitido descargar modelos más pesados una sola vez con internet (se instalan antes, el juego sigue siendo offline), siempre que el instalador lo explique con claridad y el tamaño no vuelva el proyecto inmanejable.

### 2.2 Explicación del juego dinámica y atractiva (prioridad 1)

**Meta:** que explicar el juego sea un pequeño **cortometraje animado** que se disfrute y se entienda a la primera, para niños y adultos mayores. Que después de verlo, alguien que no conocía el juego pueda decir con sus palabras cómo se juega.

Hoy hay 10 láminas con el personaje 3D, utilería y etiquetas con cifras. Funciona, pero se siente plano. Lo que imagino (tú lo piensas mejor que yo, úsalo como punto de partida):

- **Mostrar, no contar.** Una idea por escena, con objetos concretos que se mueven: fichas que vuelan al montón y se cuentan, cartas que se voltean y se revelan, una pista que aparece palabra por palabra, una carta falsa que se desliza y se camufla entre las reales, dos manos que eligen a la vez en el dilema y revelan con tensión, una apuesta con fichas que se apilan y se duplican o se evaporan, un marcador que sube.
- **Coreografía sincronizada con la voz.** Cuando se dice "diez fichas", aparecen diez fichas. La animación sigue el ritmo de la narración (por palabra o por frase), no al revés.
- **Un hilo narrativo.** Por ejemplo, tres jugadores ficticios que atraviesan todas las rondas con un ejemplo concreto, de modo que cada regla se vea *en acción* y no como lista.
- **Transiciones creativas y con sentido:** que la escena siguiente nazca de un objeto de la anterior (una ficha que se abre en la siguiente pantalla, una carta que se convierte en el próximo escenario, un barrido de cámara 3D, una página que pasa), y no cortes de diapositiva. Cámara con intención, tipografía en movimiento para las cifras clave, pausas dramáticas, humor del grupier.
- **Sonido diseñado:** efectos sincronizados con los movimientos, silencios que respiran, una música que acompañe sin tapar la voz.
- **Estructura clara:** promesa ("de qué va esto") → ejemplo → reglas → resumen en una sola pantalla que se pueda volver a mirar (por ejemplo la tabla de precios y pagos).
- **Duración y control:** una versión completa y una **versión exprés** (alrededor de 60 a 90 segundos), con capítulos saltables, repetir un capítulo y salir en cualquier momento. Valora una **mini ronda de práctica** con bots para aprender haciendo.
- **Accesibilidad:** subtítulos siempre visibles, `prefers-reduced-motion` con una alternativa digna (no una pantalla muerta), nada que dependa solo del color.
- **Herramienta de autoría:** algo que te permita ver, pausar y recorrer la explicación escena por escena y generar capturas para revisar rápido. Iterar a ciegas es la forma más cara de hacer esto.

**Libertad técnica:** puedes elegir Web Animations API, una librería de animación, Lottie, Rive, canvas, más Three.js, o lo que decidas. Si necesitas reabrir "sin paso de build" o agregar dependencias vendorizadas, hazlo con justificación y licencia anotada. Mantén el respaldo sin 3D y el modo de movimiento reducido.

**Cómo sabremos que funciona:** pruébalo con alguien que no conoce el juego (o simula el protocolo y dime qué debo probar yo). Después de verlo, que responda correctamente al menos 4 de 5 preguntas sencillas (qué cuesta una pista, qué hace una trampa, qué pasa si coopero y el otro guarda, cuándo gano la apuesta, quién gana). Dime cómo lo mediste.

### 2.3 Lo que tú decidas añadir

Quiero que propongas y construyas lo que más mejore el resultado final. Ideas con buen potencial (**elige tú, ordena por impacto y esfuerzo, y descarta lo que no valga la pena**):

- **Revelación final más épica:** más suspenso y cámara, y **premios divertidos** calculados del registro de eventos (el mejor mentiroso, el más confiado, el cazador de pistas, el que más gastó sin acertar).
- **Recuerdo de la partida:** una tarjeta o resumen compartible (offline) con el marcador, los premios y los mejores momentos.
- **Sala de espera con vida:** avatares animados, "listo", bromas del grupier a quien llega tarde, una vista previa de lo que viene.
- **Reacciones desde el celular** (emojis, aplausos) que aparezcan en la TV, con límites para que no estorben.
- **Modo ensayo:** una partida de prueba con bots para que el anfitrión verifique voz, 3D y conexión antes de que lleguen los invitados.
- **Rendimiento real:** medir en el PC de destino a la resolución de la TV (1080p y 4K), fijar un presupuesto de fotogramas y degradar con gracia si la GPU no da.
- **Otras rondas o mini-juegos** al estilo del programa para futuras temporadas (por ejemplo una subasta ciega, una votación "¿quién miente?", un juego de memoria o de códigos). Propón, no los construyas todos.
- **Portabilidad:** empaquetar para llevar el juego a otro PC sin dolor.

### 2.4 Pendientes conocidos (ciérralos)

1. **Apuesta relámpago** (tercer desempate): hoy la resuelve el anfitrión a mano; hazla una ronda real.
2. **Con 2 jugadores no hay ronda de trampa**: define qué pasa (saltarla con gracia, otra mecánica, o reglas distintas para 2) y que el menú no deje callejones sin salida. Además, ofrecer solo los temas viables al poner una trampa (`SIN_MATERIAL_PARA_TRAMPA`).
3. **Reconexión por PIN y reinicio del servidor a mitad de partida:** están implementados, pero faltan **pruebas automáticas de punta a punta**.
4. **Pruebas con celulares reales** (aislamiento de clientes del router, Wake Lock, reconexión): dime exactamente qué probar y cómo reportártelo.
5. **Modelo de voz y caché** (`modelos/`, `data/voz/`): que el manejo de espacio siga siendo claro.

## 3. Invariantes y decisiones reabribles

**Invariantes (no se tocan sin una razón de peso y una prueba que lo respalde):**
- Las parejas y las respuestas del cuestionario **nunca** salen del servidor antes de la revelación; toda salida a un cliente pasa por la proyección de lista blanca; cada campo nuevo lleva su prueba en `tests/secretos.test.js`.
- **Funciona sin internet** en la noche del juego. Las descargas puntuales se hacen antes y quedan en disco.
- `engine/` es **puro** (sin I/O, sin reloj, sin `Math.random`), y el servidor es la única autoridad.
- **Español de Colombia** en todo lo que ve y oye el jugador.
- **Nunca mudo ni a ciegas:** toda pieza opcional (voz neuronal, 3D, nuevas animaciones) tiene respaldo y se prueba sin ella.
- Nada de audio, personajes ni material del programa original: solo se toma la mecánica.
- La configuración (reglas, cuestionario, frases, textos, voces) sigue siendo editable sin tocar código.

**Reabribles con evidencia (anótalo en la Bitácora):** el stack, el paso de build, las dependencias, el formato de persistencia, los audios grabados o pre-renderizados (con licencia CC0 o propia y registro en `docs/CREDITOS.md`), el uso opcional de un modelo de lenguaje local para redactar o variar frases, y la estructura de carpetas.

## 4. Cómo quiero que trabajes

1. **Investiga con fuentes actuales** (web y documentación vigente), no por memoria. Registra lo que evaluaste, lo que descartaste y por qué, en `docs/` (continuando `INVESTIGACION_VOZ.md` o con documentos nuevos).
2. **Prototipa rápido y mide.** Un laboratorio de voz y una herramienta de autoría de animación valen más que adivinar. Muestra opciones y deja que yo escuche y mire.
3. **Red de seguridad:** mantén siempre una versión **estable y jugable**. Si no hay control de versiones, inicialízalo y etiqueta el estado actual antes de empezar. Trabaja en cambios pequeños y verificables. `npm test` en verde antes y después de cada cambio.
4. **Entrega por hitos** y avísame cuando haya algo que oír o ver, para que pueda redirigirte pronto. Para cada hito: qué hiciste, qué mediste, qué falta.
5. **Actualiza la documentación a medida que avanzas:** `docs/HOJA_DE_RUTA.md` (estado de cada ítem y retroalimentación de las pruebas), la Bitácora de `docs/ARQUITECTURA.md`, `docs/GUIA_ANFITRION.md`, `README.md` y `CLAUDE.md` si cambian las reglas de trabajo. Los créditos de todo recurso de terceros van en `docs/CREDITOS.md`.
6. **Dime con franqueza lo que no se pudo verificar sin mis ojos u oídos** y qué necesitas que pruebe yo.
7. **Cuestiona.** Si algo del diseño del juego o de esta lista no es buena idea, dilo y propón algo mejor.

## 5. Cómo sabré que la etapa salió bien

- Oigo al grupier y al explicador y me parecen **voces con vida**, claramente mejores que las actuales, con A/B a ciegas que lo respalde.
- Veo la explicación y me **engancha**: se mueve, sorprende, se entiende, y alguien nuevo pasa la prueba de comprensión.
- El 3D y las animaciones corren **fluidos en el PC real** en la TV, con respaldo cuando no.
- Las pruebas siguen en verde y se suman las de reconexión, reinicio y las rondas nuevas, y no hay fugas de información.
- Los pendientes de la sección 2.4 quedan cerrados o decididos y documentados.
- La documentación refleja el estado real y no habla ya de "primer MVP".

**Empieza leyendo el estado, diagnosticando el problema de las voces y proponiendo tu plan. Si no hay dudas que cambien las reglas del juego, ejecútalo.**
