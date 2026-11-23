# Investigación: voz offline de código abierto

Fecha: **23 de noviembre de 2026**. Pregunta concreta: ¿hay un proyecto de código abierto,
bien puntuado y mantenido, que dé una voz en español **claramente mejor** que la de Windows,
funcionando **sin internet** en el PC anfitrión y sin volver el proyecto inmanejable?

Respuesta corta: **sí, y el camino es sherpa-onnx + una voz Piper en español con licencia
permisiva.** Pero no entra como dependencia obligatoria, por las razones de la sección 5 (se implementó como opcional; ver la sección 4).

---

## 1. Lo que descarta la mitad de las opciones: el requisito de "sin internet"

- Las voces **"Natural" de Microsoft** son neuronales y suenan muy bien, pero se transmiten
  desde la nube y **no tienen respaldo local**; además solo las expone Edge, no Chrome ni
  los demás navegadores basados en Chromium. En una noche sin internet, no existen.
- Lo mismo aplica a cualquier API de nube (Azure, ElevenLabs, OpenAI): quedan fuera por
  definición del proyecto.
- Chrome en Windows solo ve las voces **SAPI locales** instaladas en el sistema. Eso es el
  piso de calidad del que partimos: Sabina y Raúl (es-MX), Helena, Pablo y Laura (es-ES).

## 2. Comparación de los proyectos candidatos

| Proyecto | Repo | Licencia | Mantenimiento | Español | Corre en | Veredicto para este caso |
|---|---|---|---|---|---|---|
| **sherpa-onnx** | `k2-fsa/sherpa-onnx` | **Apache-2.0** | ~14.200 ★, empujado en ago-2026 | Sí, vía voces Piper/VITS y Kokoro | C++ con **enlace para Node** (`sherpa-onnx-node`), CPU | **La mejor opción.** Es el *runtime*, no el modelo: carga ONNX de Piper, Kokoro o Matcha. Apache-2.0, así que no contagia nada |
| **Piper (motor nuevo)** | `OHF-Voice/piper1-gpl` | **GPL-3.0-or-later** | ~5.160 ★, ago-2026 | Muchas voces es-ES / es-MX | Python / CLI, CPU | Buen motor, pero **GPL**: usarlo como ejecutable está bien, enlazarlo no. Mejor cargar sus *voces* desde sherpa-onnx |
| Piper (repo viejo) | `rhasspy/piper` | MIT | **Archivado** (~11.280 ★), el README es una línea que apunta al nuevo | — | — | No usar: está archivado |
| **Voces Piper** | `rhasspy/piper-voices` | **por voz** | Activo | `es_MX-claude-high` (**Apache-2.0**), `es_MX-ald-medium` (**Unlicense**), `es_ES-carlfm-x_low` (**dominio público**), `es_ES-mls_*` (**CC BY 4.0**) | ONNX, ~63 MB las "high" | Hay voces en español con licencia **permisiva**: es el hallazgo que cambia la decisión |
| **Kokoro-82M** | `hexgrad/kokoro` | **Apache-2.0** (código y pesos) | El modelo abierto más descargado; ~1.060 en Artificial Analysis | Sí: `ef_dora`, `em_alex`, `em_santa` con G2P de espeak-ng | Python, o ONNX vía sherpa-onnx | Excelente y permisivo, pero su soporte de español depende de espeak-ng y la calidad fuera del inglés es desigual |
| **kokoro-js** | npm `kokoro-js` | Apache-2.0 | ~11.000 descargas semanales | **Solo inglés** en la versión JS | Node y navegador (WASM/WebGPU) | Sería ideal —un `npm install` y listo— pero hoy no habla español |
| Chatterbox | `resemble-ai/chatterbox` | MIT | Muy activo, gana pruebas ciegas frente a servicios de pago | Multilingüe | GPU recomendada | Demasiado pesado para un PC de sala |
| XTTS-v2 / Coqui | `coqui-ai/TTS` | Código abierto, **pesos no comerciales** | Repo archivado por el cierre de Coqui | Sí | GPU | Descartado: abandonado y con licencia incómoda |
| eSpeak-NG | `espeak-ng/espeak-ng` | GPL-3.0 | Activo | Sí | CPU, minúsculo | Suena peor que Windows. Útil solo como fonetizador |

## 3. Recomendación

**sherpa-onnx-node + `es_MX-claude-high` (Apache-2.0)**, con `es_MX-ald-medium` (Unlicense)
como alternativa más liviana.

Por qué esa combinación y no otra:

1. **Licencias limpias de punta a punta:** runtime Apache-2.0, voz Apache-2.0. Ni GPL ni
   "solo uso no comercial" en ningún eslabón.
2. **Node puro desde el punto de vista del proyecto:** `npm install sherpa-onnx-node` trae
   binarios precompilados; no hay que instalar Python ni un compilador en el PC de la casa.
3. **Una sola descarga de ~63 MB**, que queda en disco. Después, todo offline.
4. **Y el beneficio grande, que no es la calidad de la voz:** al generar el audio nosotros,
   el WAV pasa por el **Web Audio API**. Eso habilita lo que `speechSynthesis` nunca
   permitió: reverberación de sala, filtros, saturación suave y desplazamiento de tono
   reales. La "voz del diablo" dejaría de ser un ajuste de `pitch` y pasaría a ser
   procesamiento de audio de verdad.

## 4. ESTADO: implementado el 23 de noviembre de 2026

Se implementó tal cual la recomendación de la sección 3, aceptando a conciencia que
rompe la regla de "ninguna dependencia nativa":

- `sherpa-onnx-node@1.13.6` como **dependencia opcional**. Las cuatro obligatorias siguen
  siendo puras: si la neuronal falta o falla, el juego arranca igual.
- Voz `es_MX-claude-high` (Apache-2.0) en `modelos/`, descargada por `descargar-voz.bat`.
- `server/voz-neural.js`: síntesis, caché en `data/voz/` por hash de texto + personaje,
  poda a 400 archivos, y precalentamiento de todas las frases fijas al arrancar.
- `GET /api/voz?t=…&p=grupier|explicador` devuelve WAV; `GET /api/voz/estado` dice si hay.
- `web/shared/voz.js`: el audio pasa por Web Audio con cadena por personaje
  (realce de graves, presencia, saturación suave, sala por convolución generada al vuelo,
  y para el grupier una voz-sombra una octava abajo al 14%).
- La **boca del personaje 3D se mueve con la amplitud real del audio**, medida con un
  AnalyserNode, y los ojos se encienden con ella.

**Medido en la máquina de pruebas:** primera frase 3,2 s (carga del modelo), siguientes
~165 ms por frase, y 0 ms desde caché. Una frase de 5 segundos pesa ~220 kB.

### Nota sobre la versión de sherpa-onnx
**No subir a 2.x.** Desde la 2.0.0 se quitó el frontend de espeak-ng integrado: el
parámetro `dataDir` se ignora y hay que pasar los fonemas desde fuera. Con 2.0.3 la
síntesis falla con *"phoneme_codepoints is empty"*. La 1.13.6 funciona tal cual.

## 5. Por qué no había entrado en la primera versión

- Es un **módulo nativo**: rompe la regla de "ninguna dependencia nativa" que hace que
  `npm install` nunca falle en un PC con Windows sin herramientas de compilación.
- Necesita **descargar el modelo una vez**, con internet; el proyecto hoy se instala con
  4 paquetes puros y nada más.
- Suma **latencia de síntesis**: hay que generar y cachear el audio de cada frase, lo que
  obliga a un sistema de caché en disco y a decidir qué pasa mientras se genera.
- El objetivo de esta noche era que el juego funcione. El narrador actual, con dos voces,
  prosodia trabajada y troceo por frases, ya cumple.

## 6. Cómo se dejó preparado el terreno

La forma de la pieza que falta ya está decidida, para que sea un cambio aislado:

- Todo el habla pasa por `web/shared/narrador.js`, con la interfaz
  `decir(texto, { personaje })`. Un reproductor de audio pregenerado se enchufa ahí,
  detrás de la misma interfaz, sin tocar la TV ni el juego.
- El servidor ya tiene dónde vivir: un `server/voz-neural.js` que exponga
  `GET /api/voz?texto=...&personaje=...` devolviendo WAV, con caché en `data/voz/`.
- Si ese módulo no está presente o falla, el narrador cae a `speechSynthesis` como hoy.
  **El juego nunca debe quedar sin voz por una dependencia opcional.**

*(Este plan es el que se ejecutó; ver la sección 4.)*

## 7. Fuentes

- AssemblyAI, *Best free TTS APIs and open-source text-to-speech models (2026)* — tabla de licencias y último commit.
- Cartesia, *Best open-source TTS models, compared by license*.
- localaimaster, *Best Local TTS Without a GPU* — estrellas y últimos empujes de Piper y sherpa-onnx.
- Readium, *SpeechSynthesis in browsers and OSes* — las voces "natural" requieren conexión.
- `huggingface.co/rhasspy/piper-voices` y `huggingface.co/PYTHAI/voaice` — licencia por voz.
- `huggingface.co/hexgrad/Kokoro-82M` (VOICES.md) — voces en español de Kokoro.
- Documentación de la API de JavaScript de sherpa-onnx (`sherpa-onnx-node`).

## 8. Etapa 2: hacia una voz natural (23 de noviembre de 2026)

La conclusión de esta investigación (sherpa-onnx + una voz Piper) respondió a la pregunta de
la Etapa 1: *¿hay algo mejor que la voz de Windows, offline y sin volver el proyecto
inmanejable?* **No es una conclusión definitiva.** Tras la primera prueba, el anfitrión
reportó que **las voces siguen sonando robóticas**.

Hipótesis a descartar con un laboratorio de escucha A/B, antes de cambiar nada:

1. **El modelo:** Piper `high` es bueno pero poco expresivo; hay familias más recientes y
   expresivas que evaluar (licencia, español, velocidad en la CPU real y ruta posible en la
   RX 6600, que no tiene CUDA).
2. **El procesamiento:** la cadena de efectos del grupier (formantes 1.10 → 0.87, doblaje,
   voz-sombra, susurro, sala, eco, EQ y compresor) puede estar restando naturalidad en vez de
   sumar carácter.
3. **La prosodia:** frases con entonación plana, pausas uniformes y una sola toma por frase.
4. **El texto:** el banco de frases se escribió para leerse y no para decirse.
5. **La falta de es-CO:** el acento es-MX en una familia colombiana se nota.

Oportunidad principal: el texto es casi todo predecible y los nombres se conocen en el
registro, así que se puede **pre-renderizar con un modelo más lento y mejor** (varias tomas
por frase) en lugar de sintetizar en vivo. El encargo completo está en
`docs/PROMPT_ETAPA_2.md`.
