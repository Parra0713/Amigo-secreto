/* ============================================================
   Hilo de voz.

   Generar voz neuronal es trabajo de CPU que tarda cientos de
   milisegundos —segundos la primera vez, al cargar el modelo— y
   sherpa-onnx trabaja de forma síncrona. Hecho en el hilo del
   servidor, congela la partida entera: mientras el grupier "piensa"
   su frase, nadie puede comprar una pista ni marcar listo, y los
   mensajes de los celulares se van acumulando en la cola.

   Así que la voz vive aquí, en su propio hilo. El servidor pide y
   sigue atendiendo; cuando el audio está, llega la respuesta.
   ============================================================ */

import { parentPort, workerData } from 'node:worker_threads';
import { crearVozNeural } from './voz-neural.js';

const callado = { info: () => {}, warn: () => {}, error: () => {} };
// Sin enHilo: este ya es el hilo, no debe abrir otro.
const voz = crearVozNeural({ ...workerData, log: callado });

parentPort.postMessage({ t: 'listo', disponible: voz.disponible, motivo: voz.motivo, motores: voz.motores });

parentPort.on('message', (mensaje) => {
  if (mensaje?.t !== 'generar') return;
  const { id, texto, personaje, opciones } = mensaje;
  try {
    const segundos = voz.generarSync(texto, personaje, opciones);
    parentPort.postMessage({ t: 'hecho', id, segundos });
  } catch (e) {
    parentPort.postMessage({ t: 'hecho', id, error: e.message });
  }
});
