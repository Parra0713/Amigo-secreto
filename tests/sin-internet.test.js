// Verifica que el proyecto no dependa de internet: ningún recurso externo
// en las páginas, y ninguna dependencia nativa o de CDN.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));

/**
 * Recorre carpetas. Se saltan dos:
 *  - 'vendor': librerías de terceros servidas desde el propio PC.
 *  - 'laboratorio': herramienta de comparación de voces, no es parte del juego.
 *    Sus muestras .wav las generamos nosotros con nuestros propios modelos.
 */
function archivosDe(carpeta, extensiones, { incluirVendor = false } = {}) {
  const salida = [];
  for (const entrada of readdirSync(carpeta)) {
    if (!incluirVendor && (entrada === 'vendor' || entrada === 'laboratorio')) continue;
    const ruta = join(carpeta, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivosDe(ruta, extensiones, { incluirVendor }));
    else if (extensiones.some((e) => entrada.endsWith(e))) salida.push(ruta);
  }
  return salida;
}

test('ninguna página web carga recursos de internet', () => {
  const archivos = archivosDe(join(raiz, 'web'), ['.html', '.js', '.css']);
  assert.ok(archivos.length >= 8, 'deben existir las páginas');

  for (const ruta of archivos) {
    const contenido = readFileSync(ruta, 'utf8');
    // Se buscan URLs absolutas en atributos o imports: eso sería una llamada a internet.
    const sospechosas = contenido.match(/(src|href|from|import|url)\s*[=(]?\s*["'(]?(https?:)?\/\/[^"')\s]+/gi) || [];
    const reales = sospechosas.filter((u) => !/\/\/www\.w3\.org\/2000\/svg/.test(u)); // namespace XML, no es una descarga
    assert.deepEqual(reales, [], `${ruta} carga algo externo: ${reales.join(', ')}`);
  }
});

test('no se usan fuentes, CDNs ni APIs externas conocidas', () => {
  const archivos = archivosDe(join(raiz, 'web'), ['.html', '.js', '.css']);
  const prohibidos = ['fonts.googleapis', 'cdn.jsdelivr', 'unpkg.com', 'cdnjs', 'googleapis.com', 'gstatic', 'api.openai', 'ollama'];
  for (const ruta of archivos) {
    const contenido = readFileSync(ruta, 'utf8').toLowerCase();
    for (const p of prohibidos) assert.ok(!contenido.includes(p), `${ruta} menciona ${p}`);
  }
});

test('las librerías de terceros están vendorizadas localmente, con su licencia', () => {
  const tres = join(raiz, 'web/shared/vendor/three');
  for (const archivo of ['three.module.js', 'three.core.js', 'LICENSE']) {
    const ruta = join(tres, archivo);
    assert.ok(statSync(ruta).size > 500, `falta o está vacío ${archivo}`);
  }
  assert.match(readFileSync(join(tres, 'LICENSE'), 'utf8'), /MIT/);
  // Y se importa por ruta local, nunca desde un CDN.
  const grupier = readFileSync(join(raiz, 'web/tv/grupier3d.js'), 'utf8');
  assert.match(grupier, /from '\.\.\/shared\/vendor\/three\/three\.module\.js'/);
});

test('el servidor solo depende de paquetes puros (sin módulos nativos)', () => {
  const paquete = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(paquete.dependencies).sort(),
    ['@fastify/static', '@fastify/websocket', 'fastify', 'qrcode']);
  assert.equal(paquete.devDependencies, undefined, 'las pruebas usan node:test, sin dependencias');
});

test('la fuente tipográfica es del sistema, no descargada', () => {
  const css = readFileSync(join(raiz, 'web/shared/estilos.css'), 'utf8');
  assert.ok(css.includes('system-ui'));
  assert.ok(!css.includes('@font-face'), 'una @font-face implicaría un archivo o una descarga');
});

test('el juego no trae archivos de audio: los sonidos se sintetizan en el navegador', () => {
  // Se excluye el laboratorio: sus muestras son audio que generamos nosotros
  // para comparar motores, no recursos del juego ni de terceros.
  const audio = archivosDe(join(raiz, 'web'), ['.mp3', '.wav', '.ogg', '.m4a']);
  assert.deepEqual(audio, []);
  const js = readFileSync(join(raiz, 'web/shared/audio.js'), 'utf8');
  assert.ok(js.includes('AudioContext'));
});

test('las dependencias no se quedan en versiones con vulnerabilidad conocida', () => {
  const paquete = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
  // @fastify/static <= 10.1.8 permitía salirse de la carpeta servida. El
  // servidor corre en el WiFi de la casa con data/ al lado: no es teórico.
  const estatico = paquete.dependencies['@fastify/static'];
  const menor = Number(estatico.replace(/[^0-9.]/g, '').split('.')[0]);
  assert.ok(menor >= 10, `@fastify/static ${estatico} tiene la ruta transitable arreglada en la 10.1.12`);
});
