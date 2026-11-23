// La escena 3D se arma sin WebGL, así que se puede probar aquí.
// Esta prueba existe por un error real: una asignación a `position` (que en
// Three.js es de solo lectura) lanzaba al construir la silla, el try/catch de
// la TV lo atrapaba y el grupier "volvía al 2D" sin decir por qué.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const THREE = await import(new URL('../web/shared/vendor/three/three.module.js', import.meta.url));
const { construirEscena } = await import(new URL('../web/tv/grupier3d.js', import.meta.url));

test('la escena se construye completa, sin lanzar', () => {
  const e = construirEscena(THREE, {});
  assert.ok(e.escena.children.length > 5, 'la escena tiene contenido');
  assert.ok(e.personaje && e.capucha && e.boca);
});

test('el rostro y los ojos quedan por fuera del casco: si no, no hay punto focal', () => {
  const { capucha, boca } = construirEscena(THREE, {});
  const ojos = capucha.children.filter((o) => o.isMesh && o.geometry?.type === 'SphereGeometry' && o.geometry.parameters.radius < 0.1);
  assert.equal(ojos.length, 2, 'dos ojos');
  for (const ojo of ojos) assert.ok(ojo.position.z > 0.2, 'el ojo mira hacia adelante, fuera del casco');
  assert.ok(boca.position.z > 0.2);
});

test('la capucha es un casco ABIERTO por delante, no un cono cerrado', () => {
  const { casco } = construirEscena(THREE, {});
  assert.equal(casco.geometry.type, 'LatheGeometry');
  const { phiLength } = casco.geometry.parameters;
  assert.ok(phiLength < Math.PI * 2 - 0.1, 'tiene que quedar un sector abierto para la cara');
  assert.equal(casco.material.side, THREE.DoubleSide, 'se ve por dentro del capuchón');
});

test('hay luz fría de clave, vela cálida de apoyo y realce dorado de borde', () => {
  const { escena } = construirEscena(THREE, {});
  const luces = escena.children.filter((o) => o.isLight);
  assert.ok(luces.length >= 4, 'clave, vela, borde y ambiente');
  const vela = escena.getObjectByName('vela');
  assert.ok(vela?.isPointLight, 'la vela tiene nombre: la animación la busca por ahí');
  assert.ok(vela.intensity < 5, 'la vela es apoyo, no clave: con 7 aplastaba la paleta a café');
});

test('en modo silueta no hay luces y todo es negro plano', () => {
  const { escena } = construirEscena(THREE, { silueta: true });
  assert.equal(escena.children.filter((o) => o.isLight).length, 0);
  const mallas = [];
  escena.traverse((o) => { if (o.isMesh) mallas.push(o); });
  for (const m of mallas) {
    if (m.material.transparent) continue;
    assert.equal(m.material.color.getHex(), 0x000000, 'relleno negro para auditar la silueta');
  }
});

test('la utilería de la explicación arranca escondida', () => {
  const { fichasPila, cartaFalsa, puertas, fantasma } = construirEscena(THREE, {});
  for (const f of fichasPila) assert.equal(f.visible, false);
  assert.equal(cartaFalsa.visible, false);
  for (const p of puertas) assert.equal(p.visible, false);
  assert.equal(fantasma.visible, false);
});

test('el personaje y el escenario usan solo la paleta de 3 + 1 acento (§5.3)', () => {
  const fuente = readFileSync(new URL('../web/tv/grupier3d.js', import.meta.url), 'utf8');
  const paleta = fuente.match(/const PALETA = \{([^}]+)\}/s)[1].match(/0x[0-9a-f]{6}/g);
  assert.equal(paleta.length, 4, 'tres principales + acento, y nada más');

  const permitidos = new Set(paleta.map((c) => parseInt(c, 16)));
  const { escena, cartaFalsa, fantasma } = construirEscena(THREE, {});
  const utileria = new Set([cartaFalsa.uuid, fantasma.uuid]);

  escena.traverse((o) => {
    if (!o.isMesh || utileria.has(o.uuid)) return;         // la utilería va aparte
    assert.ok(permitidos.has(o.material.color.getHex()),
      `color fuera de PALETA: #${o.material.color.getHexString()}`);
  });
});

test('la utilería narrativa tiene su propia paleta, declarada y justificada', () => {
  const fuente = readFileSync(new URL('../web/tv/grupier3d.js', import.meta.url), 'utf8');
  const bloque = fuente.match(/const PALETA_UTILERIA = \{([^}]+)\}/s);
  assert.ok(bloque, 'los colores de la utilería no pueden estar sueltos en el código');
  // Cada color lleva al lado por qué existe: §4.1, cero elementos gratuitos.
  for (const linea of bloque[1].split('\n').filter((l) => l.includes('0x'))) {
    assert.match(linea, /\/\/\s*\S+/, `sin justificación: ${linea.trim()}`);
  }
  assert.ok((bloque[1].match(/0x[0-9a-f]{6}/g) || []).length <= 4, 'la excepción no puede crecer');
});

test('hay gestos para cada ilustración del guion', () => {
  const fuente = readFileSync(new URL('../web/tv/grupier3d.js', import.meta.url), 'utf8');
  const narrador = JSON.parse(readFileSync(new URL('../config/narrador.json', import.meta.url), 'utf8'));
  for (const paso of narrador.explicacion.pasos) {
    assert.match(fuente, new RegExp(`case '${paso.ilustracion}'`), `falta el gesto ${paso.ilustracion}`);
  }
});

test('la TV avisa en consola si el 3D no arranca, en vez de callarse', () => {
  const html = readFileSync(new URL('../web/tv/index.html', import.meta.url), 'utf8');
  assert.match(html, /console\.warn\('El grupier 3D no pudo arrancar/);
});
