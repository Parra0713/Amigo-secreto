/* El cortometraje que explica el juego: guion, puesta en escena y cableado. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearReloj, crearPuesta, suave, rebote, pulso } from '../web/tv/puesta.js';
import { fraccionDePalabra } from '../web/tv/corto.js';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8');
const corto = JSON.parse(leer('config/corto.json'));
const pasos = corto.capitulos.flatMap((c) => c.pasos.map((p) => ({ ...p, capitulo: c.id })));

// ---------- el guion ----------

test('el guion cuenta una historia con los tres personajes, capítulo por capítulo', () => {
  assert.deepEqual(corto.personajes, ['Tita', 'Nacho', 'Pipe']);
  assert.ok(corto.capitulos.length >= 6, 'al menos un capítulo por ronda, más apertura y cierre');
  for (const cap of corto.capitulos) {
    assert.ok(cap.id && cap.titulo, 'cada capítulo se nombra');
    assert.ok(cap.pasos.length >= 1);
  }
  // Los tres personajes se presentan en el primer capítulo, no de golpe al final.
  const primero = corto.capitulos[0].pasos.map((p) => p.texto).join(' ');
  for (const nombre of corto.personajes) assert.match(primero, new RegExp(nombre));
});

test('cada paso dice quién habla, qué se oye y qué se ve', () => {
  const acciones = ['mesa', 'quitarMesa', 'marcar', 'monton', 'comprar', 'trampa',
                    'dilema', 'apuesta', 'bono', 'revelacion', 'limpiar'];
  for (const paso of pasos) {
    assert.ok(paso.id, 'falta id');
    assert.ok(['grupier', 'explicador'].includes(paso.voz), `${paso.id}: voz rara`);
    assert.ok(paso.texto?.length > 10, `${paso.id}: sin texto`);
    assert.ok(paso.accion?.nombre, `${paso.id}: no muestra nada`);
    assert.ok(acciones.includes(paso.accion.nombre), `${paso.id}: acción desconocida`);
    assert.ok(!/\{[a-zá-ú]+\}/i.test(paso.texto), `${paso.id}: lleva {variable}, no entra al banco`);
    assert.match(paso.texto, /[.…?]/, `${paso.id}: sin pausas marcadas`);
  }
});

test('las acciones del guion existen de verdad en la puesta en escena', () => {
  const puesta = crearPuesta({ piezas: {}, encuadre: () => {} });
  for (const paso of pasos) {
    assert.ok(puesta.acciones.includes(paso.accion.nombre),
      `${paso.id}: la puesta no sabe hacer "${paso.accion.nombre}"`);
  }
});

test('los acentos caen en palabras que de verdad están en la frase', () => {
  for (const paso of pasos) {
    for (const acento of paso.acentos || []) {
      const f = fraccionDePalabra(paso.texto, acento.palabra);
      assert.ok(f !== null, `${paso.id}: "${acento.palabra}" no está en el texto`);
      assert.ok(f > 0 && f < 1);
      if (acento.hacer === 'marcar') {
        assert.ok(corto.personajes.map((n) => n.toLowerCase()).includes(acento.quien),
          `${paso.id}: marca a alguien que no está en la mesa`);
      }
    }
  }
});

test('se muestra antes de nombrar: la regla aparece con su escena', () => {
  // La carta falsa se ve en el capítulo de la trampa, no antes.
  const trampa = corto.capitulos.find((c) => c.id === 'trampa');
  assert.equal(trampa.pasos[0].accion.nombre, 'trampa');
  assert.equal(trampa.pasos[0].accion.de, 'pipe');
  assert.equal(trampa.pasos[0].accion.a, 'tita');
  // Y el bono fantasma tiene su propia escena.
  assert.ok(pasos.some((p) => p.accion.nombre === 'bono'));
});

test('las etiquetas son pocas y cortas, para leerse de lejos', () => {
  for (const paso of pasos) {
    const e = paso.etiquetas || [];
    assert.ok(e.length <= 3, `${paso.id}: más de 3 etiquetas`);
    e.forEach((t) => assert.ok(t.length <= 42, `${paso.id}: etiqueta larga "${t}"`));
  }
});

test('la versión exprés es la misma historia en un tercio del tiempo', () => {
  const expres = pasos.filter((p) => p.expres);
  assert.ok(expres.length >= 6, 'la exprés tiene que cubrir todo el juego');
  const palabras = (t) => t.trim().split(/\s+/).length;
  const completa = pasos.reduce((n, p) => n + palabras(p.texto), 0);
  const corta = expres.reduce((n, p) => n + palabras(p.textoExpres), 0);
  assert.ok(corta < completa * 0.45, `la exprés debería ser mucho más corta (${corta} de ${completa})`);
  // Y toca todos los capítulos: no se salta una ronda entera.
  const capitulos = new Set(expres.map((p) => p.capitulo));
  assert.equal(capitulos.size, corto.capitulos.length, 'falta algún capítulo en la exprés');
  for (const paso of expres) assert.ok(paso.textoExpres?.length > 10, `${paso.id}: exprés sin texto propio`);
});

// ---------- la prueba de comprensión ----------

test('el test de comprensión mide los cinco puntos que no se pueden perder', () => {
  const preguntas = corto.comprension;
  assert.equal(preguntas.length, 5, 'cinco preguntas: el listón es acertar cuatro');
  for (const p of preguntas) {
    assert.ok(p.id && p.pregunta.endsWith('?'), `${p.id}: no es una pregunta`);
    assert.equal(p.opciones.length, 3);
    assert.ok(Number.isInteger(p.correcta) && p.opciones[p.correcta], `${p.id}: respuesta inválida`);
    // Las distractoras tienen que ser verosímiles, no de relleno.
    p.opciones.forEach((o) => assert.ok(o.length > 6, `${p.id}: opción demasiado vaga`));
  }
  // Lo esencial queda cubierto: a quién adivinas, quién gana, el costo,
  // la carta falsa y el bono por no ser descubierto.
  const todo = preguntas.map((p) => p.pregunta + p.opciones.join(' ')).join(' ').toLowerCase();
  for (const clave of ['regala', 'fichas', 'falsa', 'descubran']) {
    assert.match(todo, new RegExp(clave), `el test no pregunta por "${clave}"`);
  }
});

// ---------- el motor de movimiento ----------

test('nada se mueve en línea recta a velocidad constante', () => {
  for (const curva of [suave, rebote]) {
    assert.ok(Math.abs(curva(0)) < 0.001, 'arranca en cero');
    assert.ok(Math.abs(curva(1) - 1) < 0.001, 'termina en uno');
    // Si fuera lineal, el valor en la mitad sería 0.5 exacto en todo el recorrido.
    const desvio = Math.abs(curva(0.25) - 0.25) + Math.abs(curva(0.75) - 0.75);
    assert.ok(desvio > 0.05, 'la curva tiene que acelerar y frenar');
  }
  assert.ok(pulso(0.5) > 0.99 && pulso(0) < 0.01 && pulso(1) < 0.01, 'el pulso va y vuelve');
});

test('el reloj respeta retardos y avisa al terminar', () => {
  const reloj = crearReloj();
  const visto = [];
  reloj.mover({ retardo: 0.5, duracion: 1, de: 0, a: 10, curva: 'lineal',
    aplicar: (v) => visto.push(v), alTerminar: () => visto.push('fin') });

  reloj.actualizar(0.4);
  assert.equal(visto.length, 0, 'todavía no arranca');
  reloj.actualizar(0.35);                     // 0.75 s: 0.25 de recorrido
  assert.ok(Math.abs(visto[0] - 2.5) < 0.001);
  assert.ok(reloj.ocupado);
  reloj.actualizar(1);
  assert.equal(visto.at(-1), 'fin');
  assert.ok(!reloj.ocupado, 'al acabar no queda nada corriendo');
});

/** Piezas de mentiras con la misma forma que las de Three.js. */
const vector = (x = 0, y = 0, z = 0) => ({
  x, y, z,
  set(a, b, c) { this.x = a; this.y = b; this.z = c; },
  copy(o) { this.x = o.x; this.y = o.y; this.z = o.z; },
  clone() { return vector(this.x, this.y, this.z); }
});
const malla = (x = 0, y = 0, z = 0) => ({
  visible: false,
  position: vector(x, y, z),
  rotation: vector(),
  scale: { v: 1, setScalar(s) { this.v = s; } }
});
const invitadoFalso = (x, z) => {
  const grupo = malla(x, -0.15, z);
  return { grupo, cuerpo: malla(), cabeza: malla(), foco: malla(),
           cartas: [malla(), malla(), malla()], fichas: [malla(), malla()],
           base: grupo.position.clone() };
};
const piezasFalsas = () => ({
  invitados: [invitadoFalso(-1.45, 1.5), invitadoFalso(0.1, 1.15), invitadoFalso(1.6, 1.5)],
  cartaFalsa: malla(), fantasma: malla(), puertas: [malla(), malla()], fichasPila: [malla()]
});

test('la carta falsa viaja del tramposo a su víctima', () => {
  const piezas = piezasFalsas();
  const planos = [];
  const puesta = crearPuesta({ piezas, encuadre: (n) => planos.push(n) });

  assert.ok(puesta.accion('trampa', { de: 'pipe', a: 'tita' }));
  assert.deepEqual(planos, ['complot'], 'la trampa se cuenta en plano de complot');
  assert.ok(piezas.cartaFalsa.visible);

  puesta.actualizar(0.01);
  const salida = piezas.cartaFalsa.position.x;
  puesta.actualizar(1.3);
  const llegada = piezas.cartaFalsa.position.x;
  const pipe = piezas.invitados[2].grupo.position.x;
  const tita = piezas.invitados[0].grupo.position.x;
  assert.ok(Math.abs(salida - pipe) < Math.abs(salida - tita), 'sale de donde está Pipe');
  assert.ok(Math.abs(llegada - tita) < 0.2, 'y llega a donde está Tita');
  // Al final, el oro marca a la víctima: es de ella de quien hablamos ahora.
  assert.ok(piezas.invitados[0].foco.visible);
});

test('comprar es pagar: la ficha sale y por eso se voltea la carta', () => {
  const piezas = piezasFalsas();
  const puesta = crearPuesta({ piezas, encuadre: () => {} });
  puesta.accion('comprar', { quien: 'tita', cual: 0 });

  const ficha = piezas.invitados[0].fichas[0];
  assert.ok(ficha.visible, 'primero se ve la ficha');
  assert.equal(piezas.invitados[0].cartas[0].rotation.x, 0, 'la carta aún no se voltea');

  puesta.actualizar(0.3);
  assert.ok(ficha.position.y > 0.5, 'la ficha va por el aire, no arrastrada');
  puesta.actualizar(0.4);
  assert.ok(!ficha.visible, 'la ficha se entregó');
  puesta.actualizar(0.8);
  assert.ok(piezas.invitados[0].cartas[0].rotation.x > 2, 'y entonces la carta queda boca arriba');
});

test('al limpiar, la mesa queda como estaba', () => {
  const piezas = piezasFalsas();
  const puesta = crearPuesta({ piezas, encuadre: () => {} });
  puesta.accion('mesa');
  puesta.accion('revelacion');
  puesta.actualizar(2);
  puesta.limpiar();

  assert.ok(!piezas.cartaFalsa.visible);
  assert.ok(!piezas.fantasma.visible);
  for (const inv of piezas.invitados) {
    assert.ok(!inv.foco.visible);
    inv.cartas.forEach((c) => { assert.ok(!c.visible); assert.equal(c.rotation.x, 0); });
    inv.fichas.forEach((f) => assert.ok(!f.visible));
  }
  assert.ok(!puesta.ocupado, 'y no queda movimiento pendiente');
});

// ---------- cableado ----------

test('la TV reproduce el corto y le pasa la duración real de cada frase', () => {
  const tv = leer('web/tv/index.html');
  assert.match(tv, /crearCorto\(/);
  assert.match(tv, /fetch\('\/api\/corto'\)/);
  assert.match(tv, /if \(corto\) return corto\.abrir\(\{ expres \}\)/);
  // La duración viaja desde el audio hasta el corto, sin estimar.
  assert.match(leer('web/shared/voz.js'), /alEmpezar\?\.\(buffer\.duration\)/);
  assert.match(leer('web/shared/narrador.js'), /alEmpezar: \(duracion\) => ganchos\.alEmpezarFrase\?\.\(texto, duracion\)/);
  assert.match(tv, /alEmpezarFrase: \(texto, duracion\)/);
});

test('el guion se sirve sin las respuestas del test', () => {
  const indice = leer('server/index.js');
  assert.match(indice, /\/api\/corto/);
  const bloque = indice.match(/app\.get\('\/api\/corto',[\s\S]*?\}\);/)[0];
  assert.ok(!bloque.includes('comprension'), 'las respuestas no se mandan a la TV');
  assert.match(leer('server/juego.js'), /cortoPublico/);
});

test('el panel puede pedir la versión exprés', () => {
  assert.match(leer('server/ws.js'), /admin\.explicarExpres/);
  assert.match(leer('web/admin/index.html'), /admin\.explicarExpres/);
});

test('el pre-renderizador cubre el corto, completo y exprés', () => {
  const t = leer('tools/prerenderizar.mjs');
  assert.match(t, /corto\.capitulos/);
  assert.match(t, /paso\.textoExpres/);
});
