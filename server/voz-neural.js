/* ============================================================
   Voz neuronal offline. Camino decidido en docs/INVESTIGACION_VOZ.md:
   sherpa-onnx (Apache-2.0) cargando una voz Piper en español con licencia
   permisiva (es_MX-claude-high, Apache-2.0, 22.050 Hz).

   Por qué este módulo existe aparte: es la ÚNICA dependencia nativa del
   proyecto y la única que necesita una descarga previa. Si no está instalada,
   si falta el modelo o si algo falla, este módulo se reporta como no
   disponible y el narrador del navegador sigue funcionando como antes.
   El juego nunca se queda sin voz por una dependencia opcional.
   ============================================================ */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/* Velocidad de SÍNTESIS por personaje (la de reproducción va en el navegador).
   El grupier se genera un poco acelerado a propósito: el navegador lo reproduce
   lento y eso baja tono y formantes sin arrastrar el habla. Es el truco que
   convierte una voz correcta en una voz grande. */
const VELOCIDAD = { grupier: 1.06, explicador: 1.0 };
const MAX_CACHE = 400;                       // archivos; una partida usa muchos menos

export function crearVozNeural({ carpetaModelos, carpetaCache, log = console, config = {} }) {
  const apagada = { disponible: false, motivo: 'no-iniciado', sintetizar: async () => null, estado: () => ({ disponible: false }) };

  let sherpa;
  try {
    sherpa = require('sherpa-onnx-node');
  } catch {
    return { ...apagada, motivo: 'sin-paquete' };
  }

  // Se acepta cualquier carpeta de modelo Piper: se busca el .onnx que haya.
  const carpetaVoz = config.carpeta
    ? join(carpetaModelos, config.carpeta)
    : (existsSync(carpetaModelos)
        ? readdirSync(carpetaModelos).map((d) => join(carpetaModelos, d)).find((d) => statSync(d).isDirectory())
        : null);

  if (!carpetaVoz || !existsSync(carpetaVoz)) return { ...apagada, motivo: 'sin-modelo' };

  const onnx = readdirSync(carpetaVoz).find((f) => f.endsWith('.onnx'));
  const tokens = join(carpetaVoz, 'tokens.txt');
  const datos = join(carpetaVoz, 'espeak-ng-data');
  if (!onnx || !existsSync(tokens) || !existsSync(datos)) return { ...apagada, motivo: 'modelo-incompleto' };

  let tts;
  try {
    tts = new sherpa.OfflineTts({
      model: {
        vits: { model: join(carpetaVoz, onnx), tokens, dataDir: datos },
        numThreads: config.hilos ?? 2,
        debug: false
      },
      maxNumSentences: 1
    });
  } catch (e) {
    log.warn?.(`voz neural: no arrancó (${e.message})`);
    return { ...apagada, motivo: 'fallo-al-cargar' };
  }

  mkdirSync(carpetaCache, { recursive: true });
  const enVuelo = new Map();                 // evita sintetizar dos veces lo mismo a la vez

  const nombreDe = (texto, personaje) =>
    `${personaje}-${createHash('sha1').update(`${personaje}|${texto}`).digest('hex').slice(0, 16)}.wav`;

  /** Borra lo más viejo si la caché crece demasiado. */
  function podar() {
    try {
      const archivos = readdirSync(carpetaCache)
        .map((f) => ({ f, t: statSync(join(carpetaCache, f)).mtimeMs }))
        .sort((a, b) => a.t - b.t);
      while (archivos.length > MAX_CACHE) unlinkSync(join(carpetaCache, archivos.shift().f));
    } catch {}
  }

  /**
   * Devuelve la ruta del WAV para ese texto y personaje, generándolo si hace falta.
   * Es idempotente y cacheado: la segunda vez cuesta cero.
   */
  async function sintetizar(texto, personaje = 'grupier') {
    const limpio = String(texto || '').trim().slice(0, 600);
    if (!limpio) return null;

    const archivo = join(carpetaCache, nombreDe(limpio, personaje));
    if (existsSync(archivo)) return archivo;
    if (enVuelo.has(archivo)) return enVuelo.get(archivo);

    const tarea = (async () => {
      const t0 = Date.now();
      const velocidad = config[personaje]?.sintesis?.velocidad ?? VELOCIDAD[personaje] ?? 1;
      const audio = tts.generate({ text: limpio, sid: config.sid ?? 0, speed: velocidad });
      sherpa.writeWave(archivo, { samples: audio.samples, sampleRate: audio.sampleRate });
      log.info?.(`voz neural: "${limpio.slice(0, 32)}…" (${personaje}) en ${Date.now() - t0} ms`);
      podar();
      return archivo;
    })();

    enVuelo.set(archivo, tarea);
    try { return await tarea; } finally { enVuelo.delete(archivo); }
  }

  /**
   * Genera de antemano las frases fijas, para que en vivo nunca haya espera.
   * La síntesis bloquea el hilo, así que entre frase y frase se cede el control:
   * el servidor tiene que seguir atendiendo celulares mientras se precalienta.
   */
  async function precalentar(frases, { pausaMs = 150 } = {}) {
    let hechas = 0, saltadas = 0;
    for (const [i, { texto, personaje }] of frases.entries()) {
      const archivo = join(carpetaCache, nombreDe(String(texto).trim().slice(0, 600), personaje));
      if (existsSync(archivo)) { saltadas++; continue; }
      try { await sintetizar(texto, personaje); hechas++; } catch {}
      if (i % 10 === 9) log.info?.(`voz neural: precalentando… ${i + 1}/${frases.length}`);
      await new Promise((r) => setTimeout(r, pausaMs));
    }
    log.info?.(`voz neural: ${hechas} frases generadas, ${saltadas} ya estaban en caché`);
    return hechas;
  }

  log.info?.(`voz neural lista: ${onnx} a ${tts.sampleRate} Hz`);
  return {
    disponible: true,
    motivo: 'ok',
    sintetizar,
    precalentar,
    estado: () => ({ disponible: true, modelo: onnx, sampleRate: tts.sampleRate })
  };
}
