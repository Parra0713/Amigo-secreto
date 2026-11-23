/* ============================================================
   Reproductor de la voz neuronal, con procesamiento real.

   Esto es lo que `speechSynthesis` nunca permitió: como el audio lo genera el
   servidor y llega como WAV, pasa por el Web Audio API y se le puede hacer de
   todo. Lo que se hace, y por qué, para que se pueda ajustar con criterio:

   1. DESPLAZAMIENTO DE TONO Y FORMANTES. El servidor sintetiza un 6% acelerado
      y aquí se reproduce un 10% lento. El resultado neto: el habla corre casi a
      velocidad normal, pero el tono y los formantes bajan. Bajar formantes es lo
      que hace que una voz suene de un cuerpo más grande; bajar solo el tono
      suena a cinta lenta.
   2. DOBLAJE DESAFINADO. Una segunda copia 16 cents abajo y 24 ms después, un
      poco abierta en estéreo. Es el truco de doblar una toma en estudio: espesa
      la voz sin que se oiga como coro ni como eco.
   3. SOMBRA UNA OCTAVA ABAJO, muy filtrada y bajita. Da el peso "del otro lado"
      sin comerse la claridad.
   4. SUSURRO. Una copia pasa-altos, retrasada y a volumen muy bajo: el aliento
      detrás de la voz. Es lo que distingue a un narrador siniestro de uno grave.
   5. SALA CON PRE-RETARDO. 35 ms antes de la reverberación: el cerebro lee eso
      como un espacio grande. Sin pre-retardo suena a lata.
   6. ECO LEJANO filtrado, con poca realimentación: profundidad, no cueva.
   7. ECUALIZACIÓN: graves y pecho arriba, 2,5 kHz abajo (menos nasal) y 6,5 kHz
      abajo (los sintetizadores sisean).
   8. COMPRESIÓN al final: nivel parejo en una sala con gente hablando.

   Y lo que más se nota aunque no se oiga: con un AnalyserNode se mide la
   amplitud real, así que la boca del personaje 3D se mueve con la voz.
   ============================================================ */

const POR_DEFECTO = {
  grupier: {
    velocidad: 0.9, desafine: -16, retardoDoble: 0.024, nivelDoble: 0.42, apertura: 0.3,
    graves: 5.5, pecho: 2.5, presencia: -2, sibilancia: -5, saturacion: 0.3,
    preRetardo: 0.035, reverb: 0.3, eco: 0.16, ecoTiempo: 0.19,
    sombra: 0.13, susurro: 0.09, compresion: -22
  },
  explicador: {
    velocidad: 1, desafine: 0, retardoDoble: 0, nivelDoble: 0, apertura: 0,
    graves: 1, pecho: 0, presencia: 2, sibilancia: -2, saturacion: 0,
    preRetardo: 0.012, reverb: 0.08, eco: 0, ecoTiempo: 0,
    sombra: 0, susurro: 0, compresion: -18
  }
};

/** Curva de saturación suave. Sin cantidad, no toca nada. */
function curvaSaturacion(cantidad) {
  const n = 1024;
  const curva = new Float32Array(n);
  const k = cantidad * 12;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curva[i] = k === 0 ? x : Math.tanh(k * x) / Math.tanh(k);
  }
  return curva;
}

/** Impulso de sala generado al vuelo: ruido que decae, con dos canales distintos. */
function impulsoDeSala(ctx, segundos = 2.1, caida = 3.4) {
  const largo = Math.floor(ctx.sampleRate * segundos);
  const buffer = ctx.createBuffer(2, largo, ctx.sampleRate);
  for (let canal = 0; canal < 2; canal++) {
    const datos = buffer.getChannelData(canal);
    for (let i = 0; i < largo; i++) {
      const avance = i / largo;
      // Reflexiones tempranas dispersas y después una cola suave.
      const temprana = avance < 0.06 ? (Math.random() < 0.08 ? 1.6 : 0.25) : 1;
      datos[i] = (Math.random() * 2 - 1) * Math.pow(1 - avance, caida) * temprana;
    }
  }
  return buffer;
}

export function crearReproductorVoz({ ctx, destino, efectos = {}, alAgacharAmbiente }) {
  const ajustesDe = (personaje) => ({
    ...(POR_DEFECTO[personaje] || POR_DEFECTO.grupier),
    ...((efectos[personaje] || {}).efectos || {})
  });

  const cacheBuffers = new Map();
  const salaBuffer = impulsoDeSala(ctx);
  let activos = [];
  let animando = false;

  /* Cortar un audio NO es que la frase haya terminado.
     Al hacer stop(), el navegador dispara onended igual, y ese onended llamaba
     a alTerminar: el corto lo tomaba como "esta lámina ya acabó" y pasaba a la
     siguiente a los 900 ms, cortando la frase que acababa de empezar. Así que
     primero se desarma el onended, y la promesa pendiente se cierra con
     'cancelado', que no es lo mismo que "no sonó". */
  let cerrarPendiente = null;
  const cancelar = () => {
    for (const nodo of activos) { try { nodo.onended = null; nodo.stop(); } catch {} }
    activos = [];
    animando = false;
    alAgacharAmbiente?.(false);
    const cerrar = cerrarPendiente;
    cerrarPendiente = null;
    cerrar?.('cancelado');
  };

  async function traer(texto, personaje) {
    const clave = `${personaje}|${texto}`;
    if (cacheBuffers.has(clave)) return cacheBuffers.get(clave);
    const respuesta = await fetch(`/api/voz?p=${encodeURIComponent(personaje)}&t=${encodeURIComponent(texto)}`);
    if (!respuesta.ok) return null;
    const buffer = await ctx.decodeAudioData(await respuesta.arrayBuffer());
    cacheBuffers.set(clave, buffer);
    if (cacheBuffers.size > 120) cacheBuffers.delete(cacheBuffers.keys().next().value);
    return buffer;
  }

  /** Una copia del mismo audio, con su propio tono, filtro, retardo y posición. */
  function capa(buffer, { velocidad, desafine = 0, retardo = 0, nivel = 1, pan = 0, filtro }) {
    const fuente = ctx.createBufferSource();
    fuente.buffer = buffer;
    fuente.playbackRate.value = velocidad;
    if (desafine && fuente.detune) fuente.detune.value = desafine;

    let nodo = fuente;
    if (filtro) {
      const f = ctx.createBiquadFilter();
      Object.assign(f, { type: filtro.tipo });
      f.frequency.value = filtro.hz;
      if (filtro.q) f.Q.value = filtro.q;
      nodo = nodo.connect(f);
    }
    if (retardo) {
      const d = ctx.createDelay(1);
      d.delayTime.value = retardo;
      nodo = nodo.connect(d);
    }
    const g = ctx.createGain();
    g.gain.value = nivel;
    nodo = nodo.connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      nodo = nodo.connect(p);
    }
    return { fuente, salida: nodo };
  }

  async function reproducir(texto, personaje, { alNivel, alTerminar, alEmpezar } = {}) {
    const buffer = await traer(texto, personaje).catch(() => null);
    if (!buffer) return false;

    cancelar();
    const a = ajustesDe(personaje);

    // --- bus de la voz: ecualización, saturación y compresión ---
    const entrada = ctx.createGain();

    const graves = ctx.createBiquadFilter();
    graves.type = 'lowshelf'; graves.frequency.value = 180; graves.gain.value = a.graves;

    const pecho = ctx.createBiquadFilter();
    pecho.type = 'peaking'; pecho.frequency.value = 420; pecho.Q.value = 0.9; pecho.gain.value = a.pecho;

    const presencia = ctx.createBiquadFilter();
    presencia.type = 'peaking'; presencia.frequency.value = 2500; presencia.Q.value = 1; presencia.gain.value = a.presencia;

    const sibilancia = ctx.createBiquadFilter();
    sibilancia.type = 'peaking'; sibilancia.frequency.value = 6500; sibilancia.Q.value = 2; sibilancia.gain.value = a.sibilancia;

    const saturador = ctx.createWaveShaper();
    saturador.curve = curvaSaturacion(a.saturacion);
    saturador.oversample = '2x';

    const compresor = ctx.createDynamicsCompressor();
    compresor.threshold.value = a.compresion;
    compresor.knee.value = 24; compresor.ratio.value = 3;
    compresor.attack.value = 0.006; compresor.release.value = 0.22;

    entrada.connect(graves).connect(pecho).connect(presencia).connect(sibilancia)
           .connect(saturador).connect(compresor);

    const seco = ctx.createGain(); seco.gain.value = 1 - a.reverb * 0.45;
    compresor.connect(seco).connect(destino);

    // --- sala con pre-retardo ---
    if (a.reverb > 0) {
      const pre = ctx.createDelay(0.2); pre.delayTime.value = a.preRetardo;
      const sala = ctx.createConvolver(); sala.buffer = salaBuffer;
      const humedo = ctx.createGain(); humedo.gain.value = a.reverb;
      compresor.connect(pre).connect(sala).connect(humedo).connect(destino);
    }

    // --- eco lejano, filtrado y con poca realimentación ---
    if (a.eco > 0) {
      const retardo = ctx.createDelay(1); retardo.delayTime.value = a.ecoTiempo;
      const realim = ctx.createGain(); realim.gain.value = 0.22;
      const oscuro = ctx.createBiquadFilter(); oscuro.type = 'lowpass'; oscuro.frequency.value = 900;
      const nivelEco = ctx.createGain(); nivelEco.gain.value = a.eco;
      compresor.connect(retardo).connect(oscuro).connect(nivelEco).connect(destino);
      oscuro.connect(realim).connect(retardo);           // una cola corta, no una cueva
    }

    // --- medición para la boca del personaje ---
    const medidor = ctx.createAnalyser();
    medidor.fftSize = 512; medidor.smoothingTimeConstant = 0.5;
    compresor.connect(medidor);

    // --- capas ---
    const capas = [capa(buffer, { velocidad: a.velocidad, pan: a.apertura * 0.35 })];
    capas[0].salida.connect(entrada);

    if (a.nivelDoble > 0) {
      const doble = capa(buffer, {
        velocidad: a.velocidad, desafine: a.desafine, retardo: a.retardoDoble,
        nivel: a.nivelDoble, pan: -a.apertura
      });
      doble.salida.connect(entrada);
      capas.push(doble);
    }
    if (a.sombra > 0) {
      const sombra = capa(buffer, {
        velocidad: a.velocidad / 2, nivel: a.sombra,
        filtro: { tipo: 'lowpass', hz: 320 }
      });
      sombra.salida.connect(destino);                    // fuera del bus: pura masa
      capas.push(sombra);
    }
    if (a.susurro > 0) {
      const susurro = capa(buffer, {
        velocidad: a.velocidad * 1.004, retardo: 0.038, nivel: a.susurro,
        filtro: { tipo: 'highpass', hz: 1900 }
      });
      susurro.salida.connect(destino);
      capas.push(susurro);
    }

    activos = capas.map((c) => c.fuente);

    // La música de fondo se agacha mientras habla: claridad antes que atmósfera.
    alAgacharAmbiente?.(true);

    const datos = new Uint8Array(medidor.frequencyBinCount);
    animando = true;
    const medir = () => {
      if (!animando) return;
      medidor.getByteTimeDomainData(datos);
      let suma = 0;
      for (const v of datos) { const x = (v - 128) / 128; suma += x * x; }
      alNivel?.(Math.min(1, Math.sqrt(suma / datos.length) * 6));
      requestAnimationFrame(medir);
    };

    const fin = new Promise((resolve) => {
      cerrarPendiente = resolve;
      capas[0].fuente.onended = () => {
        cerrarPendiente = null;
        animando = false;
        alNivel?.(0);
        alAgacharAmbiente?.(false);
        alTerminar?.();
        resolve(true);
      };
    });

    const ahora = ctx.currentTime + 0.03;
    for (const c of capas) c.fuente.start(ahora);
    alEmpezar?.(buffer.duration);        // segundos exactos, no estimados
    medir();
    await fin;
    return true;
  }

  return { reproducir, cancelar, get disponible() { return true; } };
}

/** ¿El servidor tiene voz neuronal lista? */
export async function vozNeuralDisponible() {
  try {
    const r = await fetch('/api/voz/estado');
    if (!r.ok) return { disponible: false };
    return await r.json();
  } catch { return { disponible: false }; }
}
