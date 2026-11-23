# Fase 0 — Investigación de opciones (El Plan del Amigo Secreto)

> **Documento histórico de la Etapa 1.** Donde dice "MVP" se refiere a esa primera versión
> jugable. Las decisiones aquí tomadas se pueden reabrir con evidencia nueva; el criterio y el
> rumbo vigentes están en `docs/HOJA_DE_RUTA.md`.

Fecha de la investigación: **22 de noviembre de 2026**. Todas las versiones se
consultaron contra el registro de npm y la documentación oficial ese día, no de memoria.
Contexto que condiciona todo: **PC anfitrión con Windows**, **WiFi casero sin internet**,
**5 a 15 celulares**, mantenible por **una sola persona**.

---

## 1. Comparación de opciones

### 1.1 Servidor de tiempo real

| Opción | Última versión (fecha) | Licencia | Mantenimiento | 5–15 clientes | Qué ahorra | Costo de adopción |
|---|---|---|---|---|---|---|
| **`ws` + `node:http`** | ws 8.23.0 (2026-11-12) | MIT | Muy activo, estándar de facto | Sobrado (miles de conexiones) | Solo el protocolo WebSocket | Casi nulo; hay que escribir salas y reconexión |
| **Fastify 5 + `@fastify/websocket`** | fastify 5.12.8 (2026-11-02) / plugin 11.3.7 (2026-11-04) | MIT | Muy activo | Sobrado | Rutas, estáticos, validación, logging, hooks | Bajo; 2 dependencias |
| **Socket.IO** | 4.8.4 (2026-09-25) | MIT | Activo, comunidad enorme | Sobrado | Reconexión automática, salas, *rooms*, fallback a long-polling, ACKs | Medio: protocolo propio, cliente de ~45 kB que hay que empaquetar local |
| **Colyseus** | 0.18.12 (2026-11-07) | MIT | Muy activo (v0.18 en 2026) | Sobrado | Salas, sincronización de estado por *schema* con deltas binarios, matchmaking | Medio-alto: impone su modelo de estado y TypeScript; pensado para juegos en tiempo real continuo |
| **boardgame.io** | 0.50.2 (**2022-11-10**) | MIT | **Prácticamente detenido** (4 años sin release) | Suficiente | Turnos, log, *time travel*, multijugador | **Descartado** por abandono y porque su modelo de "estado G visible" choca con nuestro requisito de secretos |
| **PartyKit / partyserver** | partyserver 0.5.10 (2026-08-03, ISC) / partysocket 1.3.0 (2026-06-23) | ISC/MIT | Activo | Sobrado | Modelo de "servidor por sala" | **Descartado**: diseñado para Cloudflare Durable Objects; es justo lo contrario a *todo local sin internet* (partysocket sí es reutilizable como cliente con reconexión) |
| **uWebSockets.js** | No se publica en npm (se instala desde GitHub por tag) | Apache-2.0 | Activo | Excesivo (es el servidor WS más rápido en Node) | Rendimiento puro | **Descartado**: binario nativo por plataforma, instalación desde GitHub (necesita internet y toolchain); el rendimiento no es el problema aquí |
| **FastAPI + WebSockets (Python)** | FastAPI/uvicorn activos | MIT/BSD | Muy activo | Sobrado | Tipado con Pydantic | **Descartado**: obliga a dos lenguajes (el front igual es JS) y a instalar Python + venv en el PC de la casa |
| **Hono + WS** | 4.13.20 (2026-11-22) | MIT | Muy activo | Sobrado | Router minúsculo, multi-runtime | Alternativa válida; su fuerte es el *edge*, que no usamos |

**Conclusión del bloque:** con 15 clientes y mensajes de unos pocos por segundo, el
rendimiento **no es un criterio discriminante**: cualquiera de estas opciones sobra.
Lo que decide es cuánto código propio nos ahorramos sin atarnos a un modelo ajeno.
Socket.IO ahorra reconexión y salas pero mete un protocolo propio; Colyseus ahorra
sincronización de estado, pero en este juego **casi todo el estado es secreto y
personalizado por jugador**, que es exactamente donde la sincronización automática
de estado estorba (hay que estar excluyendo campos). Un WebSocket plano con mensajes
JSON explícitos por jugador es más simple de auditar y de probar.

### 1.2 Frontend (celular y TV)

| Opción | Versión (fecha) | Licencia | Veredicto |
|---|---|---|---|
| **HTML/CSS/JS plano** | — | — | **Elegido.** Sin paso de build, sin `node_modules` en el navegador, cero problemas de empaquetado offline. Las 3 vistas son pocas pantallas con estado simple |
| Alpine.js | 3.17.5 (2026-10-20) | MIT | 15 kB, se usa con un `<script>` local; buen plan B si el HTML de `/play` se vuelve espagueti |
| Svelte / SvelteKit | 5.59.1 (2026-11-20) | MIT | Excelente, pero exige Vite + build y sumar un paso de compilación al arranque en Windows |
| Preact | 11.2.0 (2026-11-06) | MIT | Ligero (~4 kB), pero JSX quiere build |
| Vue | activo | MIT | Más pesado de lo necesario |
| Vite | 8.3.8 (2026-11-11) | MIT | Útil solo si entra un framework con build; de momento **no aporta** |

### 1.3 Animaciones

| Opción | Versión (fecha) | Licencia | Veredicto |
|---|---|---|---|
| **CSS puro (transitions/keyframes/View Transitions)** | — | — | **Base elegida**: marcador, fichas, cartas que voltean |
| **canvas-confetti** | 1.9.4 (2025-10-25) | ISC | **Elegido** para el confeti del ganador: 1 archivo, ~6 kB, sin dependencias |
| GSAP | 3.15.1 (2026-11-04) | "Standard No Charge" (propietaria gratuita; desde 2025-04-30 Webflow la hizo **100 % gratis, plugins incluidos, también comercial**) | Potente; solo si se complica la revelación final. No es OSI-aprobada |
| anime.js | 4.5.0 (2026-06-22) | MIT | Alternativa MIT ligera a GSAP |
| Motion | 14.14.0 (2026-11-13) | MIT | Pensado para React |
| Lottie (lottie-web) | 5.13.0 (2025-05-21) | MIT | Descartado: exige producir JSON desde After Effects |

### 1.4 Audio

| Opción | Versión (fecha) | Licencia | Veredicto |
|---|---|---|---|
| **Web Audio API + `<audio>`** | nativo | — | **Elegido**: 8–10 efectos y una música de fondo no justifican una librería |
| Howler.js | 2.2.4 (**2023-09-19**) | MIT | Estable y muy usado, pero sin releases desde 2023; su gran valor (sprites, fallbacks de códec) no nos hace falta |
| Tone.js | 15.1.22 (2025-04-27) | MIT | Para síntesis musical; sobredimensionado |

### 1.5 Voz del narrador

| Opción | Offline | Español | Veredicto |
|---|---|---|---|
| **Web Speech API (`speechSynthesis`)** | Sí, con voces del sistema | Windows 10/11 traen **Sabina (es-MX)**, **Raul (es-MX)**, **Helena / Laura / Pablo (es-ES)** como voces SAPI, más las "voces naturales" de Narrador en español de España y México, que **funcionan sin internet una vez descargadas** | **Elegido**. Cero dependencias, cero megas en el repo. **No existe voz es-CO**: lo más cercano es es-MX |
| Piper (OHF-Voice/piper1-gpl) | Sí, CPU, tiempo real | Varias voces es-ES/es-MX | **Descartado en la Etapa 1 (reabrible)**: ~32 MB de wheel + modelos ONNX, Python en el PC, y **muchas voces están licenciadas solo para uso personal/no comercial** (para una fiesta familiar alcanza, pero complica el repo). Queda anotado como extensión |
| Audios pregrabados | Sí | Total control de acento y actuación | **Respaldo elegido para 5–8 frases clave** (redoble, "alguien está mintiendo", revelación). Lo mejor de atmósfera por archivo; no escala a frases con nombres variables |

**Aviso importante sobre `speechSynthesis` en Windows:** el navegador solo ve las voces
instaladas en el sistema y la lista llega **asíncrona** (`onvoiceschanged`), así que hay
que seleccionar la voz por `lang` empezando por `es-CO`, luego `es-MX`, `es-ES` y por
último cualquier `es-*`, y si no hay ninguna, **mostrar el texto y seguir sin voz**.
Dejé `tools/voces.html` en el proyecto: ábrelo con doble clic en el PC anfitrión y te
lista exactamente qué voces en español tiene esa máquina (columna `local=true` = sin internet).

### 1.6 Códigos QR

| Opción | Versión (fecha) | Licencia | Veredicto |
|---|---|---|---|
| **`qrcode` (npm)** | 1.5.4 (2024-08-05) | MIT | **Elegido**: genera el QR **en el servidor** como SVG/dataURL, así `/tv` no carga nada extra. Sin releases recientes, pero el formato QR no cambia y la API es mínima |
| `qr-code-styling`, `qrcode-generator` | — | MIT | Sin ventaja aquí |

### 1.7 Generación de pistas: reglas vs LLM local

Las plantillas determinísticas **bastan y son preferibles** en la Etapa 1:
el cuestionario (sección 3B del prompt) ya define categorías cerradas, el cálculo de
rareza es un conteo sobre el grupo, y la selección 1 fácil + 1 media + 1 difícil es un
problema de asignación trivial con 15 jugadores. Además, lo determinístico es lo único
**reproducible y testeable con semilla**, que es un criterio de aceptación.
Un LLM local (Ollama) solo mejoraría la redacción; se deja como punto de extensión
detrás de una interfaz `redactor(pista) -> texto` con implementación por plantillas.

### 1.8 Persistencia

| Opción | Versión (fecha) | Licencia | Veredicto |
|---|---|---|---|
| **JSON con escritura atómica** (`write` a `.tmp` + `rename`) + log de eventos | nativo | — | **Elegido en la Etapa 1**: una partida son unos pocos kB, se guarda tras cada acción, se lee al arrancar y se puede abrir con el Bloc de notas para depurar. Cero dependencias nativas |
| `node:sqlite` | Integrado; **"release candidate"** desde Node 24.15 / 25.7 | — | Muy atractivo (cero dependencias), pero aún RC y la API ha cambiado entre versiones (`DatabaseSync` → `Database`) |
| `better-sqlite3` | 13.2.0 (2026-11-14) | MIT | Rápido y maduro, pero es **módulo nativo**: si no hay binario precompilado para la versión de Node del PC, intenta compilar (y sin internet, falla) |
| **Migración futura** | | | El `engine` no sabe de almacenamiento: toda la persistencia pasa por un puerto `Repositorio` con `guardarSnapshot/cargarSnapshot/anexarEvento`. Cambiar JSON por SQLite es reimplementar ese único módulo |

### 1.9 Descubrimiento en la red local

| Opción | Fiabilidad | Veredicto |
|---|---|---|
| **IP del PC + QR en la TV** | La única que funciona siempre | **Elegido como vía principal** (`http://192.168.x.x:8080/play`) |
| `nombre.local` (mDNS, p. ej. `bonjour-service` 1.4.4, 2026-07-28, MIT) | **iOS/macOS: sí** (resolución mDNS en el sistema). **Android: desde finales de 2021 el resolutor del sistema resuelve `.local` por mDNS one-shot, pero en la práctica depende del fabricante y de la versión del módulo DNS; hay reportes de que funciona en unos equipos y en otros no** | **Opcional, nunca como único camino**: se puede anunciar, pero la TV siempre muestra la IP |
| Ancla: el QR codifica la URL con IP | — | Un jugador escanea y entra; nadie teclea nada |

---

## 2. Decisión (stack final) y por qué

**Node.js 22 LTS o 24 LTS + Fastify 5 + @fastify/websocket + HTML/CSS/JS plano + JSON atómico + Web Speech API + canvas-confetti + qrcode.**

Por qué este y no otro, contra los criterios del proyecto:

1. **Poco código.** Fastify nos da estáticos, rutas y logging; `@fastify/websocket`
   expone `ws` sin protocolo propio. La reconexión que regalaría Socket.IO la
   necesitamos **de todos modos a nivel de juego** (reanudar sesión por PIN y reenviar
   la vista personal del jugador), así que su valor real es menor de lo que parece.
2. **Fácil de instalar en Windows.** Un `npm install` de 3 dependencias sin módulos
   nativos ni compilación, y un `iniciar.bat`. Nada de Python, nada de toolchain.
3. **Funciona sin internet.** Todo se sirve desde el propio servidor; la voz la pone
   Windows; el QR se genera en el servidor. No hay un solo recurso remoto.
4. **Rendimiento.** 15 clientes y acciones por turno; el cuello de botella no existe.
5. **Mantenible por una persona.** Un solo lenguaje, sin paso de build, estado del
   juego en un módulo puro y probado con `vitest` (5.1.1, 2026-11-18, MIT).
6. **Secretos.** Con mensajes JSON explícitos y un **proyector de estado por jugador**
   (`vistaPara(jugadorId)`), el default es no enviar nada; la sincronización automática
   de estado de Colyseus invierte ese default, que es justo el riesgo que más nos importa.
7. **Escalable en el sentido que pediste.** Cada ronda es un plugin con
   `start/handleAction/onTimeout/end`; añadir juegos no toca el transporte.

**Puntos donde reconsideraría:** si en una temporada futura el juego pasa a tener acción
continua (movimiento, clics simultáneos a 20 Hz) o varias partidas en paralelo con
matchmaking, **Colyseus** es el cambio correcto. Si aparecen redes con proxies raros o
celulares viejos con WebSocket inestable, **Socket.IO** por su fallback a long-polling.

---

## 3. Riesgos conocidos y mitigación

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Firewall de Windows** bloquea el puerto al primer arranque | Nadie se conecta | Guía en `GUIA_ANFITRION.md` + regla solo para **perfil Privado**: `netsh advfirewall firewall add rule name="Amigo Secreto" dir=in action=allow protocol=TCP localport=8080 profile=private`. Nunca `profile=any` |
| **Aislamiento de clientes (AP isolation)** en el router | Los celulares ven internet pero no al PC | Detectarlo temprano: la guía incluye una prueba de 1 minuto (abrir la URL en un celular antes de repartir el QR). Plan B: activar zona WiFi desde un celular y conectar el PC ahí |
| **Celulares que se duermen / navegador suspende el WebSocket** | Jugador "desaparece" en medio de una ronda | Wake Lock API cuando esté disponible; heartbeat ping/pong; reconexión con reintento exponencial; **el servidor nunca pierde el estado**: al reconectar con su PIN, el jugador recibe su vista completa. Las rondas tienen `onTimeout` para no quedarse esperando a un ausente |
| **Autoplay de audio en móviles** | Sonidos mudos en `/play` | Un botón explícito de "Entrar al juego" desbloquea el `AudioContext` con el primer toque. La TV se abre manualmente, así que ahí hay gesto de usuario |
| **Sin voces en español en el PC** | Narrador mudo | `tools/voces.html` lo detecta antes de jugar; respaldo de audios pregrabados y texto en pantalla siempre visible |
| **Reinicio del servidor a mitad de partida** | Partida perdida | Snapshot JSON atómico tras cada acción + log de eventos; al arrancar, si hay partida en curso, ofrece retomarla |
| ~~OneDrive sincronizando `node_modules`~~ | — | **No aplica**: la carpeta `OneDrive\Documents` es un rezago de una instalación anterior; OneDrive ya no está sincronizando. El proyecto se queda donde está |
| **Fuga de secretos** | Se arruina el juego | Proyección por jugador + prueba automatizada que inspecciona todo el tráfico de un cliente buscando datos de terceros |
| **IP del PC cambia** (DHCP) | El QR de ayer no sirve | El QR se genera en cada arranque; opcionalmente reserva de IP en el router |

### Nota sobre la carpeta del proyecto
`C:\ruta\al\proyecto` **no está sincronizada**:
la carpeta `OneDrive` quedó de una instalación anterior que ya no corre. Por lo tanto
`node_modules` y `data/` se quedan dentro del proyecto, sin junctions ni exclusiones.
Igual van en `.gitignore` por higiene.

---

## 4. Lista de dependencias propuesta

| Paquete | Versión exacta | Licencia | Fuente | Para qué |
|---|---|---|---|---|
| `fastify` | 5.12.8 (2026-11-02) | MIT | https://www.npmjs.com/package/fastify | HTTP, estáticos, rutas, logging |
| `@fastify/websocket` | 11.3.7 (2026-11-04) | MIT | https://www.npmjs.com/package/@fastify/websocket | WebSocket sobre `ws` |
| `@fastify/static` | (última al instalar) | MIT | https://www.npmjs.com/package/@fastify/static | Servir `web/` |
| `qrcode` | 1.5.4 (2024-08-05) | MIT | https://www.npmjs.com/package/qrcode | QR de conexión en `/tv` |
| `canvas-confetti` | 1.9.4 (2025-10-25) | ISC | https://www.npmjs.com/package/canvas-confetti | Confeti del ganador (archivo local en `web/shared/`) |
| ~~`vitest`~~ | — | — | — | **Descartado en la Fase 2**: `node:test` viene integrado en Node, no hay que instalar nada y las pruebas corren sin internet |

Runtime: **Node.js 22 LTS o 24 LTS** (MIT). Node 24 incluye `node:sqlite` si algún día
migramos la persistencia. Total: **4 dependencias de producción, ninguna nativa, y
ninguna dependencia de desarrollo**.

Sonidos: se usarán archivos **CC0** (p. ej. Freesound filtrado por CC0, Kenney Audio) y
cada archivo quedará anotado con fuente y licencia en `docs/CREDITOS.md`.
**No se usará audio de la serie.**
