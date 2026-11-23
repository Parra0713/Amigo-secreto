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

test('los dos personajes siguen siendo distinguibles, aunque la cadena se podó', () => {
  const { voces } = JSON.parse(leer('config/narrador.json'));
  const g = voces.grupier.efectos, e = voces.explicador.efectos;

  // Los dos usan la voz que ganó a ciegas (em_santa): era la única probada,
  // también en el papel del explicador y con música encima. Así que la
  // diferencia la hace el registro, no el timbre.
  assert.equal(voces.grupier.neural.voz, voces.explicador.neural.voz);
  assert.ok(voces.explicador.neural.velocidad > voces.grupier.neural.velocidad,
    'el explicador habla más rápido que el grupier');

  // Y queda una diferencia de tono y de espacio, mucho más leve que antes.
  assert.ok(g.velocidad < e.velocidad, 'el grupier sigue algo más lento y grave');
  assert.ok(g.graves > e.graves, 'y con algo más de cuerpo');
  assert.ok(g.reverb > e.reverb, 'y con algo más de sala');
  assert.ok(g.sibilancia < 0 && e.sibilancia < 0, 'los sintetizadores sisean: hay que bajarlo');
});

test('la poda de efectos está documentada con la evidencia que la motivó', () => {
  const { voces } = JSON.parse(leer('config/narrador.json'));
  const notas = `${voces.notas} ${voces.grupier.efectos.notas}`;
  assert.match(notas, /ciegas/, 'debe decir por qué se podó');
  // Lo que se quitó, se quitó del todo: no quedan restos a medias.
  for (const campo of ['sombra', 'susurro', 'saturacion', 'eco', 'nivelDoble']) {
    assert.equal(voces.grupier.efectos[campo], 0, `${campo} debe quedar en cero`);
  }
});
test('la cadena de efectos sigue existiendo, por si hay que volver a subirla', () => {
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

test('el banco pre-renderizado guarda varias tomas y no repite la última', async () => {
  const voz = crearVozNeural({
    carpetaModelos: join(raiz, 'modelos'),
    carpetaCache: join(raiz, 'data/voz'),
    config: JSON.parse(leer('config/narrador.json')).voces,
    log: { info: () => {}, warn: () => {} }
  });
  if (!voz.disponible) return;   // en un PC sin modelo, esta prueba no aplica

  const frase = 'Prueba del banco de voz, dos tomas.';
  await voz.prerenderizar([{ texto: frase, personaje: 'grupier' }], { tomas: 2 });

  const servidas = new Set();
  let previa = null;
  for (let i = 0; i < 6; i++) {
    const ruta = await voz.sintetizar(frase, 'grupier');
    assert.ok(ruta && existsSync(ruta));
    assert.notEqual(ruta, previa, 'no puede sonar dos veces seguidas la misma toma');
    servidas.add(ruta);
    previa = ruta;
  }
  assert.equal(servidas.size, 2, 'debe alternar entre las dos tomas');
});

test('cambiar de motor invalida el banco viejo en vez de servir audio equivocado', () => {
  const fuente = leer('server/voz-neural.js');
  // La clave del banco incluye motor y voz: si cambian, las rutas cambian.
  assert.match(fuente, /\$\{v\.motor\}:\$\{v\.sid\}/);
  assert.match(fuente, /`\$\{personaje\}-\$\{v\.motor\}-/);
});

test('el identificador de voz se ajusta al motor que realmente se usa', () => {
  // Piper tiene una sola voz; pasarle el id de una voz de Kokoro es un error.
  assert.match(leer('server/voz-neural.js'), /const sid = usado === 'kokoro' \? voz\.sid : 0/);
});

test('las voces se eligieron por escucha a ciegas, y queda registrado', () => {
  const { voces } = JSON.parse(leer('config/narrador.json'));
  assert.equal(voces.grupier.neural.motor, 'kokoro');
  assert.equal(voces.explicador.neural.motor, 'kokoro');
  // Prueba 3 y 4 del laboratorio: Kokoro em_santa (sid 53) ganó 6-0 sobre Piper,
  // incluida la comparación del explicador con la música encima.
  assert.equal(voces.grupier.neural.sid, 53);
  assert.equal(voces.explicador.neural.sid, 53, 'el tutorial usa la voz que ganó');
  // La cadena de efectos quedó podada tras empatar contra la voz cruda.
  assert.equal(voces.grupier.efectos.sombra, 0);
  assert.equal(voces.grupier.efectos.susurro, 0);
  assert.equal(voces.grupier.efectos.saturacion, 0);
  assert.ok(voces.grupier.efectos.reverb <= 0.15, 'queda apenas un toque de sala');
});

test('el pre-renderizador solo toma frases que se pueden saber de antemano', () => {
  const fuente = leer('tools/prerenderizar.mjs');
  assert.match(fuente, /\\\{\[a-zA-Z\]\+\\\}/, 'descarta las frases con variables');
  assert.match(fuente, /frasesConApodo|explicacion/);
  // Y las que nombran jugadores se generan al registrarse.
  assert.match(leer('server/index.js'), /alRegistrarJugador/);
  assert.match(leer('server/juego.js'), /frasesConApodo/);
});
