// Sonidos sintetizados con Web Audio API: ni un archivo de audio, ni una licencia ajena.
let ctx = null, ganancia = null, ambiente = null, silenciado = false;

export function desbloquear() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  ganancia = ctx.createGain();
  ganancia.gain.value = 0.5;
  ganancia.connect(ctx.destination);
  return ctx;
}

/** El contexto y el bus maestro, para que la voz neuronal se mezcle aquí mismo. */
export const contexto = () => ctx;
export const salida = () => ganancia;

export const silenciar = (valor) => {
  silenciado = valor;
  if (ganancia) ganancia.gain.value = valor ? 0 : 0.5;
};

function tono({ freq = 440, dur = 0.18, tipo = 'sine', vol = 0.25, desde = 0, barrido = null }) {
  if (!ctx || silenciado) return;
  const t0 = ctx.currentTime + desde;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t0);
  if (barrido) osc.frequency.exponentialRampToValueAtTime(barrido, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ganancia);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function ruido({ dur = 0.3, vol = 0.2, desde = 0 }) {
  if (!ctx || silenciado) return;
  const t0 = ctx.currentTime + desde;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = (Math.random() * 2 - 1) * (1 - i / datos.length);
  const fuente = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = vol;
  fuente.buffer = buffer;
  fuente.connect(g).connect(ganancia);
  fuente.start(t0);
}

export const sonidos = {
  toque:    () => tono({ freq: 520, dur: 0.08, tipo: 'triangle', vol: 0.15 }),
  fichaSube:() => { tono({ freq: 523, dur: 0.1 }); tono({ freq: 784, dur: 0.14, desde: 0.08 }); },
  fichaBaja:() => tono({ freq: 300, dur: 0.22, tipo: 'sawtooth', vol: 0.18, barrido: 120 }),
  tic:      () => tono({ freq: 1200, dur: 0.05, tipo: 'square', vol: 0.12 }),
  trampa:   () => { tono({ freq: 180, dur: 0.3, tipo: 'sawtooth', vol: 0.2, barrido: 90 }); ruido({ dur: 0.2, vol: 0.08, desde: 0.05 }); },
  acierto:  () => [523, 659, 784, 1046].forEach((f, i) => tono({ freq: f, dur: 0.16, desde: i * 0.1, vol: 0.22 })),
  fallo:    () => [392, 311, 233].forEach((f, i) => tono({ freq: f, dur: 0.26, tipo: 'sawtooth', desde: i * 0.14, vol: 0.2 })),
  redoble:  () => { for (let i = 0; i < 26; i++) ruido({ dur: 0.05, vol: 0.06 + i * 0.004, desde: i * 0.07 }); tono({ freq: 880, dur: 0.5, desde: 1.9, vol: 0.25 }); },
  revelar:  () => { tono({ freq: 392, dur: 0.5, tipo: 'triangle', vol: 0.2 }); tono({ freq: 587, dur: 0.6, desde: 0.1, vol: 0.2 }); },
  fanfarria:() => [523, 523, 659, 784, 1046].forEach((f, i) => tono({ freq: f, dur: 0.22, desde: i * 0.13, vol: 0.25 }))
};

/* ---------- aura del narrador ----------
   La voz del navegador no se puede filtrar ni reverberar: la Web Speech API no
   deja enrutar su salida al Web Audio API. Lo que sí se puede es poner algo
   DEBAJO de la voz mientras habla: un sub-bajo y un siseo muy suave que le dan
   peso y presencia. Es el truco que hace que una voz plana suene a sala grande. */
let aura = null;

export function auraEncender() {
  if (!ctx || silenciado || aura) return;
  const salida = ctx.createGain();
  salida.gain.setValueAtTime(0.0001, ctx.currentTime);
  salida.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.6);
  salida.connect(ganancia);

  // Sub-bajo con un batido lento: la sensación de que algo grande respira.
  const sub = ctx.createOscillator();
  const sub2 = ctx.createOscillator();
  sub.type = 'sine'; sub.frequency.value = 55;
  sub2.type = 'sine'; sub2.frequency.value = 55.7;   // batido de 0.7 Hz
  const gSub = ctx.createGain(); gSub.gain.value = 0.5;
  sub.connect(gSub); sub2.connect(gSub); gSub.connect(salida);

  // Siseo filtrado muy bajo, para que el silencio entre frases no esté muerto.
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = (Math.random() * 2 - 1) * 0.5;
  const siseo = ctx.createBufferSource();
  siseo.buffer = buffer; siseo.loop = true;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass'; filtro.frequency.value = 320;
  const gSiseo = ctx.createGain(); gSiseo.gain.value = 0.05;
  siseo.connect(filtro).connect(gSiseo).connect(salida);

  sub.start(); sub2.start(); siseo.start();
  aura = { salida, fuentes: [sub, sub2, siseo] };
}

export function auraApagar() {
  if (!aura) return;
  const { salida, fuentes } = aura;
  aura = null;
  salida.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
  setTimeout(() => fuentes.forEach((f) => { try { f.stop(); } catch {} }), 1000);
}

/** Golpe seco para marcar el paso de una lámina de la explicación. */
export function golpe() {
  tono({ freq: 70, dur: 0.5, tipo: 'sine', vol: 0.3, barrido: 38 });
  ruido({ dur: 0.18, vol: 0.06 });
}

/** Música de fondo: dos osciladores suaves y lentos, sin melodía que distraiga. */
export function ambienteEncender() {
  if (!ctx || ambiente) return;
  ambiente = ctx.createGain();
  ambiente.gain.value = 0.045;
  ambiente.connect(ganancia);
  for (const [freq, detune] of [[110, 0], [164.81, 4], [220, -6]]) {
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq; osc.detune.value = detune;
    lfo.frequency.value = 0.07 + Math.random() * 0.06; lfoG.gain.value = 0.02;
    lfo.connect(lfoG).connect(ambiente.gain);
    osc.connect(ambiente);
    osc.start(); lfo.start();
  }
}
/** Agacha la música de fondo mientras alguien habla. Claridad antes que atmósfera. */
export function ambienteAgachar(agachado) {
  if (!ambiente || !ctx) return;
  const objetivo = agachado ? 0.012 : 0.045;
  ambiente.gain.cancelScheduledValues(ctx.currentTime);
  ambiente.gain.setTargetAtTime(objetivo, ctx.currentTime, agachado ? 0.08 : 0.5);
}

export function ambienteApagar() {
  if (!ambiente) return;
  ambiente.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
  ambiente = null;
}
