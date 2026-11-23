// Cierre: desempates y orden de revelación (del que tiene menos fichas al ganador).
import { marcador } from './fichas.js';

/**
 * Desempates: 1) acertó la apuesta final, 2) gastó menos fichas en pistas,
 * 3) queda empate real -> apuesta relámpago (la resuelve el anfitrión).
 */
export function clasificar(estado) {
  const resultados = estado.resultadosApuesta || {};
  const lista = marcador(estado).map((j) => ({
    ...j,
    acerto: Boolean(resultados[j.id]?.acerto),
    gastoEnPistas: estado.gastos[j.id] || 0
  }));

  lista.sort((a, b) =>
    b.fichas - a.fichas ||
    Number(b.acerto) - Number(a.acerto) ||
    a.gastoEnPistas - b.gastoEnPistas ||
    0
  );

  const empatados = lista.filter((j) =>
    j.fichas === lista[0].fichas && j.acerto === lista[0].acerto && j.gastoEnPistas === lista[0].gastoEnPistas
  );
  return { clasificacion: lista, requiereRelampago: empatados.length > 1, empatados: empatados.map((j) => j.id) };
}

/** Orden de revelación: de menos fichas a más, para que el ganador quede de último. */
export function prepararRevelacion(estado) {
  const { clasificacion, requiereRelampago, empatados } = clasificar(estado);
  const orden = [...clasificacion].reverse().map((j) => j.id);
  return {
    ...estado,
    fase: 'revelacion',
    clasificacion,
    requiereRelampago,
    empatados,
    revelacion: { orden, indice: 0, publico: null }
  };
}

/** Revela UNA pareja. Solo aquí salen las parejas y los autores de las trampas. */
export function revelarSiguiente(estado) {
  const { orden, indice } = estado.revelacion;
  if (indice >= orden.length) {
    const ganador = estado.clasificacion[0];
    return {
      estado: { ...estado, fase: 'fin' },
      efectos: [{ tipo: 'narrar', evento: 'ganador', apodo: ganador.apodo }, { tipo: 'confeti' }]
    };
  }
  const receptorId = orden[indice];
  const amigoSecretoId = Object.keys(estado.parejas).find((d) => estado.parejas[d] === receptorId);
  const apuesta = estado.apuestas[receptorId];
  const resultado = estado.resultadosApuesta?.[receptorId];

  const publico = {
    receptor: estado.jugadores[receptorId].apodo,
    amigoSecreto: estado.jugadores[amigoSecretoId]?.apodo ?? '—',
    acerto: Boolean(resultado?.acerto),
    apostoPor: apuesta ? estado.jugadores[apuesta.sospechosoId]?.apodo : null,
    tarjetas: (estado.montones[receptorId] || []).map((t) => ({
      nivel: t.nivel,
      texto: t.texto,
      falsa: t.origen === 'trampa',
      puestaPor: t.origen === 'trampa' ? estado.jugadores[t.autorId]?.apodo : null,
      origenPregunta: t.preguntaId,
      comprada: t.comprada
    }))
  };

  return {
    estado: { ...estado, revelacion: { orden, indice: indice + 1, publico } },
    efectos: [
      { tipo: 'narrar', evento: 'revelacion_pareja', apodo: publico.receptor },
      { tipo: 'redoble' },
      { tipo: 'revelacion', publico }
    ]
  };
}
