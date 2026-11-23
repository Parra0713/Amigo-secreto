# Estado del proyecto — 23 de noviembre de 2026

Informe del estado real, no del deseado. Lo verificado está marcado como tal, y lo que
solo se puede comprobar con ojos, oídos y celulares reales también.

> **Instantánea de la Etapa 1** (primera versión jugable), con las novedades de la Etapa 2
> anotadas abajo. El rumbo y los pendientes vivos están en `docs/HOJA_DE_RUTA.md`; el
> rumbo de la Etapa 2, también.

### Novedades de la Etapa 2 (23 de noviembre)

| Qué | Dónde | Comprobado con |
|---|---|---|
| Voz neuronal Kokoro elegida por escucha a ciegas (6-0 sobre Piper) | `config/narrador.json`, `docs/INVESTIGACION_VOZ.md` §8 | 21 votos en 2 rondas de laboratorio |
| Cadena de efectos podada (empató 3-3: no aportaba) | `config/narrador.json` | la misma prueba a ciegas |
| Banco pre-renderizado: 66 frases × 2 tomas, 60 MB | `npm run voces` | reproducción en 5 ms contra 2,7 s en vivo |
| Voz generada en un hilo aparte: la partida no se congela | `server/voz-hilo.js` | simulador con 6 y 10 jugadores, 0 rechazos |
| El grupier explica cada ronda antes de que corra el reloj | `config/narrador.json` (`rondas`), `server/juego.js` | `tests/entradas.test.js` |
| El tutorial usa la voz probada (`em_santa` en los dos personajes) | `config/narrador.json` | pruebas 3 y 4 del laboratorio |
| Las láminas no pasan antes de poderse leer, y nada habla encima | `web/tv/intro.js`, `web/tv/index.html` | `tests/entradas.test.js` |
| La explicación es un cortometraje: 7 capítulos, 18 pasos, versión exprés | `config/corto.json`, `web/tv/corto.js`, `web/tv/puesta.js` | `tests/corto.test.js` (17 pruebas) |
| Instrumento para medir si se entendió (listón: 4 de 5) | `/laboratorio/comprension.html` | pendiente de correr con personas |
| Reconexión del celular, reinicio del servidor y dos pestañas | `tests/reconexion.test.js` | 6 pruebas con el servidor real |

---

## 1. Resumen

| | |
|---|---|
| **Fases del plan original** | Las 6, completas |
| **Pruebas automáticas** | **159, todas en verde** (~67 s; `npm run test:rapido` deja fuera las de extremo a extremo y tarda 6 s) |
| **Partida de extremo a extremo** | ✅ con 2, 4, 5, 6, 8, 10 y 15 jugadores virtuales |
| **Modo automático sin tocar el panel** | ✅ arranca, juega y revela solo |
| **Fugas de información secreta** | ✅ ninguna, verificado por jugador |
| **Dependencias de producción** | 4, puras, sin compilación |
| **Dependencias de desarrollo** | ninguna (`node:test`) |
| **Código propio** | ~3.700 líneas, sin contar pruebas ni librerías |
| **Pruebas** | 1.375 líneas, 11 archivos |
| **Documentación** | 1.454 líneas en 9 documentos |

## 2. Qué hay construido

### Motor (`engine/`, 960 líneas)
Lógica pura sin red, sin disco y sin reloj. Contrato único
`(estado, acción) → { estado, efectos }`, con los efectos como datos.

- Las 4 rondas, cada una como módulo con la misma interfaz.
- Generador de pistas por rareza: 12 preguntas, 34 plantillas, 3 niveles.
- Azar con semilla: la misma partida se reproduce exactamente.
- Proyección por lista blanca: **único punto de salida de datos hacia un cliente**.
- Desempates, bono fantasma, orden de revelación.

### Servidor (`server/`, 777 líneas)
Fastify + WebSocket. Sesiones por PIN con `scrypt`, snapshot JSON atómico, log de
eventos, piloto automático con un solo temporizador cancelable, y voz neuronal opcional.

### Interfaces (`web/`, ~2.700 líneas)
`/tv` con grupier 3D y presentación; `/play` para celulares; `/admin` para el grupier.
Sin paso de build: HTML, CSS y JS planos con módulos nativos.

### Configuración sin tocar código (`config/`, 542 líneas)
- `reglas.json` — fichas, precios, tiempos, bonos, rondas activas, mínimos, piloto
  automático, PIN de admin y 3 variantes (corta, familiar, extrema).
- `cuestionario.json` — 12 preguntas con sus plantillas de pista.
- `narrador.json` — 20 eventos con 60 frases, guion de 10 pasos, y los efectos de voz
  de los dos personajes.
- `textos.json` y `groserias.json`.

## 3. Criterios de aceptación del plan original

| Criterio | Estado | Cómo se sabe |
|---|---|---|
| Partida completa de 8 jugadores sin errores | ✅ | `node tests/simulador.js 8` |
| Cuestionario en <3 min y 3 pistas sin intervención | ✅ mecánica | El sistema arma las 3 solo; el tiempo humano no se ha medido con gente |
| La pista fácil nunca identifica a una sola persona | ✅ | Prueba sobre 12 jugadores |
| Ninguna pista contiene el nombre de nadie | ✅ | Prueba con filtro y casos de coincidencia parcial |
| Editar `cuestionario.json` cambia las preguntas | ✅ | Las preguntas se sirven desde el archivo |
| Un jugador que se desconecta recupera su estado | ⚠️ | Implementado y probado por unidad; **falta probarlo con un celular real** |
| Reiniciar el servidor permite retomar la partida | ⚠️ | Implementado (snapshot tras cada acción); **sin prueba automática** |
| Ningún dato secreto en el tráfico de otro jugador | ✅ | 13 pruebas + verificación en el simulador |
| Funciona en WiFi sin internet | ✅ estático | Ninguna página carga nada externo; **falta la prueba en tu red** |
| Narrador, sonidos y animaciones en TV y celular | ⚠️ | El código está y se sirve; **el 3D y el audio necesitan tus ojos y oídos** |
| Cambiar una regla cambia el juego | ✅ | Prueba de la variante corta |
| Un no técnico lo arranca en <10 min | ⚠️ | La guía está escrita; **no se ha probado con una persona** |

## 4. Pruebas: qué cubren (122 al 23 de noviembre)

| Archivo | Nº | Qué asegura |
|---|---|---|
| `reglas.test.js` | 21 | Las 4 rondas, pagos del dilema, bono fantasma, desempates, número impar, desconectados, límites de trampa, apuestas inválidas, cierre automático de ronda |
| `pistas.test.js` | 12 | Rareza, selección 1+1+1, la fácil nunca única, sin repetir tema, filtro de nombres, pocas respuestas, trampas que no coinciden con la verdad, reproducibilidad por semilla |
| `secretos.test.js` | 13 | Que nada secreto salga: parejas, respuestas, autores de trampas, textos no comprados, elección del otro en el dilema, vista del admin |
| `interfaz.test.js` | 14 | Toque de 44 px, tipografía, apariencias clara y oscura, zonas seguras, foco, etiquetas, iconos, guion y etiquetas de la explicación, enganche del 3D |
| `grupier3d.test.js` | 9 | La escena 3D se construye sin lanzar, rostro y ojos visibles, capucha abierta, luces, paleta, utilería, gestos |
| `voz.test.js` | 9 | La voz neuronal es opcional y degrada sola; cadena de efectos; el truco de formantes; la boca por amplitud |
| `sesiones.test.js` | 8 | PIN hasheado, sesión vencida distinta de PIN malo, apodos, intentos |
| `sin-internet.test.js` | 6 | Cero recursos externos, vendor local con licencia, sin audio de terceros |
| `arranque.test.js` | 7 | Los `.bat` con CRLF y ASCII, firewall solo en perfil privado |
| `reglas`/`estado` varios | 4 | Variantes, fases, listos por ronda |

Además: `node tests/simulador.js N` juega una partida completa por WebSocket y verifica
fugas; con `--auto`, sin tocar el panel.

## 5. Lo que se construyó más allá del plan

- **Piloto automático**: el juego arranca, cierra rondas y revela solo. Tiempos en `reglas.json`.
- **Grupier en 3D** (Three.js vendorizado, geometría procedimental) diseñado contra
  `docs/3D_WORLD_HIG.md`, con modo silueta para auditarlo (`/tv?silueta=1`).
- **Presentación del juego**: 10 láminas, el personaje actúa cada una con utilería y
  encuadres de cámara, y etiquetas con las cifras encima de la escena.
- **Dos voces**: grupier y explicador, con reparto automático de las voces del sistema.
- **Voz neuronal offline**: sherpa-onnx + Piper `es_MX-claude-high` (Apache-2.0), con
  cadena de efectos real en Web Audio y boca sincronizada por amplitud.
- **`diagnostico.bat`** para cuando algo no prenda.

## 6. Riesgos para la noche

| Riesgo | Probabilidad | Mitigación ya hecha | Lo que te toca |
|---|---|---|---|
| Aislamiento de clientes en el router (los celulares no ven el PC) | Media | Plan B documentado: zona WiFi desde un celular | Probar con 2 celulares **antes** |
| El 3D no arranca en esa GPU | Baja | Respaldo en SVG + motivo visible en pantalla | Mirar la TV |
| La voz neuronal no carga | Baja | Cae a la voz de Windows sola | Ver la barra inferior de `/tv` |
| Primer arranque lento | Alta, pero sin consecuencia | Precalentamiento de 60 frases al arrancar (~20 s) | Arrancar 5 minutos antes |
| Alguien entra tarde al registro | Media | El registro acepta hasta que empiece | Esperar o usar "Nueva partida" |
| Un celular se duerme | Media | Wake Lock, reconexión y PIN | Que anoten el PIN |

## 7. Pendientes conocidos

1. **Apuesta relámpago** (tercer desempate): se detecta y se anuncia, pero la resuelve el
   anfitrión a mano. No está como ronda.
2. **Con 2 jugadores no hay ronda de trampa**: la mentira necesita la respuesta de un
   tercero. El menú no ofrece objetivos y hay que saltar la ronda.
3. **Reconexión y reinicio sin prueba automática**: están implementados y probados por
   unidad, pero no hay una prueba que los ejercite de punta a punta.
4. **Dynamic Type y háptica en iPhone**: el navegador no los expone a una página web.
5. **Sin voz es-CO**: la neuronal es es-MX, que es lo más cercano.
6. El modelo de voz pesa 78 MB en `modelos/` y la caché de audio crece en `data/voz/`
   (se poda sola a 400 archivos).
7. **Las voces se perciben robóticas** (retroalimentación del anfitrión tras la primera
   prueba). Prioridad de la Etapa 2.
8. **La explicación del juego es plana**: informa, pero no engancha ni se entiende con la
   facilidad deseada. Prioridad de la Etapa 2.

## 8. Lo que sigue

El proyecto continúa más allá de la primera versión: ver `docs/HOJA_DE_RUTA.md`. Puntos de
extensión que el código ya deja preparados:

- **Más rondas**: un archivo en `engine/rondas/` y una entrada en `rondasActivas`.
- **Modo por equipos**: el marcador ya se calcula aparte de los jugadores.
- **Historial y temporadas**: `data/eventos.ndjson` es append-only y reconstruye partidas.
- **SQLite**: reimplementar `server/repositorio.js`, el único módulo que sabe de disco.
- **Redacción de pistas con un LLM local**: detrás de una interfaz `redactor(pista)`.

## 9. Mapa de la documentación

| Documento | Para qué |
|---|---|
| `README.md` | Técnico: cómo arrancar, estructura, configuración, seguridad |
| `docs/GIT.md` | Convenciones de trabajo, ramas y publicación |
| `docs/INSTALAR.md` | Instalar en otro PC desde cero, y cómo actualizar |
| `docs/GUIA_ANFITRION.md` | Para ti la noche del juego, sin tecnicismos |
| `docs/ARQUITECTURA.md` | Stack, modelo de datos, protocolo y **bitácora de decisiones** |
| `docs/INVESTIGACION.md` | Por qué este stack y no otro (Fase 0) |
| `docs/INVESTIGACION_VOZ.md` | Comparación de TTS offline, escucha a ciegas y por qué Kokoro |
| `docs/HIG.md` | Reglas de interfaz (derivadas de las HIG de Apple) |
| `docs/3D_WORLD_HIG.md` | Diseño del personaje 3D y su tabla de verificación |
| `docs/CREDITOS.md` | Licencias de todo lo que entra al proyecto |
| `docs/ESTADO.md` | Este documento (instantánea de la Etapa 1) |
| `docs/HOJA_DE_RUTA.md` | Visión, listones de calidad, etapas y pendientes vivos |

