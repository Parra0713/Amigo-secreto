// Revisa las reglas de interfaz de docs/HIG.md que se pueden verificar sin navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8');
const css = leer('web/shared/estilos.css');
const paginas = ['web/tv/index.html', 'web/play/index.html', 'web/admin/index.html'];

/** Igual que en sin-internet: 'vendor' es librería de terceros, no código del proyecto. */
const esDelProyecto = (ruta) => !ruta.includes('vendor');

test('el área mínima de toque es de 44 px y se aplica a los controles', () => {
  assert.match(css, /--toque:\s*44px/);
  const bloqueBoton = css.match(/\nbutton\{[^}]+\}/)[0];
  assert.match(bloqueBoton, /min-height:var\(--toque\)/);
  assert.match(bloqueBoton, /min-width:var\(--toque\)/);
  assert.match(css.match(/input,select,textarea\{[^}]+\}/)[0], /min-height:var\(--toque\)/);
  // El deslizador necesita pulgar grande: el riel de 6 px no es tocable.
  assert.match(css, /input\[type=range\]\{[^}]*min-height:var\(--toque\)/s);
});

test('la tipografía es del sistema, con cuerpo de 17 px y nada por debajo de 11 px', () => {
  assert.match(css, /-apple-system/);
  assert.match(css, /--txt-cuerpo:17px/);
  assert.match(css, /--txt-micro:11px/);
  assert.ok(!/font-size:\s*(?:[0-9]|10)px/.test(css), 'no debe haber texto menor a 11 px');
});

test('se respetan los ajustes de accesibilidad del sistema', () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /prefers-contrast:\s*more/);
  assert.match(css, /prefers-color-scheme:\s*light/);
  assert.match(css, /color-scheme:dark light/);
  assert.match(css, /:focus-visible\{[^}]*outline/);
});

test('hay zonas seguras para pantallas con muesca', () => {
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(leer('web/play/index.html'), /viewport-fit=cover/);
});

test('el estado nunca depende solo del color', () => {
  assert.match(css, /\.si::before\{content:"✓/);
  assert.match(css, /\.no::before\{content:"✗/);
});

test('no se usan diálogos del navegador para acciones destructivas', () => {
  for (const pagina of paginas) {
    const html = leer(pagina);
    assert.ok(!/\balert\s*\(/.test(html), `${pagina} usa alert()`);
    assert.ok(!/\bconfirm\s*\(/.test(html), `${pagina} usa confirm()`);
  }
  // La acción destructiva confirma en dos pasos, dentro de la página.
  const admin = leer('web/admin/index.html');
  assert.match(admin, /id="confirmaNueva"/);
  assert.match(admin, /boton destructivo/);
  assert.match(admin, /no se puede deshacer/i);
});

test('los campos de texto tienen etiqueta, no solo texto de ejemplo', () => {
  for (const pagina of ['web/play/index.html', 'web/admin/index.html']) {
    const html = leer(pagina);
    const campos = html.match(/<input[^>]*>/g) || [];
    for (const campo of campos) {
      if (/type="?(range|hidden)/.test(campo)) {
        assert.match(campo, /aria-label/, `${pagina}: deslizador sin aria-label`);
        continue;
      }
      const id = campo.match(/id="([^"]+)"/)?.[1];
      const tieneEtiqueta = (id && html.includes(`for="${id}"`))
        || /aria-label/.test(campo)
        || /class="(texto|otro)"/.test(campo);
      assert.ok(tieneEtiqueta, `${pagina}: campo sin etiqueta -> ${campo.slice(0, 70)}`);
    }
  }
});

test('los mensajes en vivo se anuncian a los lectores de pantalla', () => {
  for (const pagina of paginas) {
    assert.match(leer(pagina), /aria-live/, `${pagina} sin regiones en vivo`);
  }
  assert.match(leer('web/play/index.html'), /role="alert"/);
});

test('el icono y el manifiesto están completos', () => {
  const manifiesto = JSON.parse(leer('web/play/manifest.json'));
  assert.equal(manifiesto.lang, 'es-CO');
  assert.equal(manifiesto.display, 'standalone');
  assert.ok(manifiesto.name && manifiesto.short_name && manifiesto.description);
  assert.deepEqual(manifiesto.icons.map((i) => i.sizes), ['192x192', '512x512']);
  for (const archivo of ['apple-touch-icon.png', 'icono-192.png', 'icono-512.png']) {
    const ruta = join(raiz, 'web/play', archivo);
    assert.ok(existsSync(ruta), `falta ${archivo}`);
    assert.ok(statSync(ruta).size > 400, `${archivo} parece vacío`);
  }
  assert.match(leer('web/play/index.html'), /rel="apple-touch-icon"/);
});

test('la TV se mantiene en apariencia oscura a propósito', () => {
  assert.match(leer('web/tv/index.html'), /class="siempre-oscuro"/);
  assert.match(css, /:root:not\(\.siempre-oscuro\)/);
});

test('el guion de la presentación está completo y cubre las cuatro rondas', async () => {
  const narrador = JSON.parse(leer('config/narrador.json'));
  const pasos = narrador.explicacion.pasos;
  assert.ok(pasos.length >= 8, 'la explicación debe cubrir el juego entero');
  for (const paso of pasos) {
    assert.ok(paso.id && paso.titulo && paso.texto && paso.ilustracion, `paso incompleto: ${paso.id}`);
    assert.ok(paso.texto.length > 40, `${paso.id}: texto demasiado corto para narrar`);
  }
  for (const clave of ['ronda1', 'ronda2', 'ronda3', 'ronda4', 'fantasma', 'cierre']) {
    assert.ok(pasos.some((p) => p.id === clave), `falta el paso ${clave}`);
  }
  // Toda ilustración referida debe existir en el módulo de la presentación.
  const intro = leer('web/tv/intro.js');
  for (const paso of pasos) {
    assert.match(intro, new RegExp(`\\b${paso.ilustracion}:`), `intro.js no dibuja "${paso.ilustracion}"`);
  }
});

test('hay dos voces, y cada personaje suena distinto', () => {
  const { voces } = JSON.parse(leer('config/narrador.json'));
  const { grupier, explicador } = voces;

  assert.ok(grupier.pitch < 0.8, 'el grupier habla grave');
  assert.ok(grupier.rate < 1, 'y más lento de lo normal');
  assert.ok(grupier.pausaPunto > grupier.pausaFrase, 'pausa más larga al final de una idea');
  assert.deepEqual(grupier.idiomas.slice(0, 3), ['es-CO', 'es-MX', 'es-ES']);

  assert.ok(explicador.pitch > grupier.pitch + 0.3, 'el explicador es claramente más agudo');
  assert.ok(explicador.rate > grupier.rate, 'y más rápido: explica, no actúa');
  // Las listas de voces preferidas no se pisan: así cada uno agarra un timbre distinto.
  const compartidas = explicador.preferidas.filter((v) => grupier.preferidas.includes(v));
  assert.deepEqual(compartidas, [], 'si comparten preferidas, podrían sonar iguales');
});

test('cada paso de la explicación dice con qué voz se narra', () => {
  const { explicacion } = JSON.parse(leer('config/narrador.json'));
  for (const paso of explicacion.pasos) {
    assert.ok(['grupier', 'explicador'].includes(paso.voz), `${paso.id}: voz inválida`);
  }
  const porVoz = explicacion.pasos.reduce((acc, p) => ({ ...acc, [p.voz]: (acc[p.voz] || 0) + 1 }), {});
  assert.ok(porVoz.grupier >= 2 && porVoz.explicador >= 4, 'las dos voces deben participar');
  assert.equal(explicacion.pasos[0].voz, 'grupier', 'el grupier abre la noche');
  assert.equal(explicacion.pasos.at(-1).voz, 'grupier', 'y la cierra');
});

test('el troceo por frases es lo que hace que no suene a robot', async () => {
  const { trocear, duracionEstimada } = await import('../web/shared/narrador.js');
  const trozos = trocear('Alguien está mintiendo. Las fichas no mienten, las personas sí.');
  assert.equal(trozos.length, 3, 'punto y coma parten la frase');
  assert.equal(trozos[0].texto, 'Alguien está mintiendo.');
  assert.ok(trozos[0].pausa > trozos[1].pausa, 'tras un punto se espera más que tras una coma');
  assert.ok(duracionEstimada('una frase corta') >= 1200);
});

test('la herramienta de voces permite escoger y guardar una voz', () => {
  const html = leer('tools/voces.html');
  assert.match(html, /plan\.voz/, 'guarda la elección donde el narrador la lee');
  assert.match(html, /localService/, 'debe distinguir las voces locales de las que necesitan internet');
  assert.match(leer('web/shared/narrador.js'), /plan\.voz/);
});

test('la explicación usa el personaje 3D, no solo la lámina plana', () => {
  const intro = leer('web/tv/intro.js');
  const tv = leer('web/tv/index.html');

  // El personaje se mueve a la presentación y actúa cada paso.
  assert.match(tv, /montarPersonaje: \(caja\) => caja\.insertAdjacentElement/);
  assert.match(intro, /actor\?\.gesto\?\.\(paso\.ilustracion\)/);
  // Con 3D disponible, la ilustración plana se apaga: sobra.
  assert.match(intro, /actor\?\.disponible \? '' :/);
  // Y la caja del personaje ocupa toda la escena de la presentación.
  assert.match(intro, /\.intro \.personaje \.grupierCaja\{height:100%/);
});

test('cada lámina trae etiquetas con las cifras del juego', () => {
  const intro = leer('web/tv/intro.js');
  const narrador = JSON.parse(leer('config/narrador.json'));
  const bloque = intro.match(/const ETIQUETAS = \{(.+?)\n\};/s)[1];

  for (const paso of narrador.explicacion.pasos) {
    assert.match(bloque, new RegExp(`${paso.ilustracion}:`), `sin etiquetas: ${paso.ilustracion}`);
  }
  // A tres metros no se leen más de tres, ni frases largas.
  for (const fila of bloque.split('\n').filter((l) => l.includes('['))) {
    const textos = fila.match(/'[^']+'/g) || [];
    assert.ok(textos.length <= 3, `demasiadas etiquetas: ${fila.trim()}`);
    for (const t of textos) assert.ok(t.length <= 42, `etiqueta muy larga: ${t}`);
  }
  // Las cifras del juego tienen que aparecer, que es lo que la gente necesita.
  assert.match(bloque, /10 fichas/);
  assert.match(bloque, /Fácil · 1 ficha/);
  assert.match(bloque, /\+3/);
});
