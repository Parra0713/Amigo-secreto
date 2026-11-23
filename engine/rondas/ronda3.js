// Ronda 3 — Dilema del prisionero por parejas.
import { mover } from '../fichas.js';
import { crearAzar, emparejar } from '../azar.js';

export default {
  id: 'ronda3',
  nombre: 'Dilema',

  start(estado) {
    const azar = crearAzar(`${estado.semilla}:dilema`);
    const { parejas, sobrante } = emparejar(azar, Object.keys(estado.jugadores));
    const estado2 = {
      ...estado,
      fase: 'ronda3', listos: {},
      dilema: { parejas, sobrante, elecciones: {}, pistasRecibidas: {}, resuelto: false }
    };
    return { estado: estado2, efectos: [{ tipo: 'narrar', evento: 'inicio_ronda3' }] };
  },

  handleAction(estado, accion) {
    if (accion.t !== 'ronda3.elegir') throw new Error('ACCION_DESCONOCIDA');
    const { jugadorId, opcion } = accion;
    if (!['cooperar', 'guardar'].includes(opcion)) throw new Error('OPCION_INVALIDA');
    if (!estado.dilema) throw new Error('FASE_INCORRECTA');
    if (estado.dilema.elecciones[jugadorId]) throw new Error('YA_ELIGIO');
    if (!estado.dilema.parejas.some((p) => p.includes(jugadorId))) throw new Error('NO_EMPAREJADO');

    const estado2 = {
      ...estado,
      dilema: { ...estado.dilema, elecciones: { ...estado.dilema.elecciones, [jugadorId]: opcion } }
    };
    const todos = estado2.dilema.parejas.flat();
    const listos = todos.every((id) => estado2.dilema.elecciones[id]);
    return listos ? this.end(estado2) : { estado: estado2, efectos: [] };
  },

  onTimeout(estado) { return this.end(estado); },

  /** Quien no eligió a tiempo cuenta como 'guardar'. */
  end(estado) {
    if (!estado.dilema || estado.dilema.resuelto) return { estado, efectos: [{ tipo: 'finRonda', ronda: 'ronda3' }] };
    const r = estado.config.ronda3;
    let actual = estado;
    const pistasRecibidas = {};

    const pistaFacilDe = (id) => {
      const t = (estado.montones[id] || []).find((x) => x.nivel === 'facil' && x.origen !== 'trampa');
      return t ? t.texto : null;
    };

    for (const [a, b] of estado.dilema.parejas) {
      const ea = estado.dilema.elecciones[a] || 'guardar';
      const eb = estado.dilema.elecciones[b] || 'guardar';
      if (ea === 'cooperar' && eb === 'cooperar') {
        actual = mover(actual, a, r.cooperarCooperar, 'dilema').estado;
        actual = mover(actual, b, r.cooperarCooperar, 'dilema').estado;
        pistasRecibidas[a] = pistaFacilDe(b);
        pistasRecibidas[b] = pistaFacilDe(a);
      } else if (ea === 'cooperar' && eb === 'guardar') {
        actual = mover(actual, b, r.guardarContraCooperar, 'dilema').estado;
        pistasRecibidas[b] = pistaFacilDe(a);
      } else if (ea === 'guardar' && eb === 'cooperar') {
        actual = mover(actual, a, r.guardarContraCooperar, 'dilema').estado;
        pistasRecibidas[a] = pistaFacilDe(b);
      }
    }
    if (estado.dilema.sobrante) actual = mover(actual, estado.dilema.sobrante, r.bonoImpar, 'dilema_impar').estado;

    const estado2 = { ...actual, dilema: { ...estado.dilema, pistasRecibidas, resuelto: true } };
    return { estado: estado2, efectos: [{ tipo: 'finRonda', ronda: 'ronda3' }] };
  }
};
