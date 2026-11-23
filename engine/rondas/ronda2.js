// Ronda 2 — Trampa. Una ficha compra una tarjeta falsa en el montón de otro.
import { mover } from '../fichas.js';
import { generarFalsa } from '../pistas/generador.js';
import { crearAzar } from '../azar.js';
import { marcarListo, todosListos } from '../estado.js';

export default {
  id: 'ronda2',
  nombre: 'Trampa',

  start(estado) {
    // Quien no tiene con qué pagar la trampa no tiene decisión que tomar.
    const listos = {};
    for (const [id, j] of Object.entries(estado.jugadores)) {
      if (j.fichas < estado.config.ronda2.costoTrampa) listos[id] = true;
    }
    return {
      estado: { ...estado, fase: 'ronda2', listos },
      efectos: [{ tipo: 'narrar', evento: 'inicio_ronda2' }]
    };
  },

  handleAction(estado, accion) {
    if (accion.t === 'ronda2.pasar') {
      const estado2 = marcarListo(estado, accion.jugadorId);
      return todosListos(estado2) ? this.end(estado2) : { estado: estado2, efectos: [] };
    }
    if (accion.t !== 'ronda2.trampa') throw new Error('ACCION_DESCONOCIDA');
    const { jugadorId, victimaId, categoria, nivel } = accion;
    const reglas = estado.config.ronda2;

    if (!estado.jugadores[victimaId]) throw new Error('VICTIMA_INVALIDA');
    if (victimaId === jugadorId && !reglas.permitirTrampaPropia) throw new Error('TRAMPA_PROPIA');
    if ((estado.trampasPuestas[jugadorId] || 0) >= reglas.maxTrampasPorJugador) throw new Error('LIMITE_TRAMPAS');

    const monton = estado.montones[victimaId] || [];
    const falsasActuales = monton.filter((t) => t.origen === 'trampa').length;
    if (falsasActuales >= reglas.maxFalsasPorMonton) throw new Error('LIMITE_FALSAS_MONTON');
    if (estado.jugadores[jugadorId].fichas < reglas.costoTrampa) throw new Error('FICHAS_INSUFICIENTES');

    const azar = crearAzar(`${estado.semilla}:trampa:${jugadorId}:${victimaId}:${falsasActuales}`);
    const falsa = generarFalsa(estado, { victimaId, tramposoId: jugadorId, categoria, nivel }, azar);
    if (!falsa) throw new Error('SIN_MATERIAL_PARA_TRAMPA');

    const { estado: e1, efectos } = mover(estado, jugadorId, -reglas.costoTrampa, 'trampa');
    const estado2 = {
      ...e1,
      montones: { ...e1.montones, [victimaId]: [...monton, falsa] },
      trampasPuestas: { ...e1.trampasPuestas, [jugadorId]: (e1.trampasPuestas[jugadorId] || 0) + 1 }
    };
    // Quien ya usó su trampa no tiene más que hacer en esta ronda.
    const estado3 = marcarListo(estado2, jugadorId);
    // Ojo: el efecto NO dice quién la puso ni a quién. El narrador no filtra.
    const efectosSalida = [...efectos, { tipo: 'narrar', evento: 'trampa_colocada' }];
    if (todosListos(estado3)) {
      const fin = this.end(estado3);
      return { estado: fin.estado, efectos: [...efectosSalida, ...fin.efectos] };
    }
    return { estado: estado3, efectos: efectosSalida };
  },

  onTimeout(estado) { return this.end(estado); },
  end(estado) { return { estado, efectos: [{ tipo: 'finRonda', ronda: 'ronda2' }] }; }
};
