// Voz neuronal: es opcional, y el juego no puede depender de ella.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearVozNeural } from '../server/voz-neural.js';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8');

test('sin modelo instalado, la voz neuronal se reporta apagada y no revienta', () => {
  const voz = crearVozNeural({
    carpetaModelos: join(raiz, 'no-existe-esta-carpeta'),
    carpetaCache: join(raiz, 'data/voz'),
    log: { info: () => {}, warn: () => {} }
  });
  assert.equal(voz.disponible, false);
  assert.ok(['sin-paquete', 'sin-modelo', 'modelo-incompleto', 'fallo-al-cargar'].includes(voz.motivo));
  assert.equal(typeof voz.sintetizar, 'function', 'la interfaz se mantiene aunque esté apagada');
});

test('el servidor responde 404 en /api/voz cuando no hay voz neuronal', () => {
  const index = leer('server/index.js');
  assert.match(index, /SIN_VOZ_NEURAL/);
  assert.match(index, /vozNeural\.disponible/);
  // Y el cliente cae solo a la voz del navegador.
  assert.match(leer('web/shared/narrador.js'), /decirConNavegador/);
  assert.match(leer('web/shared/voz.js'), /if \(!respuesta\.ok\) return null/);
});

test('la voz neuronal es dependencia opcional, no obligatoria', () => {
  const paquete = JSON.parse(leer('package.json'));
  assert.deepEqual(Object.keys(paquete.dependencies).sort(),
    ['@fastify/static', '@fastify/websocket', 'fastify', 'qrcode'],
    'las obligatorias siguen siendo cuatro y puras');
  assert.ok(paquete.optionalDependencies['sherpa-onnx-node'], 'la neuronal va aparte');
});

test('el grupier suena más grande que el explicador, y es configurable', () => {
  const { voces } = JSON.parse(leer('config/narrador.json'));
  const g = voces.grupier.efectos, e = voces.explicador.efectos;

  assert.ok(g.velocidad < e.velocidad, 'se reproduce más lento: tono y formantes abajo');
  assert.ok(g.reverb > e.reverb && g.preRetardo > e.preRetardo, 'más sala, y más grande');
  assert.ok(g.graves > e.graves && g.pecho > e.pecho, 'más cuerpo');
  assert.ok(g.sombra > 0 && g.susurro > 0, 'sombra y susurro son suyos');
  assert.equal(e.sombra, 0, 'el explicador tiene que entenderse, no imponer');
  assert.ok(g.sibilancia < 0 && e.sibilancia < 0, 'los sintetizadores sisean: hay que bajarlo');
});

test('el tono baja sin arrastrar el habla: se sintetiza rápido y se reproduce lento', () => {
  const { voces } = JSON.parse(leer('config/narrador.json'));
  const sintesis = voces.grupier.sintesis.velocidad;
  const reproduccion = voces.grupier.efectos.velocidad;
  assert.ok(sintesis > 1, 'el servidor lo genera acelerado');
  assert.ok(reproduccion < 1, 'y el navegador lo reproduce lento');
  const neto = sintesis * reproduccion;
  assert.ok(neto > 0.9 && neto < 1.05, `la velocidad neta del habla queda natural (${neto.toFixed(2)})`);
  // Y el servidor tiene que estar leyendo ese valor, no uno fijo.
  assert.match(leer('server/voz-neural.js'), /sintesis\?\.velocidad/);
});

test('la cadena del grupier tiene las capas que la hacen sonar a personaje', () => {
  const voz = leer('web/shared/voz.js');
  for (const pieza of ['createDynamicsCompressor', 'createConvolver', 'createWaveShaper',
                       'createDelay', 'createStereoPanner', 'detune']) {
    assert.match(voz, new RegExp(pieza), `falta ${pieza}`);
  }
  assert.match(voz, /preRetardo/, 'la sala necesita pre-retardo o suena a lata');
  assert.match(voz, /alAgacharAmbiente/, 'la música se agacha mientras habla');
  assert.match(leer('web/shared/audio.js'), /export function ambienteAgachar/);
});

test('la boca se mueve con la amplitud real del audio', () => {
  const voz = leer('web/shared/voz.js');
  assert.match(voz, /createAnalyser/);
  assert.match(voz, /getByteTimeDomainData/);
  assert.match(voz, /alNivel\?\.\(/);
  // Y el personaje 3D lo recibe.
  assert.match(leer('web/tv/grupier3d.js'), /nivel\(v\)/);
  assert.match(leer('web/tv/index.html'), /alNivel: \(n\) => actor\.nivel\(n\)/);
});

test('el descargador de la voz usa fuentes con licencia permisiva', () => {
  const script = leer('tools/descargar-voz.mjs');
  assert.match(script, /es_MX-claude-high/);
  assert.match(script, /Apache-2\.0/);
  assert.match(script, /github\.com\/k2-fsa\/sherpa-onnx/);
});

test('si el modelo está instalado, genera audio en español', { skip: !existsSync(join(raiz, 'modelos')) }, async () => {
  const voz = crearVozNeural({
    carpetaModelos: join(raiz, 'modelos'),
    carpetaCache: join(raiz, 'data/voz'),
    log: { info: () => {}, warn: () => {} }
  });
  if (!voz.disponible) return;    // en un PC sin el modelo, esta prueba no aplica
  const archivo = await voz.sintetizar('Prueba de voz del grupier.', 'grupier');
  assert.ok(archivo && existsSync(archivo));
  const cabecera = readFileSync(archivo).subarray(0, 4).toString();
  assert.equal(cabecera, 'RIFF', 'debe ser un WAV válido');
});
