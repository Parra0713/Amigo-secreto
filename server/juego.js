// Orquestador: tiene el estado vivo, aplica acciones por el motor y reparte vistas.
// Toda salida hacia clientes pasa por proyección. Toda entrada se valida aquí.

import { readFileSync } from 'node:fs';
import { crearAzar } from '../engine/azar.js';
import {
  crearPartida, agregarJugador, guardarRespuestas, guardarPareja, guardarTarjetasManuales,
  registroCompletoDe, puedeEmpezar, aplicar, avanzar, expirar, vistaPara, vistaPublica, vistaAdmin
} from '../engine/index.js';
import { crearNarrador } from './narrador.js';
import { crearReloj } from './reloj.js';
import { hashPin, nuevoPin, pinCorrecto } from './sesiones.js';

const leerJson = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), 'utf8'));

/** Quita HTML y recorta: todo texto de usuario pasa por aquí. */
export function limpiarTexto(valor, max = 200) {
  return String(valor ?? '')
    .replace(/[<>&"']/g, (c) => ({ '<': '', '>': '', '&': 'y', '"': '', "'": '' }[c]))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function crearJuego({ repositorio, log = console }) {
  const config = leerJson('../config/reglas.json');
  const cuestionario = leerJson('../config/cuestionario.json');
  const textosNarrador = leerJson('../config/narrador.json');
  const groserias = (config.moderacion.filtroGroseriasActivo ? leerJson('../config/groserias.json').palabras : []);

  const clientes = new Set();           // { enviar(msg), rol, jugadorId }
  const pines = new Map();              // pin -> jugadorId (solo en memoria)
  let automatico = config.automatico?.activo ?? true;
  let temporizadorAuto = null;          // un solo temporizador, siempre cancelable

  let estado = repositorio.cargarSnapshot() || crearPartida({ config, cuestionario, semilla: `plan-${Date.now()}` });
  if (!estado.cuestionario) estado = { ...estado, cuestionario, config };

  const azar = crearAzar(`${estado.semilla}:narrador`);
  const narrar = crearNarrador(textosNarrador, azar);

  const reloj = crearReloj({
    alExpirar: () => { aplicarEfectos(expirar(estado)); },
    alTick: (restante) => {
      emitirPublico({ cuentaRegresiva: restante });
      if (restante === config.tiempos.avisoFinalSegundos) contar('cuenta_regresiva', { segundos: restante });
    }
  });

  // ---------- piloto automático ----------
  /* El juego se mueve solo: cuando todos terminan una ronda, pasa a la siguiente;
     en la revelación destapa una pareja cada tantos segundos; y en el registro
     arranca cuando todos están listos. Cualquier acción del grupier en /admin
     cancela el temporizador, así que intervenir siempre gana. */

  const cancelarAuto = () => { if (temporizadorAuto) clearTimeout(temporizadorAuto); temporizadorAuto = null; };

  function programar(segundos, accion) {
    cancelarAuto();
    if (!automatico || !segundos) return;
    temporizadorAuto = setTimeout(() => { temporizadorAuto = null; try { accion(); } catch (e) { log.warn?.(`auto: ${e.message}`); } }, segundos * 1000);
    emitirPublico();
  }

  function decidirSiguientePaso({ rondaTerminada = false } = {}) {
    if (!automatico) return;
    const auto = config.automatico || {};

    if (estado.fase === 'registro') {
      if (auto.iniciarAlEstarTodosListos && puedeEmpezar(estado)) {
        programar(auto.segundosAntesDeIniciar, () => api.iniciarPartida());
      } else cancelarAuto();
      return;
    }
    if (estado.fase === 'revelacion') {
      programar(auto.segundosEntreRevelaciones, () => api.revelarSiguiente());
      return;
    }
    if (estado.fase === 'fin') { cancelarAuto(); return; }
    if (rondaTerminada) programar(auto.pausaEntreRondas, () => api.siguienteRonda());
  }

  // ---------- salida ----------

  function emitir(cliente) {
    if (cliente.rol === 'play' && cliente.jugadorId) {
      const vista = vistaPara(estado, cliente.jugadorId);
      if (vista) cliente.enviar({ t: 'vista', vista, cuentaRegresiva: reloj.restante() });
    } else if (cliente.rol === 'admin') {
      cliente.enviar({ t: 'publico', ...vistaAdmin(estado), ...estadoAuto(), cuentaRegresiva: reloj.restante() });
    } else {
      cliente.enviar({ t: 'publico', ...vistaPublica(estado), ...estadoAuto(), cuentaRegresiva: reloj.restante() });
    }
  }

  const emitirTodo = () => clientes.forEach(emitir);
  const estadoAuto = () => ({ automatico, autoPendiente: Boolean(temporizadorAuto) });
  const emitirPublico = (extra = {}) => clientes.forEach((c) => {
    if (c.rol !== 'play') c.enviar({ t: 'publico', ...(c.rol === 'admin' ? vistaAdmin(estado) : vistaPublica(estado)), ...estadoAuto(), ...extra });
  });

  function contar(evento, variables) {
    const frase = narrar(evento, variables);
    if (!frase) return;
    clientes.forEach((c) => c.enviar({ t: 'narrador', ...frase, voz: c.rol === 'tv' }));
    repositorio.anexarEvento({ tipo: 'narrador', evento });
  }

  /** Ejecuta los efectos que devuelve el motor. Los efectos son datos, no llamadas. */
  function aplicarEfectos({ estado: nuevo, efectos }) {
    estado = nuevo;
    let rondaTerminada = false;
    for (const efecto of efectos) {
      switch (efecto.tipo) {
        case 'narrar': contar(efecto.evento, efecto); break;
        case 'confeti': case 'redoble': case 'fichas': case 'revelacion':
          clientes.forEach((c) => { if (c.rol !== 'play') c.enviar({ t: 'efecto', ...efecto }); });
          break;
        case 'finRonda': reloj.detener(); rondaTerminada = true; break;
        default: break;
      }
    }
    repositorio.guardarSnapshot(estado);
    emitirTodo();
    decidirSiguientePaso({ rondaTerminada });
    return estado;
  }

  function iniciarRelojDeFase() {
    const segundos = config.tiempos[`${estado.fase}Segundos`];
    if (segundos) reloj.iniciar(segundos);
  }

  // ---------- entrada ----------

  const api = {
    get estado() { return estado; },
    get config() { return config; },
    /** Guion de la presentación y ajustes de voz, para la TV. */
    explicacionPublica: () => ({
      pasos: textosNarrador.explicacion?.pasos ?? [],
      voces: textosNarrador.voces ?? {}
    }),

    configVoz: textosNarrador.voces ?? {},

    /** Todas las frases fijas del narrador, para generarlas antes de jugar. */
    frasesParaPrecalentar() {
      const frases = [];
      for (const opciones of Object.values(textosNarrador.eventos || {})) {
        for (const texto of opciones) {
          // Las frases con variables se generan en vivo; las fijas se precalientan.
          if (!/\{[a-zA-Z]+\}/.test(texto)) frases.push({ texto, personaje: 'grupier' });
        }
      }
      for (const paso of textosNarrador.explicacion?.pasos || []) {
        frases.push({ texto: paso.texto, personaje: paso.voz || 'explicador' });
      }
      return frases;
    },

    cuestionarioPublico: () => ({
      preguntas: cuestionario.preguntas.map((p) => ({
        id: p.id, texto: p.texto, tipo: p.tipo, opciones: p.opciones || null,
        dirigidaAlReceptor: Boolean(p.dirigidaAlReceptor)
      })),
      minimo: config.cuestionario.minimoRespuestas
    }),

    conectar(cliente) { clientes.add(cliente); emitir(cliente); },
    desconectar(cliente) {
      clientes.delete(cliente);
      if (cliente.jugadorId && estado.jugadores[cliente.jugadorId]) {
        const sigueOtro = [...clientes].some((c) => c.jugadorId === cliente.jugadorId);
        if (!sigueOtro) {
          estado = { ...estado, jugadores: { ...estado.jugadores, [cliente.jugadorId]: { ...estado.jugadores[cliente.jugadorId], conectado: false } } };
          emitirPublico();
        }
      }
    },

    /** Registro de un jugador nuevo. Devuelve su PIN UNA sola vez. */
    registrar({ apodo, avatar }) {
      const apodoLimpio = limpiarTexto(apodo, 20) || 'Anónimo';
      if (contieneGroseria(apodoLimpio)) throw new Error('APODO_NO_PERMITIDO');
      if (Object.values(estado.jugadores).some((j) => j.apodo.toLowerCase() === apodoLimpio.toLowerCase())) {
        throw new Error('APODO_REPETIDO');
      }
      const id = `j${Object.keys(estado.jugadores).length}-${Math.random().toString(36).slice(2, 6)}`;
      const pin = nuevoPin(new Set(pines.keys()));
      estado = agregarJugador(estado, { id, apodo: apodoLimpio, avatar: limpiarTexto(avatar, 4) || '🎁', pinHash: hashPin(pin) });
      pines.set(pin, id);
      repositorio.guardarSnapshot(estado);
      emitirPublico();
      decidirSiguientePaso();      // entró alguien nuevo: se reevalúa el arranque
      return { id, pin, apodo: apodoLimpio };
    },

    /**
     * Resultado: {jugador} si entra, {expirada:true} si ese jugador ya no existe
     * (pasa al archivar la partida y empezar una nueva), o null si el PIN está mal.
     * La distinción importa: una sesión vencida no es un intento fallido y no debe
     * contar contra el límite de intentos ni asustar al jugador con "PIN incorrecto".
     */
    autenticar({ jugadorId, pin }) {
      const jugador = estado.jugadores[jugadorId];
      if (!jugador) return { expirada: true };
      if (!pinCorrecto(pin, jugador.pinHash)) return null;
      estado = { ...estado, jugadores: { ...estado.jugadores, [jugadorId]: { ...jugador, conectado: true } } };
      return { jugador };
    },

    /** Acciones de registro (cuestionario, pareja, tarjetas propias). */
    accionRegistro(jugadorId, mensaje) {
      if (mensaje.t === 'registro.cuestionario') {
        const limpias = {};
        for (const [k, v] of Object.entries(mensaje.respuestas || {})) {
          if (!cuestionario.preguntas.some((p) => p.id === k)) continue;
          const texto = limpiarTexto(v, config.cuestionario.maxLargoTextoLibre);
          if (texto && !contieneGroseria(texto)) limpias[k] = texto;
        }
        if (Object.keys(limpias).length < config.cuestionario.minimoRespuestas) throw new Error('FALTAN_RESPUESTAS');
        estado = guardarRespuestas(estado, jugadorId, limpias);
      } else if (mensaje.t === 'registro.pareja') {
        estado = guardarPareja(estado, jugadorId, mensaje.receptorId);
      } else if (mensaje.t === 'registro.tarjetas') {
        const limpias = {};
        for (const nivel of ['facil', 'media', 'dificil']) {
          const texto = limpiarTexto(mensaje[nivel], 200);
          if (texto && !contieneGroseria(texto)) limpias[nivel] = texto;
        }
        estado = guardarTarjetasManuales(estado, jugadorId, limpias);
      } else throw new Error('ACCION_DESCONOCIDA');

      estado = { ...estado, jugadores: { ...estado.jugadores, [jugadorId]: { ...estado.jugadores[jugadorId], registroCompleto: registroCompletoDe(estado, jugadorId) } } };
      repositorio.guardarSnapshot(estado);
      emitirTodo();
      if (!puedeEmpezar(estado)) contar('registro_falta_gente');
      decidirSiguientePaso();
    },

    accionJuego(jugadorId, mensaje) {
      try {
        aplicarEfectos(aplicar(estado, { ...mensaje, jugadorId }));
      } catch (e) {
        // "Ya terminé" y "no pongo trampa" son avisos, no jugadas: si llegan
        // justo cuando la ronda acaba de cerrarse, se ignoran en silencio en
        // vez de mostrarle un error al jugador por algo que no hizo mal.
        const esAviso = mensaje.t === 'ronda1.listo' || mensaje.t === 'ronda2.pasar';
        if (esAviso && e.message === 'FASE_INCORRECTA') return;
        throw e;
      }
      repositorio.anexarEvento({ tipo: mensaje.t, jugadorId });
    },

    // ---------- control del anfitrión ----------
    iniciarPartida() {
      cancelarAuto();
      if (estado.fase !== 'registro') throw new Error('YA_INICIADA');
      const minimo = config.minimoJugadores ?? 2;
      if (Object.keys(estado.jugadores).length < minimo) throw new Error('FALTAN_JUGADORES');
      contar('bienvenida');
      aplicarEfectos(avanzar(estado));
      iniciarRelojDeFase();
    },
    siguienteRonda() { cancelarAuto(); aplicarEfectos(avanzar(estado)); iniciarRelojDeFase(); },
    pausar() { cancelarAuto(); reloj.detener(); emitirPublico({ pausada: true }); },
    reanudar() { iniciarRelojDeFase(); decidirSiguientePaso(); },
    revelarSiguiente() { cancelarAuto(); aplicarEfectos(aplicar(estado, { t: 'revelar.siguiente' })); },

    /** El grupier puede apagar el piloto automático y manejar todo a mano. */
    alternarAutomatico() {
      automatico = !automatico;
      if (!automatico) cancelarAuto(); else decidirSiguientePaso();
      emitirPublico();
      return automatico;
    },
    nuevaPartida() {
      cancelarAuto();
      reloj.detener();
      repositorio.archivar();
      pines.clear();
      estado = crearPartida({ config, cuestionario, semilla: `plan-${Date.now()}` });
      repositorio.guardarSnapshot(estado);
      // Se avisa a los celulares conectados para que borren su sesión y vuelvan
      // a registrarse, en vez de quedarse reintentando con un PIN que ya no existe.
      for (const cliente of clientes) {
        if (cliente.rol !== 'play') continue;
        cliente.enviar({ t: 'reiniciada' });
        cliente.jugadorId = null;
      }
      emitirTodo();
    },
    abrirRegistro() { contar('registro_abierto'); },

    /** Lanza la presentación en todas las pantallas de TV. */
    explicar() {
      clientes.forEach((c) => { if (c.rol !== 'play') c.enviar({ t: 'explicar' }); });
      clientes.forEach((c) => { if (c.rol === 'play') c.enviar({ t: 'narrador', evento: 'explicacion', texto: 'Mira la TV: el grupier está explicando el juego.' }); });
      repositorio.anexarEvento({ tipo: 'explicacion' });
    }
  };

  function contieneGroseria(texto) {
    const t = texto.toLowerCase();
    return groserias.some((p) => t.includes(p));
  }

  log.info?.(`Partida ${estado.id} en fase ${estado.fase} con ${Object.keys(estado.jugadores).length} jugadores`);
  // Si el servidor se reinició a mitad de partida, el piloto automático retoma.
  setTimeout(() => decidirSiguientePaso(), 1500);
  return api;
}
