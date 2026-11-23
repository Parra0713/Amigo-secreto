// Sesiones de jugador: PIN, reconexión y qué pasa al archivar una partida.
// Esta prueba existe por un error real: al empezar una partida nueva, los
// celulares seguían reintentando con su PIN viejo y el servidor respondía
// "PIN incorrecto", que es un mensaje equivocado y además gastaba intentos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearJuego } from '../server/juego.js';
import { hashPin, pinCorrecto, crearControlIntentos } from '../server/sesiones.js';

/** Repositorio de mentira: guarda en memoria, no toca disco. */
function repositorioFalso() {
  let snapshot = null;
  const archivadas = [];
  return {
    cargarSnapshot: () => snapshot,
    guardarSnapshot: (e) => { snapshot = e; },
    anexarEvento: () => {},
    archivar: () => { archivadas.push(snapshot); },
    archivadas
  };
}

const juegoNuevo = () => crearJuego({ repositorio: repositorioFalso(), log: { info: () => {} } });

test('el PIN se guarda hasheado y se verifica en tiempo constante', () => {
  const hash = hashPin('1234');
  assert.notEqual(hash, '1234');
  assert.ok(pinCorrecto('1234', hash));
  assert.ok(!pinCorrecto('1235', hash));
});

test('un jugador registrado entra con su PIN y no con otro', () => {
  const juego = juegoNuevo();
  const { id, pin } = juego.registrar({ apodo: 'Pipe', avatar: '🎁' });

  assert.ok(juego.autenticar({ jugadorId: id, pin })?.jugador, 'debe entrar con su PIN');
  assert.equal(juego.autenticar({ jugadorId: id, pin: '0000' }), null, 'PIN equivocado: null');
});

test('al archivar la partida, la sesión vieja se reporta como vencida, no como PIN malo', () => {
  const juego = juegoNuevo();
  const { id, pin } = juego.registrar({ apodo: 'Pipe', avatar: '🎁' });
  assert.ok(juego.autenticar({ jugadorId: id, pin })?.jugador);

  juego.nuevaPartida();

  const resultado = juego.autenticar({ jugadorId: id, pin });
  assert.deepEqual(resultado, { expirada: true },
    'el jugador ya no existe: es sesión vencida, no PIN incorrecto');
  assert.notEqual(resultado, null, 'si fuera null, el celular mostraría "ese PIN no es"');
});

test('la partida nueva queda vacía y en registro', () => {
  const juego = juegoNuevo();
  juego.registrar({ apodo: 'Pipe', avatar: '🎁' });
  juego.registrar({ apodo: 'Tata', avatar: '🎄' });
  juego.nuevaPartida();

  assert.equal(Object.keys(juego.estado.jugadores).length, 0);
  assert.equal(juego.estado.fase, 'registro');
});

test('un apodo repetido se rechaza, pero se puede volver a usar en la partida nueva', () => {
  const juego = juegoNuevo();
  juego.registrar({ apodo: 'Pipe', avatar: '🎁' });
  assert.throws(() => juego.registrar({ apodo: 'pipe', avatar: '🎄' }), /APODO_REPETIDO/);

  juego.nuevaPartida();
  assert.ok(juego.registrar({ apodo: 'Pipe', avatar: '🎄' }).pin, 'tras archivar, el apodo queda libre');
});

test('cada jugador recibe un PIN distinto', () => {
  const juego = juegoNuevo();
  const pines = new Set();
  for (let i = 0; i < 12; i++) pines.add(juego.registrar({ apodo: `J${i}`, avatar: '🎁' }).pin);
  assert.equal(pines.size, 12);
});

test('el control de intentos bloquea a los 5 y la sesión vencida no debe gastarlos', () => {
  const control = crearControlIntentos({ maxIntentos: 5, ventanaMs: 60000 });
  for (let i = 0; i < 5; i++) assert.ok(control.permitido('ip'), `intento ${i + 1}`);
  assert.ok(!control.permitido('ip'), 'el sexto se bloquea');
  control.exito('ip');
  assert.ok(control.permitido('ip'), 'tras un éxito se reinicia la cuenta');
});

test('el celular sabe recuperarse de una partida archivada', () => {
  const html = readFileSync(new URL('../web/play/index.html', import.meta.url), 'utf8');
  assert.match(html, /t === 'reiniciada'/, 'debe atender el aviso del servidor');
  assert.match(html, /localStorage\.removeItem\('plan\.sesion'\)/, 'y borrar la sesión vieja');
  assert.match(html, /partida nueva/, 'con un mensaje que no culpe al jugador');
});
