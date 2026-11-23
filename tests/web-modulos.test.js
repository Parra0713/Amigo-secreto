/* ============================================================
   Guarda contra un error que ya se colió dos veces: usar una
   función de otro módulo del proyecto sin importarla.

   `node --check` no lo ve (es sintaxis válida) y el navegador solo
   lo cuenta en consola, en tiempo de ejecución: el grupier 3D se
   caía al respaldo plano con "crearPuesta is not defined" y desde
   la sala eso se ve como "volvió al 2D".

   Esta prueba junta lo que exporta cada módulo de web/ y revisa que
   quien lo llame lo haya importado o lo defina en su propio archivo.
   ============================================================ */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const web = join(raiz, 'web');

/** Todos los archivos de web/, sin las librerías de terceros. */
function archivos(dir, acumulado = []) {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (entrada === 'vendor' || entrada === 'muestras') continue;
    if (statSync(ruta).isDirectory()) archivos(ruta, acumulado);
    else if (/\.(js|html)$/.test(entrada)) acumulado.push(ruta);
  }
  return acumulado;
}

/** El código de un archivo: el módulo entero, o los <script type="module">. */
function codigoDe(ruta) {
  const texto = readFileSync(ruta, 'utf8');
  if (ruta.endsWith('.js')) return texto;
  return [...texto.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join('\n');
}

const todos = archivos(web);

/** Nombre -> archivo que lo exporta. */
const exportados = new Map();
for (const ruta of todos.filter((r) => r.endsWith('.js'))) {
  const codigo = readFileSync(ruta, 'utf8');
  for (const m of codigo.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    exportados.set(m[1], relative(web, ruta));
  }
}

test('hay exportaciones que vigilar (si no, la prueba no prueba nada)', () => {
  assert.ok(exportados.size >= 10, `solo encontré ${exportados.size} exportaciones`);
  for (const esperada of ['crearPuesta', 'crearIntro', 'crearCorto', 'crearGrupier3D', 'decir']) {
    assert.ok(exportados.has(esperada), `debería haber encontrado ${esperada}`);
  }
});

test('nadie llama a una función de otro módulo sin importarla', () => {
  const problemas = [];

  for (const ruta of todos) {
    const codigo = codigoDe(ruta);
    if (!codigo.trim()) continue;
    const nombre = relative(web, ruta);

    // Lo que este archivo trae de afuera.
    const importado = new Set();
    for (const m of codigo.matchAll(/import\s+(?:\*\s+as\s+([\w$]+)|{([^}]+)}|([\w$]+))\s+from/g)) {
      if (m[1]) importado.add(m[1]);
      if (m[3]) importado.add(m[3]);
      if (m[2]) m[2].split(',').forEach((parte) => {
        const limpio = parte.trim().split(/\s+as\s+/).pop().trim();
        if (limpio) importado.add(limpio);
      });
    }

    // Lo que define por su cuenta (incluido lo que desestructura).
    const propio = new Set();
    for (const m of codigo.matchAll(/(?:^|\s)(?:async\s+)?function\s+([\w$]+)/g)) propio.add(m[1]);
    for (const m of codigo.matchAll(/(?:const|let|var)\s+([\w$]+)\s*=/g)) propio.add(m[1]);
    for (const m of codigo.matchAll(/class\s+([\w$]+)/g)) propio.add(m[1]);
    for (const m of codigo.matchAll(/(?:const|let|var)\s*{([^}]+)}\s*=/g)) {
      m[1].split(',').forEach((parte) => {
        const limpio = parte.trim().split(/[:=]/).pop().trim();
        if (/^[\w$]+$/.test(limpio)) propio.add(limpio);
      });
    }

    for (const [funcion, dueño] of exportados) {
      if (relative(web, ruta) === dueño) continue;        // es su propia casa
      if (importado.has(funcion) || propio.has(funcion)) continue;
      // Llamada directa: ni método (x.f()) ni clave de objeto (f:).
      const llamada = new RegExp(`(?<![\\w.$])${funcion}\\s*\\(`);
      if (llamada.test(codigo)) {
        problemas.push(`${nombre} llama a ${funcion}() y no lo importa (vive en ${dueño})`);
      }
    }
  }

  assert.deepEqual(problemas, [], `\n  ${problemas.join('\n  ')}\n`);
});
