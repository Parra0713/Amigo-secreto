/* Descarga la voz neuronal en español. Se corre UNA vez, con internet.
   Uso:  npm run voz        (o doble clic en descargar-voz.bat)

   Voz: es_MX-claude-high — Piper, licencia Apache-2.0, 22.050 Hz, ~65 MB.
   Se baja de los lanzamientos de sherpa-onnx en GitHub y se descomprime
   en modelos/. Después de esto, el juego ya no necesita internet nunca más. */

import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get } from 'node:https';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = join(raiz, 'modelos');

const VOCES = {
  kokoro: {
    nombre: 'kokoro-multi-lang-v1_0',
    descripcion: 'Kokoro-82M v1.0, Apache-2.0 (~350 MB) — la mejor, pero lenta: se usa para pre-renderizar',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2'
  },
  alta: {
    nombre: 'vits-piper-es_MX-claude-high',
    descripcion: 'Piper es_MX, Apache-2.0 (~65 MB) — rápida, sirve para frases imprevistas',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_MX-claude-high.tar.bz2'
  },
  liviana: {
    nombre: 'vits-piper-es_MX-ald-medium',
    descripcion: 'Piper es_MX, calidad media, Unlicense (~25 MB) — para PCs lentos',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_MX-ald-medium.tar.bz2'
  }
};

const cual = process.argv[2];
if (cual && !VOCES[cual]) {
  console.log(`\nNo conozco la voz "${cual}". Las que hay:\n`);
  for (const [clave, v] of Object.entries(VOCES)) console.log(`  ${clave.padEnd(9)} ${v.descripcion}`);
  console.log('\nUso: node tools/descargar-voz.mjs [kokoro|alta|liviana]\n');
  process.exit(1);
}
const elegida = VOCES[cual || 'alta'];

function descargar(url, destino, intentos = 5) {
  return new Promise((resolve, reject) => {
    const salida = createWriteStream(destino);
    get(url, { headers: { 'user-agent': 'plan-amigo-secreto' } }, (respuesta) => {
      if ([301, 302, 307, 308].includes(respuesta.statusCode) && intentos > 0) {
        salida.close();
        return resolve(descargar(respuesta.headers.location, destino, intentos - 1));
      }
      if (respuesta.statusCode !== 200) return reject(new Error(`HTTP ${respuesta.statusCode}`));

      const total = Number(respuesta.headers['content-length'] || 0);
      let hechos = 0;
      let ultimo = 0;
      respuesta.on('data', (trozo) => {
        hechos += trozo.length;
        const pct = total ? Math.floor((hechos / total) * 100) : 0;
        if (pct >= ultimo + 5) { ultimo = pct; process.stdout.write(`\r  descargando… ${pct}%   `); }
      });
      respuesta.pipe(salida);
      salida.on('finish', () => { salida.close(); process.stdout.write('\r  descargando… 100%  \n'); resolve(destino); });
    }).on('error', reject);
  });
}

async function principal() {
  console.log(`\nVoz del grupier: ${elegida.nombre}`);
  console.log(`  ${elegida.descripcion}\n`);

  mkdirSync(CARPETA, { recursive: true });
  const destinoFinal = join(CARPETA, elegida.nombre);
  if (existsSync(destinoFinal)) {
    console.log('Ya estaba descargada. Nada que hacer.');
    console.log(`  ${destinoFinal}\n`);
    return;
  }

  const comprimido = join(CARPETA, 'voz.tar.bz2');
  await descargar(elegida.url, comprimido);

  process.stdout.write('  descomprimiendo… ');
  try {
    // tar viene en Windows 10 y 11, en macOS y en Linux.
    execFileSync('tar', ['xf', comprimido, '-C', CARPETA], { stdio: 'pipe' });
  } catch (e) {
    console.log('\n[X] No se pudo descomprimir con tar.');
    console.log(`    Descomprime a mano ${comprimido} dentro de ${CARPETA}`);
    process.exit(1);
  }
  rmSync(comprimido, { force: true });
  console.log('listo\n');

  if (!existsSync(destinoFinal)) {
    console.log('[X] La carpeta esperada no apareció. Revisa el contenido de modelos/.');
    process.exit(1);
  }
  console.log('✓ Voz instalada. Arranca el juego con iniciar.bat y el grupier va a hablar con ella.');
  console.log('  Si quieres volver a la voz de Windows, borra la carpeta modelos/.\n');
}

principal().catch((e) => {
  console.log(`\n[X] Falló la descarga: ${e.message}`);
  console.log('    Revisa tu conexión y vuelve a intentar.');
  process.exit(1);
});
