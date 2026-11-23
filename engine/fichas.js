// Única vía para mover fichas. Así toda variación queda registrada y auditada.

export function mover(estado, jugadorId, delta, motivo) {
  const jugador = estado.jugadores[jugadorId];
  if (!jugador) throw new Error(`Jugador desconocido: ${jugadorId}`);
  const nuevas = jugador.fichas + delta;
  if (nuevas < 0) throw new Error('FICHAS_INSUFICIENTES');

  const estado2 = {
    ...estado,
    jugadores: { ...estado.jugadores, [jugadorId]: { ...jugador, fichas: nuevas } },
    gastos: { ...estado.gastos, [jugadorId]: (estado.gastos[jugadorId] || 0) + (delta < 0 && motivo === 'compra_pista' ? -delta : 0) }
  };
  const efectos = [{ tipo: 'fichas', jugadorId, delta, total: nuevas, motivo },
    { tipo: 'narrar', evento: delta >= 0 ? 'fichas_suben' : 'fichas_bajan', apodo: jugador.apodo }];
  return { estado: estado2, efectos };
}

export const marcador = (estado) =>
  Object.values(estado.jugadores)
    .map((j) => ({ id: j.id, apodo: j.apodo, avatar: j.avatar, fichas: j.fichas, conectado: j.conectado }))
    .sort((a, b) => b.fichas - a.fichas || a.apodo.localeCompare(b.apodo));
