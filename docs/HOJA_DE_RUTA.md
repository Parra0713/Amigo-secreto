# Hoja de ruta — El Plan del Amigo Secreto

Documento vivo. Reemplaza el marco de "primer MVP" con el que nació el proyecto: la primera
versión jugable ya existe, y de aquí en adelante el objetivo es un resultado **excelente**,
mejorado por etapas y con evidencia. Si algo aquí está desactualizado, se corrige aquí.

Última actualización: **23 de noviembre de 2026**.

## 1. Visión

Que la revelación del amigo secreto sea **el momento más esperado de la reunión**: un juego
con tensión, engaño y humor, que se entienda a la primera, que se vea y suene como un pequeño
programa de televisión, y que funcione sin fallar en una sala real, con familia de todas las
edades y sin internet.

## 2. Cómo se entiende "excelente"

| Dimensión | Listón |
|---|---|
| **Claridad** | Alguien que no conoce el juego lo entiende tras la explicación y puede contarlo con sus palabras (meta: 4 de 5 preguntas de comprensión correctas) |
| **Voz** | Las voces suenan a personas con intención; a ciegas, no se perciben como robots |
| **Espectáculo** | La explicación y la revelación enganchan: movimiento con sentido, sonido diseñado, humor |
| **Fiabilidad** | Una partida completa sin errores; reconexión y reinicio probados de punta a punta |
| **Privacidad del juego** | Ningún dato secreto sale del servidor antes de la revelación; verificado por pruebas |
| **Accesibilidad** | Texto legible a 3 metros, subtítulos, movimiento reducido, nunca solo color |
| **Rendimiento** | Fluido en el PC real a la resolución de la TV, con degradación suave si la GPU no alcanza |
| **Mantenibilidad** | Pruebas en verde, documentación al día, decisiones anotadas con su razón |

## 3. Principios

**Invariantes** (se cambian solo con una razón de peso y una prueba que lo respalde):
privacidad del juego (proyección por lista blanca), funcionamiento sin internet en la noche
del juego, `engine/` puro, servidor autoritativo, español de Colombia, nunca mudo ni a ciegas
(toda pieza opcional tiene respaldo), y nada de material del programa original.

**Decisiones reabribles con evidencia** (medición, comparación o prueba con personas, y nota
en la Bitácora de `ARQUITECTURA.md`): el stack, el paso de build, las dependencias, la
persistencia, el uso de audio grabado o pre-renderizado (con licencia y créditos), el uso
opcional de un modelo de lenguaje local, y la estructura de carpetas.

**Siempre:** una versión estable y jugable; `npm test` en verde; cambios pequeños y
verificables; lo que no se pudo comprobar con ojos, oídos o celulares reales se dice como
tal.

## 4. Etapas

### Etapa 1 — Primera versión jugable (hecha)
Motor con 4 rondas, cuestionario y pistas por rareza, servidor, `/tv` `/play` `/admin`,
piloto automático, grupier 3D, presentación de 10 láminas, dos voces y voz neuronal offline.
103 pruebas en verde. Ver `docs/ESTADO.md`.

### Etapa 2 — Naturalidad y espectáculo (en curso)
Dos frentes grandes —voz y explicación— más el cierre de pendientes.

- Voces naturales (laboratorio A/B, modelos más expresivos, pre-renderizado, texto escrito
  para el oído, es-CO si es viable).
- Explicación del juego como cortometraje animado (coreografía con la voz, transiciones
  creativas, ejemplo con jugadores ficticios, versión exprés, herramienta de autoría).
- Cierre de pendientes conocidos (sección 5).
- Mejoras propuestas por el modelo, priorizadas por impacto.

### Etapa 3 — Pulido y confianza
Pruebas en el PC y los celulares reales, rendimiento a la resolución de la TV, accesibilidad
revisada, modo ensayo, empaquetado portable, guía del anfitrión probada con una persona no
técnica.

### Etapa 4 — Expansión
Más rondas y mini-juegos al estilo del programa, modo por equipos, historial y temporadas
(`data/eventos.ndjson` ya es append-only), persistencia en SQLite si hace falta, y redacción
de pistas con un modelo local como mejora opcional.

## 5. Trabajo pendiente

| Ítem | Etapa | Prioridad | Estado |
|---|---|---|---|
| Voces menos robóticas y más naturales | 2 | Alta | **Hecho** — Kokoro elegido a ciegas 6-0, banco pre-renderizado |
| Voz generada fuera del hilo de la partida | 2 | Alta | **Hecho** — `server/voz-hilo.js` |
| El grupier explica cada ronda antes de jugarla | 2 | Alta | **Hecho** — 5 entradas de 3 momentos |
| Explicación dinámica y animada, fácil de entender | 2 | Alta | En curso — presentación de 10 láminas con 3D; falta el cortometraje |
| Voz es-CO (investigar viabilidad) | 2 | Media | Por empezar |
| Apuesta relámpago como ronda real | 2 | Media | Pendiente |
| Partidas de 2 jugadores: ronda de trampa sin callejón | 2 | Media | Pendiente |
| Trampa: ofrecer solo temas viables | 2 | Media | Pendiente |
| Pruebas automáticas de reconexión y reinicio de servidor | 2 | Alta | Pendiente |
| Revelación más épica y premios finales | 2 | Media | Idea |
| Recuerdo compartible de la partida | 2 | Baja | Idea |
| Modo ensayo con bots | 2 o 3 | Media | Idea |
| Medición de rendimiento en el PC real (1080p y 4K) | 3 | Alta | Pendiente |
| Pruebas con celulares reales (router, Wake Lock, reconexión) | 3 | Alta | Pendiente |
| Empaquetado portable | 3 | Baja | Idea |
| Más rondas y mini-juegos | 4 | Baja | Idea |

## 6. Cómo se decide

1. Lo que mejora los listones de la sección 2 y no toca los invariantes **se hace**.
2. Se pregunta al anfitrión solo si cambia las reglas del juego o la experiencia de forma
   notable, o si algo es difícil de deshacer.
3. Toda decisión no trivial se anota con fecha en la Bitácora de `docs/ARQUITECTURA.md`.
4. Toda opción evaluada queda en `docs/INVESTIGACION*.md` con su razón, incluso las
   descartadas.
5. La calidad de voz y de animación se decide **escuchando y mirando con personas**, no solo
   con métricas.

## 7. Registro de retroalimentación de pruebas reales

Se agrega una fila por cada prueba con personas, celulares o la TV reales.

| Fecha | Quién probó | Qué se probó | Qué se observó | Acción |
|---|---|---|---|---|
| 23-nov-2026 | Anfitrión | Primera versión completa | Las voces suenan robóticas; las explicaciones son planas | Etapa 2, prioridad alta |
