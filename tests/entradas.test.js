/* Entradas de ronda: el grupier explica cada ronda antes de que corra el reloj.
   Se revisa el guion (lo que se oye) y el cableado (quién recibe qué). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8');
const narrador = JSON.parse(leer('config/narrador.json'));
const reglas = JSON.parse(leer('config/reglas.json'));
const FASES = ['ronda1', 'ronda2', 'ronda3', 'ronda4', 'revelacion'];

test('cada ronda tiene su entrada, y cada entrada sus tres momentos', () => {
  for (const fase of FASES) {
    const guion = narrador.rondas?.[fase];
    assert.ok(guion, `falta la entrada de ${fase}`);
    assert.ok(guion.titulo?.length > 2, `${fase} sin título`);
    assert.equal(guion.entrada.length, 3, `${fase} debe tener 3 momentos: qué pasa, qué ves, qué te conviene`);
    const voces = guion.entrada.map((p) => p.voz);
    // Abre el grupier (autoridad) y en el medio explica el explicador (claridad).
    assert.equal(voces[0], 'grupier', `${fase} debe abrir con el grupier`);
    assert.equal(voces[1], 'explicador', `${fase} debe explicar la mecánica con el explicador`);
  }
});

test('el texto de las entradas se puede pre-renderizar: nada de variables', () => {
  for (const fase of FASES) {
    for (const parte of narrador.rondas[fase].entrada) {
      assert.ok(parte.id && parte.ilustracion, `${fase}/${parte.id}: falta id o ilustración`);
      assert.ok(!/\{[a-zá-ú]+\}/i.test(parte.texto), `${fase}/${parte.id}: lleva {variable} y no entraría al banco de voz`);
      assert.ok(parte.texto.length <= 320, `${fase}/${parte.id}: demasiado largo para una lámina`);
      // Escrito para el oído: puntos o puntos suspensivos donde se respira.
      assert.match(parte.texto, /[.…?]/, `${fase}/${parte.id}: sin pausas marcadas`);
    }
  }
});

test('las etiquetas en pantalla son pocas y cortas (HIG-3D: la cifra se lee de lejos)', () => {
  for (const fase of FASES) {
    for (const parte of narrador.rondas[fase].entrada) {
      const etiquetas = parte.etiquetas || [];
      assert.ok(etiquetas.length <= 3, `${fase}/${parte.id}: más de 3 etiquetas`);
      etiquetas.forEach((e) => assert.ok(e.length <= 42, `${fase}/${parte.id}: etiqueta larga "${e}"`));
    }
  }
});

test('las entradas se pueden apagar y tienen tope de tiempo', () => {
  assert.equal(typeof reglas.automatico.explicarRondas, 'boolean');
  assert.ok(reglas.automatico.segundosMaximosEntrada >= 20);
});

test('el servidor espera a que la TV termine antes de arrancar el reloj', () => {
  const juego = leer('server/juego.js');
  const ws = leer('server/ws.js');
  // Sin explicación no se pierde el reloj: el if cubre los dos caminos.
  assert.match(juego, /if \(!explicarRonda\(estado\.fase\)\) iniciarRelojDeFase\(\)/);
  assert.match(juego, /esperandoEntrada/);
  assert.match(juego, /if \(esperandoEntrada\) return;/);       // nada avanza mientras se explica
  assert.match(juego, /segundosMaximosEntrada/);                // si la TV no responde, sigue sola
  assert.match(ws, /tv\.entradaLista/);
  assert.match(ws, /admin\.saltarEntrada/);
});

test('el guion completo no sale a los celulares: solo título', () => {
  const juego = leer('server/juego.js');
  const bloque = juego.match(/function explicarRonda[\s\S]*?\n  \}/)[0];
  const paraCelular = bloque.match(/if \(c\.rol === 'play'\) c\.enviar\(\{[^}]*\}\)/)[0];
  const paraTV = bloque.match(/else c\.enviar\(\{[^}]*\}\)/)[0];
  assert.ok(!/\bentrada:/.test(paraCelular), 'el celular no debe recibir el guion de la entrada');
  assert.ok(paraTV.includes('entrada: guion.entrada'), 'la TV sí debe recibirlo');
});

test('la TV reproduce la entrada y avisa cuando acaba', () => {
  const tv = leer('web/tv/index.html');
  assert.match(tv, /m\.t === 'entradaRonda'/);
  assert.match(tv, /abrirEntradaRonda/);
  assert.match(tv, /t: 'tv\.entradaLista'/);
  // Reutiliza la máquina de la presentación: personaje 3D, gestos y etiquetas.
  const bloque = tv.match(/function abrirEntradaRonda[\s\S]*?\n\}/)[0];
  assert.match(bloque, /montarPersonaje/);
  assert.match(bloque, /personaje: actor/);
  assert.match(bloque, /titulo/);
});

test('el celular manda mirar la TV mientras se explica', () => {
  const play = leer('web/play/index.html');
  assert.match(play, /m\.t === 'entradaRonda'/);
  assert.match(play, /explicandoRonda = true/);
  assert.match(play, /explicandoRonda = false/);
  assert.match(play, /Mira la TV/i);
  // Y no repinta el juego encima del aviso.
  assert.match(play, /paso === 'juego' && !explicandoRonda/);
});

test('las etiquetas propias de cada lámina tienen prioridad sobre el mapa general', () => {
  assert.match(leer('web/tv/intro.js'), /paso\.etiquetas \|\| ETIQUETAS\[paso\.ilustracion\]/);
});

test('nada adelanta una lámina antes de que se pueda leer', () => {
  const intro = leer('web/tv/intro.js');
  // Ficha por lámina: el aviso de una voz vieja no mueve la lámina nueva.
  assert.match(intro, /const mia = \+\+ficha/);
  assert.match(intro, /if \(mia !== ficha\) return/);
  // Tiempo mínimo en pantalla, aunque la voz termine antes.
  assert.match(intro, /minimo - \(Date\.now\(\) - t0\)/);
  // Y un tope, por si el audio nunca avisa que terminó.
  assert.match(intro, /tope = setTimeout/);
});

test('las entradas de ronda respiran más que la presentación', () => {
  const tv = leer('web/tv/index.html');
  const bloque = tv.match(/function abrirEntradaRonda[\s\S]*?\n\}/)[0];
  const pausa = Number(bloque.match(/pausa: (\d+)/)[1]);
  const minimo = Number(bloque.match(/minimo: (\d+)/)[1]);
  assert.ok(pausa >= 1000, 'un respiro entre momentos');
  assert.ok(minimo >= 4000, 'tiempo para leerlo desde el sofá');
});

test('la narración no habla encima de la explicación', () => {
  const tv = leer('web/tv/index.html');
  assert.match(tv, /if \(m\.voz && !explicando\(\)\) decir/);
  // Pero el texto sí se sigue viendo en la banda del narrador.
  const bloque = tv.match(/if \(m\.t === 'narrador'\)[\s\S]*?\n    \}/)[0];
  assert.match(bloque, /\$\('narracion'\)\.textContent = m\.texto/);
  assert.match(tv, /const explicando = \(\) =>/);
});
