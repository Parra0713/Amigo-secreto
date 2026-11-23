// ÚNICO punto por donde salen datos hacia un cliente.
// Lista blanca: se construye un objeto nuevo, nunca se "ocultan" campos de otro.

import { marcador } from './fichas.js';
import { categoriasViables } from './pistas/generador.js';

export function vistaPara(estado, jugadorId) {
  const jugador = estado.jugadores[jugadorId];
  if (!jugador) return null;

  const miMonton = (estado.montones[jugadorId] || []).map((t) => ({
    id: t.id,
    nivel: t.nivel,
    precio: estado.config.precios[t.nivel],
    comprada: Boolean(t.comprada),
    // El texto SOLO viaja si este jugador ya la compró.
    texto: t.comprada ? t.texto : null
  }));

  return {
    yo: { id: jugador.id, apodo: jugador.apodo, avatar: jugador.avatar, fichas: jugador.fichas },
    fase: estado.fase,
    monton: miMonton,
    puedeTrampear: estado.fase === 'ronda2' && !estado.trampasPuestas[jugadorId] && !estado.listos[jugadorId],
    listo: Boolean(estado.listos?.[jugadorId]),
    dilema: dilemaPara(estado, jugadorId),
    miApuesta: estado.apuestas[jugadorId]
      ? { sospechosoId: estado.apuestas[jugadorId].sospechosoId, monto: estado.apuestas[jugadorId].monto }
      : null,
    jugadores: marcador(estado).map((j) => ({ id: j.id, apodo: j.apodo, avatar: j.avatar, fichas: j.fichas })),
    // En la ronda de trampa, solo se ofrecen víctimas y temas con material real.
    objetivos: estado.fase === 'ronda2' && !estado.trampasPuestas[jugadorId]
      ? objetivosDeTrampa(estado, jugadorId)
      : null
  };
}

/** Víctimas posibles con sus temas viables. Sin contenido de respuestas. */
function objetivosDeTrampa(estado, tramposoId) {
  const reglas = estado.config.ronda2;
  return Object.values(estado.jugadores)
    .filter((j) => j.id !== tramposoId || reglas.permitirTrampaPropia)
    .filter((j) => (estado.montones[j.id] || []).filter((t) => t.origen === 'trampa').length < reglas.maxFalsasPorMonton)
    .map((j) => ({ id: j.id, apodo: j.apodo, avatar: j.avatar, categorias: categoriasViables(estado, j.id) }))
    .filter((j) => j.categorias.length > 0);
}

function dilemaPara(estado, jugadorId) {
  if (!estado.dilema) return null;
  const pareja = estado.dilema.parejas.find((p) => p.includes(jugadorId));
  if (!pareja) return { emparejado: false, bonoSobrante: estado.dilema.sobrante === jugadorId };
  const otro = pareja.find((id) => id !== jugadorId);
  const revelado = estado.dilema.resuelto;
  return {
    emparejado: true,
    conApodo: estado.jugadores[otro].apodo,
    miEleccion: estado.dilema.elecciones[jugadorId] || null,
    // La elección del otro solo aparece cuando la ronda ya cerró.
    suEleccion: revelado ? estado.dilema.elecciones[otro] || 'guardar' : null,
    pistaRecibida: revelado ? estado.dilema.pistasRecibidas[jugadorId] || null : null
  };
}

/** Lo que ve la TV: nada secreto, nada de textos de tarjetas. */
export function vistaPublica(estado) {
  return {
    fase: estado.fase,
    marcador: marcador(estado),
    totalJugadores: Object.keys(estado.jugadores).length,
    listos: Object.values(estado.jugadores).filter((j) => j.registroCompleto).length,
    revelacion: estado.fase === 'revelacion' ? estado.revelacion.publico || null : null
  };
}

/** Lo que ve el admin: lo público + conteos ANÓNIMOS. Sin contenido ni parejas. */
export function vistaAdmin(estado) {
  const resumen = Object.entries(estado.resumenAdmin).map(([receptorId, r]) => ({
    apodo: estado.jugadores[receptorId]?.apodo,
    cantidadPistas: r.cantidad,
    completo: r.completo,
    incidencias: r.incidencias
  }));
  return { ...vistaPublica(estado), resumen, montonesIncompletos: resumen.filter((r) => !r.completo).length };
}
