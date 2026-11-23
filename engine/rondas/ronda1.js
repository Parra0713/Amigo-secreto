// Ronda 1 — Compra de pistas. Interfaz común: start / handleAction / onTimeout / end.
import { mover } from '../fichas.js';
import { marcarListo, todosListos } from '../estado.js';

export default {
  id: 'ronda1',
  nombre: 'Compra de pistas',

  start(estado) {
    // Quien no alcanza a comprar ni la pista más barata ya no tiene nada que hacer.
    const barata = Math.min(...Object.values(estado.config.precios));
    const listos = {};
    for (const [id, j] of Object.entries(estado.jugadores)) {
      if (j.fichas < barata) listos[id] = true;
    }
    return {
      estado: { ...estado, fase: 'ronda1', compras: {}, listos },
      efectos: [{ tipo: 'narrar', evento: 'inicio_ronda1' }]
    };
  },

  handleAction(estado, accion) {
    if (accion.t === 'ronda1.listo') {
      const estado2 = marcarListo(estado, accion.jugadorId);
      return todosListos(estado2) ? this.end(estado2) : { estado: estado2, efectos: [] };
    }
    if (accion.t !== 'ronda1.comprar') throw new Error('ACCION_DESCONOCIDA');
    const { jugadorId, tarjetaId } = accion;
    const monton = estado.montones[jugadorId] || [];
    const tarjeta = monton.find((t) => t.id === tarjetaId);
    if (!tarjeta) throw new Error('TARJETA_INVALIDA');
    if (tarjeta.comprada) throw new Error('YA_COMPRADA');

    const precio = estado.config.precios[tarjeta.nivel];
    if (estado.jugadores[jugadorId].fichas < precio) throw new Error('FICHAS_INSUFICIENTES');

    const { estado: e1, efectos } = mover(estado, jugadorId, -precio, 'compra_pista');
    const estado2 = {
      ...e1,
      montones: { ...e1.montones, [jugadorId]: monton.map((t) => (t.id === tarjetaId ? { ...t, comprada: true } : t)) },
      compras: { ...e1.compras, [jugadorId]: [...(e1.compras[jugadorId] || []), tarjetaId] }
    };
    // Si ya no le alcanza para ninguna pista pendiente, queda listo solo.
    const pendientes = estado2.montones[jugadorId].filter((t) => !t.comprada);
    const masBarata = pendientes.length ? Math.min(...pendientes.map((t) => estado2.config.precios[t.nivel])) : 0;
    const sinNadaQueHacer = pendientes.length === 0 || estado2.jugadores[jugadorId].fichas < masBarata;
    const estado3 = sinNadaQueHacer ? marcarListo(estado2, jugadorId) : estado2;

    const salida = { estado: estado3, efectos: [...efectos, { tipo: 'revelarTarjeta', jugadorId, tarjetaId }] };
    if (sinNadaQueHacer && todosListos(estado3)) {
      const fin = this.end(estado3);
      return { estado: fin.estado, efectos: [...salida.efectos, ...fin.efectos] };
    }
    return salida;
  },

  onTimeout(estado) { return this.end(estado); },

  end(estado) { return { estado, efectos: [{ tipo: 'finRonda', ronda: 'ronda1' }] }; }
};
