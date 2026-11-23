/* La voz neuronal no puede congelar la partida: se genera en otro hilo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearVozNeural } from '../server/voz-neural.js';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8');

test('el servidor pide la voz en un hilo aparte', () => {
  assert.match(leer('server/index.js'), /enHilo:/);
  const neural = leer('server/voz-neural.js');
  assert.match(neural, /new Worker\(new URL\('\.\/voz-hilo\.js'/);
  assert.match(neural, /enHilo \? await generarFuera/);
  // Y el hilo no debe abrir otro hilo dentro de sí.
  assert.ok(!/enHilo:\s*true/.test(leer('server/voz-hilo.js')));
});

test('si el hilo se cae, la frase se genera igual en el principal', () => {
  const neural = leer('server/voz-neural.js');
  assert.match(neural, /hilo = 'roto'/);
  assert.match(neural, /HILO_CAIDO/);
  assert.match(neural, /return generar\(texto, personaje, opciones\)/);
});

test('el hilo no impide que el servidor cierre', () => {
  const neural = leer('server/voz-neural.js');
  assert.match(neural, /w\.unref\(\)/);
  assert.match(neural, /cerrar: async/);
  // El servidor lo cierra al apagarse.
  assert.match(leer('server/index.js'), /vozNeural\.cerrar/);
});

test('sin modelos, pedir voz en hilo no rompe nada', async () => {
  const voz = crearVozNeural({
    carpetaModelos: join(mkdtempSync(join(tmpdir(), 'voz-')), 'no-existe'),
    carpetaCache: mkdtempSync(join(tmpdir(), 'cache-')),
    log: { info: () => {}, warn: () => {} },
    enHilo: true
  });
  assert.equal(voz.disponible, false);
  assert.equal(await voz.sintetizar('hola'), null);
  await voz.cerrar?.();
});

test('con modelos instalados, el hilo devuelve audio de verdad', async (t) => {
  const modelos = join(raiz, 'modelos');
  if (!existsSync(modelos)) return t.skip('sin modelos instalados');
  const voz = crearVozNeural({
    carpetaModelos: modelos,
    carpetaCache: mkdtempSync(join(tmpdir(), 'cache-')),
    log: { info: () => {}, warn: () => {} },
    enHilo: true
  });
  if (!voz.disponible) return t.skip(`voz no disponible (${voz.motivo})`);
  const archivo = await voz.sintetizar('Prueba de hilo.', 'grupier');
  assert.ok(archivo && existsSync(archivo), 'debería haber un wav generado por el hilo');
  // Sin cerrar, el proceso de pruebas se queda esperando al hilo.
  await voz.cerrar();
});
