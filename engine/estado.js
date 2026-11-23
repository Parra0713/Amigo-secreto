// Creación y mutaciones básicas del estado. Todo es inmutable: se devuelve un estado nuevo.

import { crearAzar } from './azar.js';
import { generarMontones } from './pistas/generador.js';

export const FASES = ['registro', 'ronda1', 'ronda2', 'ronda3', 'ronda4', 'revelacion', 'fin'];

export function crearPartida({ config, cuestionario, semilla = 'plan-2026' }) {
  return {
    id: `partida-${semilla}`,
    version: 1,
    semilla,
    fase: 'registro',
    config,
    cuestionario,
    jugadores: {},
    parejas: {},            // SECRETO: dadorId -> receptorId
    respuestas: {},         // SECRETO
    tarjetasManuales: {},
    montones: {},
    gastos: {},
    compras: {},
    trampasPuestas: {},
    listos: {},             // por ronda: jugadorId -> true cuando ya terminó
    dilema: null,
    apuestas: {},
    resumenAdmin: {},
    revelacion: { orden: [], indice: 0 },
    eventos: []
  };
}

export function agregarJugador(estado, { id, apodo, avatar, pinHash }) {
  if (estado.fase !== 'registro') throw new Error('FASE_INCORRECTA');
  if (estado.jugadores[id]) throw new Error('JUGADOR_DUPLICADO');
  return {
    ...estado,
    jugadores: { ...estado.jugadores, [id]: { id, apodo, avatar, pinHash, fichas: estado.config.fichasIniciales, conectado: true, registroCompleto: false } },
    gastos: { ...estado.gastos, [id]: 0 }
  };
}

export function guardarRespuestas(estado, jugadorId, respuestas) {
  if (estado.fase !== 'registro') throw new Error('FASE_INCORRECTA');
  const limpias = {};
  for (const [k, v] of Object.entries(respuestas)) {
    if (v === null || v === undefined || String(v).trim() === '') continue;
    limpias[k] = String(v).slice(0, estado.config.cuestionario.maxLargoTextoLibre);
  }
  return { ...estado, respuestas: { ...estado.respuestas, [jugadorId]: limpias } };
}

export function guardarPareja(estado, dadorId, receptorId) {
  if (estado.fase !== 'registro') throw new Error('FASE_INCORRECTA');
  if (dadorId === receptorId) throw new Error('PAREJA_INVALIDA');
  if (!estado.jugadores[receptorId]) throw new Error('PAREJA_INVALIDA');
  return { ...estado, parejas: { ...estado.parejas, [dadorId]: receptorId } };
}

export function guardarTarjetasManuales(estado, jugadorId, tarjetas) {
  const limpias = {};
  for (const nivel of ['facil', 'media', 'dificil']) {
    const t = tarjetas[nivel];
    if (t && String(t).trim()) limpias[nivel] = String(t).trim().slice(0, 200);
  }
  return { ...estado, tarjetasManuales: { ...estado.tarjetasManuales, [jugadorId]: limpias } };
}

export function registroCompletoDe(estado, jugadorId) {
  const minimo = estado.config.cuestionario.minimoRespuestas;
  const respuestas = Object.keys(estado.respuestas[jugadorId] || {}).length;
  return respuestas >= minimo && Boolean(estado.parejas[jugadorId]);
}

export function puedeEmpezar(estado) {
  const ids = Object.keys(estado.jugadores);
  const minimo = estado.config.minimoJugadores ?? 2;
  return ids.length >= minimo && ids.every((id) => registroCompletoDe(estado, id));
}

/** Cierra el registro: genera todos los montones y deja la partida lista. */
export function prepararPartida(estado) {
  const azar = crearAzar(`${estado.semilla}:montones`);
  const { montones, resumen } = generarMontones(estado, azar);
  const jugadores = { ...estado.jugadores };
  for (const id of Object.keys(jugadores)) {
    jugadores[id] = { ...jugadores[id], registroCompleto: registroCompletoDe(estado, id) };
  }
  return { ...estado, jugadores, montones, resumenAdmin: resumen };
}

/** Marca a un jugador como listo en la ronda actual. */
export function marcarListo(estado, jugadorId) {
  return { ...estado, listos: { ...estado.listos, [jugadorId]: true } };
}

/** ¿Todos los jugadores conectados (o no) ya terminaron esta ronda? */
export function todosListos(estado) {
  const ids = Object.keys(estado.jugadores);
  return ids.length > 0 && ids.every((id) => estado.listos[id]);
}

export const anotar = (estado, tipo, payload = {}) => ({
  ...estado,
  eventos: [...estado.eventos, { n: estado.eventos.length + 1, tipo, payload }]
});
