/* ============================================================
   Voz neuronal offline, con varios motores.

   Decidido por escucha a ciegas el 23 de noviembre de 2026 (12 comparaciones,
   ver docs/INVESTIGACION_VOZ.md §5): Kokoro gana 6-0 sobre Piper, incluida la
   prueba de inteligibilidad con la música encima. Pero Kokoro corre a ~1,2x
   tiempo real: inservible para hablar en vivo.

   De ahí la arquitectura:
   · Kokoro PRE-RENDERIZA el banco de frases fijas, antes de jugar.
   · Piper queda como motor rápido para lo imprevisto (nombres que no se
     alcanzaron a generar, frases nuevas sin reiniciar).
   · Si no hay ningún modelo, la voz del navegador. El juego nunca queda mudo.
   ============================================================ */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const MAX_CACHE = 600;

/** Reconoce qué motor es cada carpeta de modelos/ por los archivos que tiene. */
function detectarMotor(carpeta) {
  const archivos = readdirSync(carpeta);
  const onnx = archivos.find((f) => f.endsWith('.onnx'));
  if (!onnx || !archivos.includes('tokens.txt')) return null;
  if (archivos.includes('voices.bin')) return { tipo: 'kokoro', onnx };
  if (archivos.includes('espeak-ng-data')) return { tipo: 'vits', onnx };
  return null;
}

export function crearVozNeural({ carpetaModelos, carpetaCache, log = console, config = {}, enHilo = false }) {
  const apagada = {
    disponible: false, motores: [], motivo: 'no-iniciado',
    sintetizar: async () => null, precalentar: async () => 0,
    estado: () => ({ disponible: false })
  };

  let sherpa;
  try { sherpa = require('sherpa-onnx-node'); }
  catch { return { ...apagada, motivo: 'sin-paquete' }; }

  if (!existsSync(carpetaModelos)) return { ...apagada, motivo: 'sin-modelo' };

  // ---------- carga perezosa de motores ----------
  const definiciones = {};
  for (const entrada of readdirSync(carpetaModelos)) {
    const ruta = join(carpetaModelos, entrada);
    if (!statSync(ruta).isDirectory()) continue;
    const motor = detectarMotor(ruta);
    if (!motor) continue;
    definiciones[motor.tipo] = { ...motor, carpeta: ruta, nombre: entrada };
  }
  if (!Object.keys(definiciones).length) return { ...apagada, motivo: 'modelo-incompleto' };

  const cargados = {};
  function motor(tipo) {
    if (cargados[tipo]) return cargados[tipo];
    const def = definiciones[tipo];
    if (!def) return null;
    const { carpeta, onnx } = def;
    try {
      const modelo = def.tipo === 'kokoro'
        ? {
            kokoro: {
              model: join(carpeta, onnx), voices: join(carpeta, 'voices.bin'),
              tokens: join(carpeta, 'tokens.txt'), dataDir: join(carpeta, 'espeak-ng-data'),
              dictDir: existsSync(join(carpeta, 'dict')) ? join(carpeta, 'dict') : undefined,
              lexicon: ['lexicon-us-en.txt', 'lexicon-zh.txt']
                .map((f) => join(carpeta, f)).filter(existsSync).join(','),
              lang: 'es'
            }
          }
        : {
            vits: {
              model: join(carpeta, onnx), tokens: join(carpeta, 'tokens.txt'),
              dataDir: join(carpeta, 'espeak-ng-data')
            }
          };
      const t0 = Date.now();
      cargados[tipo] = new sherpa.OfflineTts({
        model: { ...modelo, numThreads: config.hilos ?? 4, debug: false },
        maxNumSentences: 1
      });
      log.info?.(`voz: motor ${tipo} (${def.nombre}) cargado en ${Date.now() - t0} ms`);
      return cargados[tipo];
    } catch (e) {
      log.warn?.(`voz: el motor ${tipo} no cargó (${e.message})`);
      definiciones[tipo] = null;
      return null;
    }
  }

  // ---------- qué voz usa cada personaje ----------
  const vozDe = (personaje) => {
    const propia = config[personaje]?.neural || {};
    const esKokoro = definiciones.kokoro && (propia.motor ?? 'kokoro') === 'kokoro';
    return {
      motor: esKokoro ? 'kokoro' : 'vits',
      sid: propia.sid ?? (esKokoro ? (personaje === 'explicador' ? 51 : 53) : 0),
      velocidad: propia.velocidad ?? (personaje === 'explicador' ? 1 : 0.97)
    };
  };

  // ---------- banco pre-renderizado ----------
  const carpetaBanco = join(carpetaCache, 'banco');
  mkdirSync(carpetaBanco, { recursive: true });
  const rutaIndice = join(carpetaBanco, 'indice.json');
  let indice = {};
  try { indice = JSON.parse(readFileSync(rutaIndice, 'utf8')); } catch {}
  const ultimaToma = new Map();

  const clave = (texto, personaje) => {
    const v = vozDe(personaje);
    const huella = createHash('sha1').update(`${v.motor}:${v.sid}:${personaje}|${texto.trim()}`).digest('hex');
    return `${personaje}-${v.motor}-${huella.slice(0, 14)}`;
  };

  const guardarIndice = () => { try { writeFileSync(rutaIndice, JSON.stringify(indice)); } catch {} };

  /** Elige una toma del banco, sin repetir la última que sonó. */
  function delBanco(texto, personaje) {
    const k = clave(texto, personaje);
    const tomas = (indice[k] || []).filter((f) => existsSync(join(carpetaBanco, f)));
    if (!tomas.length) return null;
    const previa = ultimaToma.get(k);
    const opciones = tomas.length > 1 ? tomas.filter((t) => t !== previa) : tomas;
    const elegida = opciones[Math.floor(Math.random() * opciones.length)];
    ultimaToma.set(k, elegida);
    return join(carpetaBanco, elegida);
  }

  // ---------- síntesis en vivo, con caché ----------
  mkdirSync(carpetaCache, { recursive: true });
  const enVuelo = new Map();

  function podar() {
    try {
      const archivos = readdirSync(carpetaCache)
        .filter((f) => f.endsWith('.wav'))
        .map((f) => ({ f, t: statSync(join(carpetaCache, f)).mtimeMs }))
        .sort((a, b) => a.t - b.t);
      while (archivos.length > MAX_CACHE) unlinkSync(join(carpetaCache, archivos.shift().f));
    } catch {}
  }

  function generar(texto, personaje, { forzarMotor, ajusteVelocidad = 1, destino } = {}) {
    const voz = vozDe(personaje);
    const tipo = forzarMotor || voz.motor;
    const usado = definiciones[tipo] ? tipo : (tipo === 'kokoro' ? 'vits' : 'kokoro');
    const tts = motor(usado);
    if (!tts) throw new Error('SIN_MOTOR');
    // Los identificadores de voz son del modelo: Piper tiene una sola, Kokoro muchas.
    const sid = usado === 'kokoro' ? voz.sid : 0;
    const audio = tts.generate({ text: texto, sid, speed: voz.velocidad * ajusteVelocidad });
    sherpa.writeWave(destino, { samples: audio.samples, sampleRate: audio.sampleRate });
    return audio.samples.length / audio.sampleRate;
  }

  // ---------- el hilo que genera sin congelar la partida ----------
  let hilo = null;              // null: sin abrir · 'roto': no se pudo, se genera aquí
  let siguienteId = 1;
  const pendientes = new Map();

  function abrirHilo() {
    try {
      const { Worker } = require('node:worker_threads');
      const w = new Worker(new URL('./voz-hilo.js', import.meta.url), {
        workerData: { carpetaModelos, carpetaCache, config }
      });
      w.unref();                // no debe impedir que el servidor cierre
      w.on('message', (m) => {
        if (m.t === 'listo') return log.info?.(`voz: hilo listo (${m.motores?.join(', ') || m.motivo})`);
        if (m.t !== 'hecho') return;
        const espera = pendientes.get(m.id);
        if (!espera) return;
        pendientes.delete(m.id);
        if (m.error) espera.rechazar(new Error(m.error));
        else espera.cumplir(m.segundos);
      });
      const caer = (motivo) => {
        hilo = 'roto';
        log.warn?.(`voz: el hilo falló (${motivo}); se genera en el hilo principal`);
        pendientes.forEach(({ rechazar }) => rechazar(new Error('HILO_CAIDO')));
        pendientes.clear();
      };
      w.on('error', (e) => caer(e.message));
      w.on('exit', (codigo) => { if (hilo === w) caer(`salió con ${codigo}`); });   // si ya cerramos, hilo !== w
      return w;
    } catch (e) {
      log.warn?.(`voz: no se pudo abrir el hilo (${e.message})`);
      return 'roto';
    }
  }

  /** Pide el audio al hilo; si no hay hilo, lo hace aquí mismo. */
  function generarFuera(texto, personaje, opciones) {
    if (hilo === null) hilo = abrirHilo();
    if (hilo === 'roto') return Promise.resolve(generar(texto, personaje, opciones));
    const id = siguienteId++;
    return new Promise((cumplir, rechazar) => {
      pendientes.set(id, { cumplir, rechazar });
      hilo.postMessage({ t: 'generar', id, texto, personaje, opciones });
    }).catch((e) => {
      if (e.message !== 'HILO_CAIDO') throw e;
      return generar(texto, personaje, opciones);   // reintento local, una vez
    });
  }

  /**
   * Devuelve la ruta del audio de una frase. Primero mira el banco
   * pre-renderizado; si no está, la genera con el motor rápido.
   */
  async function sintetizar(texto, personaje = 'grupier', opciones = {}) {
    const limpio = String(texto || '').trim().slice(0, 600);
    if (!limpio) return null;

    if (!opciones.forzarMotor) {
      const delBancoRuta = delBanco(limpio, personaje);
      if (delBancoRuta) return delBancoRuta;
    }

    const archivo = join(carpetaCache, `${clave(limpio, personaje)}.wav`);
    if (existsSync(archivo)) return archivo;
    if (enVuelo.has(archivo)) return enVuelo.get(archivo);

    const tarea = (async () => {
      const t0 = Date.now();
      // En vivo manda la velocidad: Piper, salvo que solo exista Kokoro.
      const rapido = definiciones.vits ? 'vits' : undefined;
      const peticion = { forzarMotor: opciones.forzarMotor || rapido, destino: archivo };
      const dur = enHilo ? await generarFuera(limpio, personaje, peticion) : generar(limpio, personaje, peticion);
      log.info?.(`voz en vivo: ${dur.toFixed(1)}s en ${Date.now() - t0} ms${enHilo ? ' (en hilo)' : ''} — "${limpio.slice(0, 30)}…"`);
      podar();
      return archivo;
    })();

    enVuelo.set(archivo, tarea);
    try { return await tarea; } finally { enVuelo.delete(archivo); }
  }

  /**
   * Pre-renderiza frases al banco con el motor bueno, varias tomas cada una.
   * Es lento a propósito: corre antes de jugar, no durante.
   */
  async function prerenderizar(frases, { tomas = 2, alAvanzar, pausaMs = 0 } = {}) {
    let generadas = 0, saltadas = 0;
    for (const [i, { texto, personaje }] of frases.entries()) {
      const limpio = String(texto).trim().slice(0, 600);
      const k = clave(limpio, personaje);
      const existentes = (indice[k] || []).filter((f) => existsSync(join(carpetaBanco, f)));
      if (existentes.length >= tomas) { saltadas++; alAvanzar?.(i + 1, frases.length, true); continue; }

      const nuevas = [...existentes];
      for (let t = existentes.length; t < tomas; t++) {
        const nombre = `${k}-${t}.wav`;
        try {
          // Cada toma con una velocidad apenas distinta: así la misma frase
          // repetida en la noche no suena calcada.
          generar(limpio, personaje, { ajusteVelocidad: 1 + (t - (tomas - 1) / 2) * 0.03, destino: join(carpetaBanco, nombre) });
          nuevas.push(nombre);
          generadas++;
        } catch (e) { log.warn?.(`voz: falló "${limpio.slice(0, 24)}…" (${e.message})`); }
        if (pausaMs) await new Promise((r) => setTimeout(r, pausaMs));
      }
      indice[k] = nuevas;
      guardarIndice();
      alAvanzar?.(i + 1, frases.length, false);
    }
    return { generadas, saltadas };
  }

  /** Genera en segundo plano, sin bloquear la partida. */
  async function precalentar(frases, { pausaMs = 150 } = {}) {
    let hechas = 0;
    for (const { texto, personaje } of frases) {
      const limpio = String(texto).trim().slice(0, 600);
      if (delBanco(limpio, personaje)) continue;
      try { await sintetizar(limpio, personaje); hechas++; } catch {}
      await new Promise((r) => setTimeout(r, pausaMs));
    }
    if (hechas) log.info?.(`voz: ${hechas} frases generadas en segundo plano`);
    return hechas;
  }

  const motoresDisponibles = Object.keys(definiciones).filter((k) => definiciones[k]);
  log.info?.(`voz neural lista — motores: ${motoresDisponibles.join(', ')} · banco: ${Object.keys(indice).length} frases`);

  return {
    disponible: true,
    motivo: 'ok',
    motores: motoresDisponibles,
    sintetizar,
    prerenderizar,
    precalentar,
    generarSync: generar,   // lo llama server/voz-hilo.js
    /** Cierra el hilo de voz. Sin esto, el proceso queda vivo esperándolo. */
    cerrar: async () => {
      if (!hilo || hilo === 'roto') return;
      const w = hilo;
      hilo = 'roto';
      pendientes.forEach(({ rechazar }) => rechazar(new Error('HILO_CAIDO')));
      pendientes.clear();
      await w.terminate();
    },
    estado: () => ({
      disponible: true,
      motores: motoresDisponibles,
      modelos: Object.fromEntries(Object.entries(definiciones).filter(([, v]) => v).map(([k, v]) => [k, v.nombre])),
      frasesEnBanco: Object.keys(indice).length
    })
  };
}
