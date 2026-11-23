// Fachada del motor. El servidor solo habla con este archivo.
// Contrato: (estado, accion) -> { estado, efectos }. Sin I/O, sin reloj, sin red.

import ronda1 from './rondas/ronda1.js';
import ronda2 from './rondas/ronda2.js';
import ronda3 from './rondas/ronda3.js';
import ronda4 from './rondas/ronda4.js';
import { prepararPartida, anotar } from './estado.js';
import { prepararRevelacion, revelarSiguiente } from './cierre.js';

export const RONDAS = { ronda1, ronda2, ronda3, ronda4 };

export * from './estado.js';
export * from './proyeccion.js';
export { marcador } from './fichas.js';
export { clasificar } from './cierre.js';

const siguienteFase = (estado) => {
  const activas = estado.config.rondasActivas;
  const i = activas.indexOf(estado.fase);
  return i === -1 ? activas[0] : activas[i + 1] || 'revelacion';
};

/** Avanza a la siguiente ronda activa (o a la revelación). */
export function avanzar(estado) {
  // Desde la revelación o el fin ya no hay a dónde avanzar: se usa 'revelar.siguiente'.
  if (estado.fase === 'revelacion' || estado.fase === 'fin') return { estado, efectos: [] };

  let actual = estado;
  const efectos = [];

  if (!['registro', 'revelacion', 'fin'].includes(actual.fase)) {
    const ronda = RONDAS[actual.fase];
    const fin = ronda.end(actual);
    actual = fin.estado;
    efectos.push(...fin.efectos);
  } else if (actual.fase === 'registro') {
    actual = prepararPartida(actual);
  }

  const siguiente = siguienteFase(actual);
  if (siguiente === 'revelacion') {
    actual = prepararRevelacion(actual);
    efectos.push({ tipo: 'narrar', evento: 'revelacion_inicio' });
    if (actual.requiereRelampago) efectos.push({ tipo: 'narrar', evento: 'empate' });
  } else {
    const r = RONDAS[siguiente].start(actual);
    actual = r.estado;
    efectos.push(...r.efectos);
  }
  return { estado: anotar(actual, 'avance', { a: actual.fase }), efectos };
}

/** Aplica una acción de jugador. Lanza Error con código si no es válida. */
export function aplicar(estado, accion) {
  if (accion.t === 'revelar.siguiente') return revelarSiguiente(estado);

  const ronda = RONDAS[estado.fase];
  if (!ronda) throw new Error('FASE_INCORRECTA');
  if (!accion.t.startsWith(`${estado.fase}.`)) throw new Error('FASE_INCORRECTA');

  const res = ronda.handleAction(estado, accion);
  return { estado: anotar(res.estado, accion.t, { jugadorId: accion.jugadorId }), efectos: res.efectos };
}

/** Timeout de la ronda actual: la cierra y pasa a la siguiente. */
export function expirar(estado) {
  const ronda = RONDAS[estado.fase];
  if (!ronda) return { estado, efectos: [] };
  const fin = ronda.onTimeout(estado);
  const sig = avanzar(fin.estado);
  return { estado: sig.estado, efectos: [...fin.efectos, ...sig.efectos] };
}
