// La prueba más importante: que nada secreto llegue a un cliente.
import test from 'node:test';
import assert from 'node:assert/strict';
import { partidaDePrueba } from './ayuda.js';
import { vistaPara, vistaPublica, vistaAdmin } from '../engine/proyeccion.js';
import { RONDAS, aplicar, avanzar } from '../engine/index.js';

const textoDe = (o) => JSON.stringify(o);

test('la vista de un jugador no contiene las parejas de nadie', () => {
  const e = partidaDePrueba(8);
  for (const id of Object.keys(e.jugadores)) {
    const vista = textoDe(vistaPara(e, id));
    assert.ok(!vista.includes('parejas'));
    assert.ok(!vista.includes('pinHash'));
    assert.ok(!vista.includes('respuestas'));
    assert.ok(!vista.includes('autorId'), 'ni el autor de una tarjeta');
  }
});

test('la vista de un jugador no contiene las respuestas del cuestionario de otros', () => {
  const e = partidaDePrueba(8);
  for (const id of Object.keys(e.jugadores)) {
    const vista = textoDe(vistaPara(e, id));
    for (const otroId of Object.keys(e.jugadores)) {
      if (otroId === id) continue;
      for (const valor of Object.values(e.respuestas[otroId])) {
        // Los valores propios pueden aparecer en su montón; los ajenos nunca.
        const esPropio = Object.values(e.respuestas[id]).includes(valor);
        if (!esPropio && String(valor).length > 4) {
          assert.ok(!vista.includes(String(valor)), `la vista de ${id} filtró "${valor}" de ${otroId}`);
        }
      }
    }
  }
});

test('el texto de una tarjeta solo aparece después de comprarla', () => {
  const { estado } = RONDAS.ronda1.start(partidaDePrueba(6));
  const tarjeta = estado.montones.j0.find((t) => t.nivel === 'facil');

  const antes = vistaPara(estado, 'j0').monton.find((t) => t.id === tarjeta.id);
  assert.equal(antes.texto, null, 'sin comprar no debe viajar el texto');
  assert.equal(antes.precio, 1);

  const { estado: e2 } = aplicar(estado, { t: 'ronda1.comprar', jugadorId: 'j0', tarjetaId: tarjeta.id });
  const despues = vistaPara(e2, 'j0').monton.find((t) => t.id === tarjeta.id);
  assert.equal(despues.texto, tarjeta.texto);
});

test('un jugador no ve el montón de otro jugador', () => {
  const { estado } = RONDAS.ronda1.start(partidaDePrueba(6));
  const { estado: e2 } = aplicar(estado, { t: 'ronda1.comprar', jugadorId: 'j1', tarjetaId: estado.montones.j1[0].id });
  const vistaDeJ0 = textoDe(vistaPara(e2, 'j0'));
  assert.ok(!vistaDeJ0.includes(estado.montones.j1[0].texto));
});

test('la víctima de una trampa no puede distinguir cuál es falsa ni quién la puso', () => {
  const { estado } = RONDAS.ronda2.start(partidaDePrueba(8));
  const { estado: e2 } = aplicar(estado, { t: 'ronda2.trampa', jugadorId: 'j0', victimaId: 'j3', categoria: 'gustos', nivel: 'media' });
  const vista = vistaPara(e2, 'j3');
  assert.ok(!textoDe(vista).includes('trampa'), 'ni la palabra origen debe viajar');
  assert.equal(vista.monton.length, 4, 've una tarjeta más, pero no sabe cuál es la falsa');
  for (const t of vista.monton) {
    assert.deepEqual(Object.keys(t).sort(), ['comprada', 'id', 'nivel', 'precio', 'texto'],
      'la tarjeta solo expone estos campos');
  }
});

test('en el dilema, la elección del otro no se conoce antes de cerrar la ronda', () => {
  const { estado } = RONDAS.ronda3.start(partidaDePrueba(6));
  const [a, b] = estado.dilema.parejas[0];
  const { estado: e2 } = aplicar(estado, { t: 'ronda3.elegir', jugadorId: b, opcion: 'guardar' });
  const vista = vistaPara(e2, a);
  assert.equal(vista.dilema.suEleccion, null);
  assert.equal(vista.dilema.pistaRecibida, null);
});

test('la TV nunca ve textos de tarjetas ni parejas', () => {
  const { estado } = RONDAS.ronda1.start(partidaDePrueba(8));
  const publica = textoDe(vistaPublica(estado));
  assert.ok(!publica.includes('parejas'));
  for (const monton of Object.values(estado.montones)) {
    for (const t of monton) assert.ok(!publica.includes(t.texto));
  }
});

test('el admin solo ve conteos anónimos, nunca contenido ni parejas', () => {
  const e = partidaDePrueba(8);
  const vista = textoDe(vistaAdmin(e));
  assert.ok(!vista.includes('parejas'));
  assert.ok(!vista.includes('pinHash'));
  for (const monton of Object.values(e.montones)) {
    for (const t of monton) assert.ok(!vista.includes(t.texto), 'el admin no debe ver el texto de las pistas');
  }
  assert.ok(vista.includes('cantidadPistas'));
});

test('las parejas solo aparecen en la fase de revelación', () => {
  let e = partidaDePrueba(5);
  for (let i = 0; i < 6; i++) e = avanzar(e).estado;
  assert.equal(e.fase, 'revelacion');
  // Antes de revelar, la vista pública sigue sin parejas.
  assert.equal(vistaPublica(e).revelacion, null);
});

test('los objetivos de trampa traen temas, nunca respuestas ajenas', () => {
  const { estado } = RONDAS.ronda2.start(partidaDePrueba(8));
  const vista = vistaPara(estado, 'j0');
  assert.ok(vista.objetivos.length > 0);
  for (const objetivo of vista.objetivos) {
    assert.deepEqual(Object.keys(objetivo).sort(), ['apodo', 'avatar', 'categorias', 'id']);
    assert.ok(objetivo.categorias.length > 0, 'no se ofrece una víctima sin material');
  }
  // Ninguna respuesta de ningún jugador puede aparecer en la lista de objetivos.
  const texto = textoDe(vista.objetivos);
  for (const respuestas of Object.values(estado.respuestas)) {
    for (const valor of Object.values(respuestas)) {
      if (String(valor).length > 4) assert.ok(!texto.includes(String(valor)));
    }
  }
});

test('no se ofrece como objetivo un montón que ya llegó al límite de falsas', () => {
  let { estado } = RONDAS.ronda2.start(partidaDePrueba(8));
  estado = aplicar(estado, { t: 'ronda2.trampa', jugadorId: 'j1', victimaId: 'j5', categoria: 'gustos', nivel: 'media' }).estado;
  estado = aplicar(estado, { t: 'ronda2.trampa', jugadorId: 'j2', victimaId: 'j5', categoria: 'hogar', nivel: 'facil' }).estado;
  const vista = vistaPara(estado, 'j0');
  assert.ok(!vista.objetivos.some((o) => o.id === 'j5'), 'j5 ya tiene 2 falsas');
});

test('con 2 jugadores no se ofrece ninguna trampa, porque no hay con qué armarla', () => {
  const { estado } = RONDAS.ronda2.start(partidaDePrueba(2));
  assert.deepEqual(vistaPara(estado, 'j0').objetivos, []);
});

test('quien ya puso su trampa no recibe objetivos', () => {
  const { estado } = RONDAS.ronda2.start(partidaDePrueba(8));
  const { estado: e2 } = aplicar(estado, { t: 'ronda2.trampa', jugadorId: 'j0', victimaId: 'j4', categoria: 'gustos', nivel: 'media' });
  assert.equal(vistaPara(e2, 'j0').objetivos, null);
});
