/* ============================================================
   Voz del narrador — el grupier.

   Lo que se puede y lo que no, en este caso concreto:
   · Las voces "Natural" de Microsoft son neuronales pero viven en la nube y
     solo las expone Edge, así que en una noche sin internet no existen.
   · Chrome en Windows ve únicamente las voces SAPI instaladas en el sistema
     (Sabina, Raúl, Helena, Pablo, Laura). Son las que hay.
   · La Web Speech API no acepta SSML y no se puede enrutar su salida al
     Web Audio API, así que no hay reverberación ni filtros sobre la voz.

   Conclusión: la naturalidad y el carácter no salen de la voz, salen de CÓMO
   se la hace hablar. Eso es lo que hace este módulo:
     1. escoge la mejor voz disponible para el personaje (grave, masculina, es-*);
     2. baja el tono y el ritmo hasta un registro oscuro pero inteligible;
     3. parte el texto en frases y las dice una por una con pausas reales,
        que es lo que más ayuda a que un sintetizador no suene a robot;
     4. avisa cuándo empieza y termina cada frase, para animar al personaje
        y para que el audio ambiente le ponga el peso que la voz no puede.
   ============================================================ */

/* Dos personajes con voz distinta:
     · grupier     — grave y lento, el que juega con la familia.
     · explicador  — claro y neutro, el que explica reglas y da instrucciones.
   Si el PC tiene dos voces en español, cada personaje se queda con una y no se
   pisan. Si solo hay una, el explicador la usa con otro tono y otro ritmo, que
   igual los distingue. */

const PERFILES_POR_DEFECTO = {
  grupier: {
    rate: 0.88, pitch: 0.55, volume: 1,
    pausaFrase: 220, pausaPunto: 420,
    idiomas: ['es-CO', 'es-MX', 'es-ES', 'es'],
    // Voces graves primero: es un grupier, no una recepcionista.
    preferidas: ['raul', 'pablo', 'jorge', 'diego', 'carlos']
  },
  explicador: {
    rate: 1, pitch: 1.05, volume: 1,
    pausaFrase: 160, pausaPunto: 320,
    idiomas: ['es-CO', 'es-MX', 'es-ES', 'es'],
    // Voces claras: tiene que entenderse de una, incluso con ruido en la sala.
    preferidas: ['sabina', 'dalia', 'helena', 'laura', 'elvira', 'paulina']
  }
};

let perfiles = structuredClone(PERFILES_POR_DEFECTO);
let voces = {};                 // personaje -> SpeechSynthesisVoice
let activa = true;
let suscrito = false;
let ganchos = { alEmpezarFrase: null, alTerminar: null, alNivel: null };
let cola = [];
let hablando = false;
let personajeActual = 'grupier';
let reproductorNeural = null;      // si existe, manda sobre speechSynthesis

/** Puntaje de una voz para un perfil. Mayor es mejor. */
function puntuar(v, config, evitar) {
  const lang = (v.lang || '').toLowerCase().replace('_', '-');
  const idioma = config.idiomas.findIndex((p) => lang.startsWith(p.toLowerCase()));
  if (idioma === -1) return -1;                       // no es español: descartada

  let puntos = 1000 - idioma * 100;                   // es-CO > es-MX > es-ES > es-*
  if (v.localService) puntos += 400;                  // sin internet es un requisito
  const nombre = (v.name || '').toLowerCase();
  const preferida = config.preferidas.findIndex((n) => nombre.includes(n));
  if (preferida !== -1) puntos += 120 - preferida * 10;
  if (/natural|neural/.test(nombre)) puntos += 60;    // si existe local, mejor timbre
  if (/online/.test(nombre)) puntos -= 500;           // depende de internet: casi nunca
  if (evitar?.includes(v.name)) puntos -= 300;        // que los dos no suenen igual
  return puntos;
}

function elegirVoz(personaje, evitar = []) {
  const disponibles = speechSynthesis.getVoices();
  if (!disponibles.length) return null;
  const config = perfiles[personaje] || perfiles.grupier;

  // Si el anfitrión escogió una voz a mano en tools/voces.html, manda esa para el grupier.
  try {
    const guardada = localStorage.getItem(personaje === 'grupier' ? 'plan.voz' : 'plan.voz.explicador');
    if (guardada) {
      const exacta = disponibles.find((v) => v.name === guardada);
      if (exacta) return exacta;
    }
  } catch {}

  const candidatas = disponibles
    .map((v) => ({ v, p: puntuar(v, config, evitar) }))
    .filter((x) => x.p >= 0)
    .sort((a, b) => b.p - a.p);
  return candidatas[0]?.v || null;
}

/** Reparte las voces disponibles entre los personajes, sin repetir si se puede. */
function repartirVoces() {
  voces.grupier = elegirVoz('grupier');
  voces.explicador = elegirVoz('explicador', voces.grupier ? [voces.grupier.name] : []);
  // Si no hay segunda voz, comparten timbre pero no prosodia.
  if (!voces.explicador) voces.explicador = voces.grupier;
}

export function iniciarVoz(opciones = {}) {
  configurarVoz(opciones);
  if (!('speechSynthesis' in window)) return { disponible: false, grupier: null, explicador: null };
  if (!suscrito) {
    // La lista de voces llega asíncrona en Chrome: hay que esperar el evento.
    speechSynthesis.onvoiceschanged = repartirVoces;
    suscrito = true;
  }
  repartirVoces();
  return {
    disponible: Boolean(voces.grupier),
    nombre: voces.grupier?.name || null,
    local: Boolean(voces.grupier?.localService),
    lang: voces.grupier?.lang || null,
    grupier: voces.grupier?.name || null,
    explicador: voces.explicador?.name || null,
    dosVoces: Boolean(voces.grupier && voces.explicador && voces.grupier.name !== voces.explicador.name)
  };
}

/** Acepta {grupier:{...}, explicador:{...}} y también un perfil suelto (compatibilidad). */
export function configurarVoz(opciones = {}) {
  if (opciones.grupier || opciones.explicador) {
    for (const personaje of ['grupier', 'explicador']) {
      perfiles[personaje] = { ...perfiles[personaje], ...(opciones[personaje] || {}) };
    }
  } else if (Object.keys(opciones).length) {
    perfiles.grupier = { ...perfiles.grupier, ...opciones };
  }
}
export function alHablar(nuevos) { ganchos = { ...ganchos, ...nuevos }; }

/**
 * Enchufa la voz neuronal del servidor. Mientras esté puesta, se usa ella;
 * si una frase falla o no está, esa frase cae sola a la voz del navegador.
 */
export function usarVozNeural(reproductor) { reproductorNeural = reproductor; }
export const hayVozNeural = () => Boolean(reproductorNeural);

export function silenciarVoz(valor) {
  activa = !valor;
  if (valor) {
    cola = []; hablando = false;
    reproductorNeural?.cancelar();
    speechSynthesis?.cancel?.();
  }
}

export const vozDisponible = () => Boolean(voces.grupier);
export const vozActual = (personaje = 'grupier') => {
  const v = voces[personaje];
  return v ? { nombre: v.name, lang: v.lang, local: v.localService } : null;
};

/**
 * Parte el texto en frases habladas. Un sintetizador suena mucho mejor
 * diciendo tramos cortos con pausas de verdad que una frase larga de corrido.
 */
export function trocear(texto, personaje = 'grupier') {
  const config = perfiles[personaje] || perfiles.grupier;
  return String(texto)
    .replace(/…/g, '...')
    .split(/(?<=[.!?:;,])\s+|(?<=\.\.\.)\s*/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({ texto: t, pausa: /[.!?]$|\.\.\.$/.test(t) ? config.pausaPunto : config.pausaFrase }));
}

function siguiente() {
  if (!cola.length) {
    hablando = false;
    ganchos.alTerminar?.();
    return;
  }
  const trozo = cola.shift();
  const config = perfiles[trozo.personaje] || perfiles.grupier;
  const voz = voces[trozo.personaje] || voces.grupier;
  const frase = new SpeechSynthesisUtterance(trozo.texto);
  frase.voice = voz;
  frase.lang = voz.lang;
  frase.rate = config.rate;
  frase.pitch = config.pitch;
  frase.volume = config.volume;

  frase.onstart = () => ganchos.alEmpezarFrase?.(trozo.texto);   // la voz del navegador no sabe cuánto dura
  frase.onend = () => setTimeout(siguiente, trozo.pausa);
  frase.onerror = () => setTimeout(siguiente, 60);
  speechSynthesis.speak(frase);
}

/**
 * Dice un texto con la voz de un personaje ('grupier' o 'explicador').
 * Si no hay voz en español, no dice nada: el texto en pantalla manda.
 */
export function decir(texto, { interrumpir = true, personaje = 'grupier' } = {}) {
  if (!activa || !texto) return false;
  personajeActual = personaje;

  // Camino bueno: audio neuronal generado por el servidor, con efectos reales
  // y boca sincronizada por amplitud.
  if (reproductorNeural) {
    if (interrumpir) { reproductorNeural.cancelar(); speechSynthesis?.cancel?.(); cola = []; }
    hablando = true;
    reproductorNeural
      .reproducir(texto, personaje, {
        alEmpezar: (duracion) => ganchos.alEmpezarFrase?.(texto, duracion),
        alNivel: (n) => ganchos.alNivel?.(n),
        alTerminar: () => { hablando = false; ganchos.alTerminar?.(); }
      })
      // false = no había audio. 'cancelado' = lo cortó otra frase, y entonces
      // no hay que repetirlo con la voz del navegador.
      .then((sonó) => { if (sonó === false) decirConNavegador(texto, { interrumpir: false, personaje }); })
      .catch(() => decirConNavegador(texto, { interrumpir: false, personaje }));
    return true;
  }

  return decirConNavegador(texto, { interrumpir, personaje });
}

/** Camino de respaldo: la voz del sistema, troceada por frases. */
function decirConNavegador(texto, { interrumpir = true, personaje = 'grupier' } = {}) {
  if (!('speechSynthesis' in window)) return false;
  if (!voces.grupier) repartirVoces();
  if (!voces[personaje] && !voces.grupier) return false;

  if (interrumpir) { speechSynthesis.cancel(); cola = []; }
  cola.push(...trocear(texto, personaje).map((t) => ({ ...t, personaje })));
  if (!hablando) { hablando = true; siguiente(); }
  return true;
}

export const personajeHablando = () => personajeActual;

/** Duración aproximada en ms, para sincronizar animaciones sin esperar la voz. */
export const duracionEstimada = (texto, personaje = 'grupier') =>
  Math.max(1200, (String(texto).split(/\s+/).length / (2.6 * (perfiles[personaje] || perfiles.grupier).rate)) * 1000);
