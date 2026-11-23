# Créditos y licencias

## Sonidos y música
**No se usa ningún archivo de audio de terceros.** Todos los efectos y la música de
fondo se **sintetizan en el navegador** con la Web Audio API (`web/shared/audio.js`):
osciladores y ruido generados en el momento. Por eso:

- No hay nada que descargar ni que empaquetar.
- No hay licencias de terceros que respetar ni atribuir.
- **No se usa música, audio ni material de la serie "El Plan del Diablo"** ni de ningún
  otro programa. El parecido es solo de mecánica de juego.

Si en el futuro se agregan archivos de audio, deben ser **CC0 / dominio público**
(por ejemplo Freesound filtrado por CC0, o Kenney Audio) y cada archivo debe anotarse
aquí con: nombre del archivo, autor, fuente (URL), licencia y fecha de descarga.

| Archivo | Autor | Fuente | Licencia |
|---|---|---|---|
| *(ninguno por ahora)* | | | |

## Tipografía
`system-ui` — la fuente propia del sistema operativo. No se descarga ninguna fuente.

## Imágenes e iconos
Solo emojis del sistema y el código QR, que se genera localmente con `qrcode`.
No hay imágenes de terceros.

## Confeti
`web/shared/confeti.js` — escrito para este proyecto (canvas 2D), en lugar de usar
`canvas-confetti`, para no agregar una dependencia.

## Dependencias de software

| Paquete | Versión | Licencia |
|---|---|---|
| fastify | 5.12.8 | MIT |
| @fastify/static | 8.3.0 | MIT |
| @fastify/websocket | 11.3.7 | MIT |
| qrcode | 1.5.4 | MIT |
| Node.js (runtime) | 22 o 24 LTS | MIT |

Pruebas: `node:test`, integrado en Node. Sin dependencias de desarrollo.

## Voz neuronal (opcional)

| Componente | Versión | Licencia | Fuente |
|---|---|---|---|
| sherpa-onnx (`sherpa-onnx-node`) | 1.13.6 | Apache-2.0 | https://github.com/k2-fsa/sherpa-onnx |
| Voz `es_MX-claude-high` (Piper/VITS) | — | **Apache-2.0** (así lo declara su MODEL_CARD) | https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models · dataset: https://huggingface.co/spaces/HirCoir/Piper-TTS-Spanish |
| Alternativa `es_MX-ald-medium` | — | Unlicense | mismo lanzamiento |

El modelo **no se distribuye con el proyecto**: lo descarga `descargar-voz.bat` desde los
lanzamientos de sherpa-onnx en GitHub. Se guarda en `modelos/`, que está en `.gitignore`.
Si no está instalado, el juego usa las voces de Windows y funciona igual.

## Muestras del laboratorio de voz

`web/laboratorio/muestras/*.wav` son audios **generados por nosotros** con los modelos
listados arriba, a partir de frases propias del juego. No son grabaciones de terceros.
Están ahí para comparar motores a ciegas y no forman parte del juego.

| Muestra | Generada con |
|---|---|
| `piper-*.wav` | Piper `es_MX-claude-high` (Apache-2.0) |
| `kokoro-ef_dora-*`, `kokoro-em_alex-*`, `kokoro-em_santa-*` | Kokoro-82M v1.0 (Apache-2.0), voces en español |

## Motor 3D

| Componente | Versión | Licencia | Fuente |
|---|---|---|---|
| Three.js | 0.187.0 | MIT | https://github.com/mrdoob/three.js — vendorizado en `web/shared/vendor/three/` con su LICENSE |

El personaje y el escenario son **geometría propia construida por procedimiento**: no hay
modelos, texturas ni mallas de terceros.

## Voz del narrador
Voces de **texto a voz del propio Windows** (Sabina, Raúl, Helena, Pablo, Laura, o las
voces naturales de Narrador), usadas a través de la Web Speech API del navegador.
No se distribuye ninguna voz con el proyecto.
