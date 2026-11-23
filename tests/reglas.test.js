import test from 'node:test';
import assert from 'node:assert/strict';
import { partidaDePrueba } from './ayuda.js';
import { aplicar, avanzar, expirar, RONDAS, clasificar } from '../engine/index.js';

const err = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

test('ronda 1: comprar una pista descuenta el precio y revela el texto', () => {
  const { estado } = RONDAS.ronda1.start(partidaDePrueba(6));
  const tarjeta = estado.montones.j0.find((t) => t.nivel === 'media');
  const { estado: e2 } = aplicar(estado, { t: 'ronda1.comprar', jugadorId: 'j0', tarjetaId: tarjeta.id });

  assert.equal(e2.jugadores.j0.fichas, 10 - 2);
  assert.equal(e2.montones.j0.find((t) => t.id === tarjeta.id).comprada, true);
  assert.equal(e2.gastos.j0, 2, 'el gasto en pistas se acumula para el desempate');
});

test('ronda 1: no se puede comprar dos veces ni comprar el montón ajeno', () => {
  const { estado } = RONDAS.ronda1.start(partidaDePrueba(6));
  const t0 = estado.montones.j0[0];
  const { estado: e2 } = aplicar(estado, { t: 'ronda1.comprar', jugadorId: 'j0', tarjetaId: t0.id });
  assert.equal(err(() => aplicar(e2, { t: 'ronda1.comprar', jugadorId: 'j0', tarjetaId: t0.id })), 'YA_COMPRADA');
  assert.equal(err(() => aplicar(e2, { t: 'ronda1.comprar', jugadorId: 'j1', tarjetaId: t0.id })), 'TARJETA_INVALIDA');
});

test('ronda 1: sin fichas suficientes, la compra se rechaza', () => {
  let { estado } = RONDAS.ronda1.start(partidaDePrueba(6));
  estado = { ...estado, jugadores: { ...estado.jugadores, j0: { ...estado.jugadores.j0, fichas: 1 } } };
  const dificil = estado.montones.j0.find((t) => t.nivel === 'dificil');
  assert.equal(err(() => aplicar(estado, { t: 'ronda1.comprar', jugadorId: 'j0', tarjetaId: dificil.id })), 'FICHAS_INSUFICIENTES');
});

test('ronda 2: la trampa cuesta 1 ficha y agrega una tarjeta falsa al montón ajeno', () => {
  const { estado } = RONDAS.ronda2.start(partidaDePrueba(8));
  const antes = estado.montones.j3.length;
  const { estado: e2, efectos } = aplicar(estado, { t: 'ronda2.trampa', jugadorId: 'j0', victimaId: 'j3', categoria: 'gustos', nivel: 'media' });

  assert.equal(e2.jugadores.j0.fichas, 9);
  assert.equal(e2.montones.j3.length, antes + 1);
  assert.equal(e2.montones.j3.at(-1).origen, 'trampa');
  assert.ok(!JSON.stringify(efectos).includes('j0') || !JSON.stringify(efectos.filter(f => f.tipo === 'narrar')).includes('j0'),
    'el narrador no puede delatar al tramposo');
});

test('ronda 2: límites — una trampa por jugador, dos falsas por montón, nunca sobre el propio', () => {
  const { estado } = RONDAS.ronda2.start(partidaDePrueba(8));
  assert.equal(err(() => aplicar(estado, { t: 'ronda2.trampa', jugadorId: 'j0', victimaId: 'j0', categoria: 'gustos', nivel: 'media' })), 'TRAMPA_PROPIA');

  const { estado: e2 } = aplicar(estado, { t: 'ronda2.trampa', jugadorId: 'j0', victimaId: 'j3', categoria: 'gustos', nivel: 'media' });
  assert.equal(err(() => aplicar(e2, { t: 'ronda2.trampa', jugadorId: 'j0', victimaId: 'j4', categoria: 'gustos', nivel: 'media' })), 'LIMITE_TRAMPAS');

  const { estado: e3 } = aplicar(e2, { t: 'ronda2.trampa', jugadorId: 'j1', victimaId: 'j3', categoria: 'rutina', nivel: 'facil' });
  assert.equal(err(() => aplicar(e3, { t: 'ronda2.trampa', jugadorId: 'j2', victimaId: 'j3', categoria: 'hogar', nivel: 'media' })), 'LIMITE_FALSAS_MONTON');
});

test('ronda 3: las cuatro combinaciones del dilema pagan lo que dice reglas.json', () => {
  const { estado } = RONDAS.ronda3.start(partidaDePrueba(8));
  const [[a, b], [c, d], [e, f], [g, h]] = estado.dilema.parejas;
  let s = estado;
  for (const [id, op] of [[a,'cooperar'],[b,'cooperar'],[c,'cooperar'],[d,'guardar'],[e,'guardar'],[f,'guardar']]) {
    s = aplicar(s, { t: 'ronda3.elegir', jugadorId: id, opcion: op }).estado;
  }
  s = aplicar(s, { t: 'ronda3.elegir', jugadorId: g, opcion: 'guardar' }).estado;
  s = aplicar(s, { t: 'ronda3.elegir', jugadorId: h, opcion: 'cooperar' }).estado;

  assert.equal(s.jugadores[a].fichas, 12, 'cooperar/cooperar: +2');
  assert.equal(s.jugadores[b].fichas, 12);
  assert.equal(s.jugadores[c].fichas, 10, 'cooperó contra quien guardó: +0');
  assert.equal(s.jugadores[d].fichas, 13, 'guardó contra quien cooperó: +3');
  assert.equal(s.jugadores[e].fichas, 10, 'guardar/guardar: nada');
  assert.equal(s.jugadores[f].fichas, 10);
  assert.equal(s.jugadores[g].fichas, 13);
  assert.equal(s.jugadores[h].fichas, 10);
  assert.ok(s.dilema.pistasRecibidas[a], 'quien cooperó mutuamente recibe una pista real');
});

test('ronda 3: con número impar, el sobrante gana 1 ficha sin jugar', () => {
  const { estado } = RONDAS.ronda3.start(partidaDePrueba(7));
  assert.ok(estado.dilema.sobrante, 'con 7 jugadores debe haber sobrante');
  const sobrante = estado.dilema.sobrante;
  const { estado: fin } = RONDAS.ronda3.onTimeout(estado);
  assert.equal(fin.jugadores[sobrante].fichas, 11);
});

test('ronda 3: quien no responde a tiempo cuenta como "guardar"', () => {
  const { estado } = RONDAS.ronda3.start(partidaDePrueba(6));
  const [a, b] = estado.dilema.parejas[0];
  const s = aplicar(estado, { t: 'ronda3.elegir', jugadorId: a, opcion: 'cooperar' }).estado;
  const { estado: fin } = RONDAS.ronda3.onTimeout(s);
  assert.equal(fin.jugadores[a].fichas, 10, 'cooperó solo: +0');
  assert.equal(fin.jugadores[b].fichas, 13, 'el ausente guarda y cobra +3');
});

test('ronda 4: acertar duplica, fallar pierde y dispara el bono fantasma', () => {
  const { estado } = RONDAS.ronda4.start(partidaDePrueba(4)); // j0->j1, j1->j2, j2->j3, j3->j0
  let s = estado;
  // El amigo secreto de j1 es j0. j1 acierta.
  s = aplicar(s, { t: 'ronda4.apostar', jugadorId: 'j1', sospechosoId: 'j0', monto: 5 }).estado;
  // El amigo secreto de j2 es j1. j2 falla -> j1 cobra bono fantasma.
  s = aplicar(s, { t: 'ronda4.apostar', jugadorId: 'j2', sospechosoId: 'j0', monto: 4 }).estado;
  s = aplicar(s, { t: 'ronda4.apostar', jugadorId: 'j3', sospechosoId: 'j2', monto: 1 }).estado;
  const { estado: fin } = aplicar(s, { t: 'ronda4.apostar', jugadorId: 'j0', sospechosoId: 'j3', monto: 1 });

  assert.equal(fin.resultadosApuesta.j1.acerto, true);
  assert.equal(fin.resultadosApuesta.j2.acerto, false);
  assert.equal(fin.jugadores.j1.fichas, 10 + 5 + 3, 'acierto (+5) y bono fantasma (+3)');
  assert.equal(fin.jugadores.j2.fichas, 10 - 4);
});

test('ronda 4: no se puede apostar más de lo que se tiene, ni cero, ni a uno mismo', () => {
  const { estado } = RONDAS.ronda4.start(partidaDePrueba(5));
  assert.equal(err(() => aplicar(estado, { t: 'ronda4.apostar', jugadorId: 'j0', sospechosoId: 'j1', monto: 11 })), 'APUESTA_INVALIDA');
  assert.equal(err(() => aplicar(estado, { t: 'ronda4.apostar', jugadorId: 'j0', sospechosoId: 'j1', monto: 0 })), 'APUESTA_INVALIDA');
  assert.equal(err(() => aplicar(estado, { t: 'ronda4.apostar', jugadorId: 'j0', sospechosoId: 'j0', monto: 1 })), 'SOSPECHOSO_INVALIDO');
  assert.equal(err(() => aplicar(estado, { t: 'ronda4.apostar', jugadorId: 'j0', sospechosoId: 'j1', monto: 2.5 })), 'APUESTA_INVALIDA');
});

test('una acción fuera de su fase siempre se rechaza', () => {
  const { estado } = RONDAS.ronda1.start(partidaDePrueba(5));
  assert.equal(err(() => aplicar(estado, { t: 'ronda4.apostar', jugadorId: 'j0', sospechosoId: 'j1', monto: 1 })), 'FASE_INCORRECTA');
});

test('desempate: con las mismas fichas gana quien acertó; si no, quien gastó menos en pistas', () => {
  let e = partidaDePrueba(3);
  e = { ...e,
    jugadores: { ...e.jugadores,
      j0: { ...e.jugadores.j0, fichas: 12 }, j1: { ...e.jugadores.j1, fichas: 12 }, j2: { ...e.jugadores.j2, fichas: 5 } },
    resultadosApuesta: { j0: { acerto: false }, j1: { acerto: true }, j2: { acerto: false } },
    gastos: { j0: 1, j1: 7, j2: 0 }
  };
  const { clasificacion, requiereRelampago } = clasificar(e);
  assert.equal(clasificacion[0].id, 'j1', 'el acierto rompe el empate antes que el gasto');
  assert.equal(requiereRelampago, false);

  const e2 = { ...e, resultadosApuesta: { j0: { acerto: true }, j1: { acerto: true }, j2: { acerto: false } } };
  assert.equal(clasificar(e2).clasificacion[0].id, 'j0', 'con ambos aciertos gana quien gastó menos');
});

test('desempate real: se marca que hace falta la apuesta relámpago', () => {
  let e = partidaDePrueba(3);
  e = { ...e,
    jugadores: { ...e.jugadores, j0: { ...e.jugadores.j0, fichas: 12 }, j1: { ...e.jugadores.j1, fichas: 12 } },
    resultadosApuesta: { j0: { acerto: true }, j1: { acerto: true } },
    gastos: { j0: 3, j1: 3, j2: 0 }
  };
  const r = clasificar(e);
  assert.equal(r.requiereRelampago, true);
  assert.deepEqual(r.empatados.sort(), ['j0', 'j1']);
});

test('el timeout cierra la ronda y avanza a la siguiente', () => {
  const { estado } = RONDAS.ronda1.start(partidaDePrueba(5));
  const { estado: fin } = expirar(estado);
  assert.equal(fin.fase, 'ronda2');
});

test('un jugador desconectado no bloquea la partida', () => {
  let { estado } = RONDAS.ronda4.start(partidaDePrueba(4));
  estado = { ...estado, jugadores: { ...estado.jugadores, j3: { ...estado.jugadores.j3, conectado: false } } };
  for (const [id, sospechoso] of [['j0', 'j1'], ['j1', 'j0'], ['j2', 'j0']]) {
    estado = aplicar(estado, { t: 'ronda4.apostar', jugadorId: id, sospechosoId: sospechoso, monto: 1 }).estado;
  }
  const { estado: fin } = expirar(estado);
  assert.equal(fin.resultadosApuesta.j3.sinApostar, true);
  assert.equal(fin.fase, 'revelacion');
});

test('la variante corta solo juega las rondas 1 y 4', () => {
  const e = partidaDePrueba(5, { rondasActivas: ['ronda1', 'ronda4'] });
  const a = avanzar(e);
  assert.equal(a.estado.fase, 'ronda1');
  assert.equal(avanzar(a.estado).estado.fase, 'ronda4');
});

test('ronda 1: cuando todos avisan que terminaron, la ronda se cierra sola', () => {
  let { estado } = RONDAS.ronda1.start(partidaDePrueba(4));
  let efectos = [];
  for (const id of ['j0', 'j1', 'j2', 'j3']) {
    const r = aplicar(estado, { t: 'ronda1.listo', jugadorId: id });
    estado = r.estado;
    efectos = r.efectos;
  }
  assert.ok(efectos.some((e) => e.tipo === 'finRonda'), 'el último "listo" debe cerrar la ronda');
});

test('ronda 1: quien ya no puede comprar nada queda listo sin pedirlo', () => {
  let e = partidaDePrueba(3);
  e = { ...e, jugadores: { ...e.jugadores, j0: { ...e.jugadores.j0, fichas: 0 } } };
  const { estado } = RONDAS.ronda1.start(e);
  assert.equal(estado.listos.j0, true, 'sin fichas no hay nada que decidir');
  assert.equal(estado.listos.j1, undefined);
});

test('ronda 1: comprar la última pista que alcanza deja al jugador listo', () => {
  let e = partidaDePrueba(3);
  e = { ...e, jugadores: { ...e.jugadores, j0: { ...e.jugadores.j0, fichas: 1 } } };
  const { estado } = RONDAS.ronda1.start(e);
  const facil = estado.montones.j0.find((t) => t.nivel === 'facil');
  const { estado: e2 } = aplicar(estado, { t: 'ronda1.comprar', jugadorId: 'j0', tarjetaId: facil.id });
  assert.equal(e2.jugadores.j0.fichas, 0);
  assert.equal(e2.listos.j0, true, 'ya no le alcanza para más: queda listo solo');
});

test('ronda 2: poner la trampa o pasar deja listo, y el último cierra la ronda', () => {
  let { estado } = RONDAS.ronda2.start(partidaDePrueba(4));
  const r1 = aplicar(estado, { t: 'ronda2.trampa', jugadorId: 'j0', victimaId: 'j2', categoria: 'gustos', nivel: 'media' });
  assert.equal(r1.estado.listos.j0, true, 'quien ya trampeó queda listo');

  let s = r1.estado;
  let ultimos = [];
  for (const id of ['j1', 'j2', 'j3']) {
    const r = aplicar(s, { t: 'ronda2.pasar', jugadorId: id });
    s = r.estado;
    ultimos = r.efectos;
  }
  assert.ok(ultimos.some((e) => e.tipo === 'finRonda'));
});

test('cada ronda empieza con la cuenta de listos en cero', () => {
  let e = partidaDePrueba(4);
  e = { ...e, listos: { j0: true, j1: true, j2: true, j3: true } };
  assert.deepEqual(RONDAS.ronda3.start(e).estado.listos, {});
  assert.deepEqual(RONDAS.ronda4.start(e).estado.listos, {});
});
