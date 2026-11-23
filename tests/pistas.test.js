import test from 'node:test';
import assert from 'node:assert/strict';
import { partidaDePrueba, respuestasDe, config, cuestionario } from './ayuda.js';
import { crearPartida, agregarJugador, guardarRespuestas, guardarPareja, prepararPartida, guardarTarjetasManuales } from '../engine/estado.js';
import { candidatasDe, seleccionar, esSegura, generarFalsa, generarMontones } from '../engine/pistas/generador.js';
import { crearAzar } from '../engine/azar.js';

test('rareza: una respuesta compartida identifica menos que una respuesta única', () => {
  const e = partidaDePrueba(8);
  // En respuestasDe, "pizza" la comparten j0 y j1; los demás tienen comidas distintas.
  const cand = candidatasDe('j0', e);
  const fuertePizza = cand.find((c) => c.preguntaId === 'comida' && c.nivelPlantilla === 'fuerte');
  const candSolo = candidatasDe('j2', e);
  const fuerteSancocho = candSolo.find((c) => c.preguntaId === 'comida' && c.nivelPlantilla === 'fuerte');

  assert.equal(fuertePizza.comparten, 2);
  assert.equal(fuerteSancocho.comparten, 1);
  assert.ok(fuertePizza.identificacion < fuerteSancocho.identificacion,
    'compartir la respuesta debe bajar el poder identificador');
  assert.equal(fuerteSancocho.identificacion, 1, 'respuesta única = identificación máxima');
});

test('cada jugador recibe exactamente 1 fácil, 1 media y 1 difícil', () => {
  const e = partidaDePrueba(10);
  for (const monton of Object.values(e.montones)) {
    assert.deepEqual(monton.map((t) => t.nivel).sort(), ['dificil', 'facil', 'media']);
  }
});

test('la pista fácil nunca identifica a una sola persona', () => {
  const e = partidaDePrueba(12);
  const azar = crearAzar('x');
  for (const id of Object.keys(e.jugadores)) {
    const { elegidas } = seleccionar(candidatasDe(id, e), { jugadores: e.jugadores, azar });
    if (elegidas.facil) {
      assert.ok(elegidas.facil.comparten >= 2,
        `la fácil de ${id} la comparte solo ${elegidas.facil.comparten} jugador(es)`);
    }
  }
});

test('las tres pistas de un jugador no repiten tema ni pregunta', () => {
  const e = partidaDePrueba(10);
  for (const monton of Object.values(e.montones)) {
    const preguntas = monton.map((t) => t.preguntaId).filter(Boolean);
    const categorias = monton.map((t) => t.categoria).filter(Boolean);
    assert.equal(new Set(preguntas).size, preguntas.length, 'preguntas repetidas');
    assert.equal(new Set(categorias).size, categorias.length, 'temas repetidos');
  }
});

test('filtro de nombres: una pista que contiene el apodo de alguien se descarta', () => {
  const jugadores = { j0: { id: 'j0', apodo: 'Pipe' }, j1: { id: 'j1', apodo: 'Tata' } };
  assert.equal(esSegura('Su comida favorita es pizza.', jugadores), true);
  assert.equal(esSegura('Dice que contigo recuerda: el paseo con Pipe', jugadores), false);
  assert.equal(esSegura('Dice que contigo recuerda: el viaje con TATA y el perro', jugadores), false);
  assert.equal(esSegura('Su talento es la pipeta de química', jugadores), true, 'no debe cortar por coincidencia parcial');
});

test('un jugador con pocas respuestas no rompe la generación: queda marcado como incompleto', () => {
  let e = crearPartida({ config, cuestionario, semilla: 'pocas' });
  for (let i = 0; i < 4; i++) e = agregarJugador(e, { id: `j${i}`, apodo: `J${i}`, avatar: '🎁', pinHash: 'x' });
  for (let i = 0; i < 4; i++) {
    e = guardarRespuestas(e, `j${i}`, i === 0 ? { comida: 'pizza' } : respuestasDe(i));
    e = guardarPareja(e, `j${i}`, `j${(i + 1) % 4}`);
  }
  e = prepararPartida(e);

  const montonDeLaVictima = e.montones.j1; // j0 regala a j1 y j0 casi no respondió
  assert.ok(montonDeLaVictima.length < 3, 'con una sola respuesta no se pueden armar 3 pistas distintas');
  assert.equal(e.resumenAdmin.j1.completo, false);
  assert.ok(e.resumenAdmin.j1.incidencias.length > 0);
  // Y el resumen del admin no debe contener el texto de ninguna pista.
  assert.ok(!JSON.stringify(e.resumenAdmin).includes('pizza'));
});

test('tarjetas escritas a mano reemplazan a la automática del mismo nivel', () => {
  let e = partidaDePrueba(6);
  e = guardarTarjetasManuales(e, 'j0', { media: 'Siempre llega con pandebonos' });
  e = prepararPartida(e);
  const monton = e.montones.j1; // j0 regala a j1
  const media = monton.find((t) => t.nivel === 'media');
  assert.equal(media.origen, 'manual');
  assert.equal(media.texto, 'Siempre llega con pandebonos');
  assert.equal(monton.find((t) => t.nivel === 'facil').origen, 'auto', 'los otros niveles siguen automáticos');
});

test('la trampa no puede coincidir por accidente con la verdad del montón', () => {
  const e = partidaDePrueba(8);
  // El montón de j3 lo escribió j2. Probamos muchas trampas de la categoría gustos.
  const verdadero = 'j2';
  for (let i = 0; i < 30; i++) {
    const falsa = generarFalsa(e, { victimaId: 'j3', tramposoId: 'j0', categoria: 'gustos', nivel: 'dificil' }, crearAzar(`s${i}`));
    if (!falsa) continue;
    const verdadComida = e.respuestas[verdadero].comida;
    assert.ok(!falsa.texto.includes(verdadComida),
      `la falsa "${falsa.texto}" repite la verdad (${verdadComida}) de quien le regala`);
  }
});

test('la trampa nunca usa las respuestas de la propia víctima', () => {
  const e = partidaDePrueba(8);
  const falsa = generarFalsa(e, { victimaId: 'j5', tramposoId: 'j0', categoria: 'entretenimiento', nivel: 'dificil' }, crearAzar('t'));
  assert.ok(falsa, 'debe poder generar algo');
  assert.ok(!falsa.texto.includes(e.respuestas.j5.serie), 'estaría describiendo a la víctima misma');
});

test('misma semilla y mismas respuestas => exactamente las mismas pistas', () => {
  const a = partidaDePrueba(9);
  const b = partidaDePrueba(9);
  assert.deepEqual(a.montones, b.montones);

  const azar1 = crearAzar('igual');
  const azar2 = crearAzar('igual');
  assert.deepEqual(generarMontones(a, azar1).montones, generarMontones(b, azar2).montones);
});

test('semillas distintas pueden dar selecciones distintas (el azar sí se usa)', () => {
  const e = partidaDePrueba(12);
  const m1 = generarMontones(e, crearAzar('semilla-A')).montones;
  const m2 = generarMontones(e, crearAzar('semilla-B')).montones;
  assert.notDeepEqual(m1, m2);
});

test('ninguna pista generada contiene el apodo de un jugador', () => {
  const e = partidaDePrueba(12);
  const apodos = Object.values(e.jugadores).map((j) => j.apodo.toLowerCase());
  for (const monton of Object.values(e.montones)) {
    for (const t of monton) {
      for (const apodo of apodos) assert.ok(!t.texto.toLowerCase().includes(apodo), `"${t.texto}" delata`);
    }
  }
});
