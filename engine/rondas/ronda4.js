// Ronda 4 — Apuesta final + bono fantasma.
import { mover } from '../fichas.js';

export default {
  id: 'ronda4',
  nombre: 'Apuesta final',

  start(estado) {
    return { estado: { ...estado, fase: 'ronda4', listos: {}, apuestas: {} }, efectos: [{ tipo: 'narrar', evento: 'inicio_ronda4' }] };
  },

  handleAction(estado, accion) {
    if (accion.t !== 'ronda4.apostar') throw new Error('ACCION_DESCONOCIDA');
    const { jugadorId, sospechosoId, monto } = accion;
    const r = estado.config.ronda4;
    const fichas = estado.jugadores[jugadorId].fichas;

    if (!estado.jugadores[sospechosoId] || sospechosoId === jugadorId) throw new Error('SOSPECHOSO_INVALIDO');
    if (!Number.isInteger(monto) || monto < r.montoMinimo || monto > fichas) throw new Error('APUESTA_INVALIDA');

    const estado2 = { ...estado, apuestas: { ...estado.apuestas, [jugadorId]: { sospechosoId, monto } } };
    const listos = Object.keys(estado2.jugadores).every((id) => estado2.apuestas[id]);
    return listos ? this.end(estado2) : { estado: estado2, efectos: [] };
  },

  onTimeout(estado) { return this.end(estado); },

  /** Resuelve apuestas. El amigo secreto de X es quien le regala a X. */
  end(estado) {
    if (estado.resueltaRonda4) return { estado, efectos: [{ tipo: 'finRonda', ronda: 'ronda4' }] };
    const r = estado.config.ronda4;
    let actual = estado;
    const resultados = {};
    const efectos = [{ tipo: 'narrar', evento: 'apuestas_bloqueadas' }];

    for (const jugadorId of Object.keys(estado.jugadores)) {
      const apuesta = estado.apuestas[jugadorId];
      const amigoSecretoId = Object.keys(estado.parejas).find((d) => estado.parejas[d] === jugadorId);
      if (!apuesta) { resultados[jugadorId] = { acerto: false, monto: 0, sinApostar: true }; continue; }

      const acerto = apuesta.sospechosoId === amigoSecretoId;
      resultados[jugadorId] = { acerto, monto: apuesta.monto, sospechosoId: apuesta.sospechosoId };

      if (acerto) {
        actual = mover(actual, jugadorId, apuesta.monto * (r.multiplicadorAcierto - 1), 'apuesta_ganada').estado;
        efectos.push({ tipo: 'narrar', evento: 'acierto', apodo: estado.jugadores[jugadorId].apodo });
      } else {
        actual = mover(actual, jugadorId, -apuesta.monto, 'apuesta_perdida').estado;
        efectos.push({ tipo: 'narrar', evento: 'fallo', apodo: estado.jugadores[jugadorId].apodo });
        // Bono fantasma: si el receptor falla, su amigo secreto cobra.
        if (amigoSecretoId && actual.jugadores[amigoSecretoId]) {
          actual = mover(actual, amigoSecretoId, r.bonoFantasma, 'bono_fantasma').estado;
        }
      }
    }
    return { estado: { ...actual, resultadosApuesta: resultados, resueltaRonda4: true }, efectos };
  }
};
