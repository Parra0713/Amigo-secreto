/* Genera el banco de voz con el motor bueno, antes de jugar.
   Uso:  npm run voces            (2 tomas por frase)
         npm run voces -- 3       (3 tomas: más variedad, más tiempo)

   Por qué existe: Kokoro suena claramente mejor que Piper —ganó 6-0 en la
   escucha a ciegas— pero corre a poco más de tiempo real, así que no sirve
   para hablar en vivo. Como el banco de frases es fijo, se genera antes y en
   la partida solo se reproduce. */

import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearVozNeural } from '../server/voz-neural.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const tomas = Math.max(1, Math.min(4, Number(process.argv[2]) || 2));

const narrador = JSON.parse(readFileSync(join(raiz, 'config/narrador.json'), 'utf8'));

/** Todas las frases que se pueden saber de antemano. */
function frasesFijas() {
  const frases = [];
  const agregar = (texto, personaje) => {
    const limpio = String(texto || '').trim();
    // Las frases con variables ({apodo}) se generan cuando se conocen los nombres.
    if (limpio && !/\{[a-zA-Z]+\}/.test(limpio)) frases.push({ texto: limpio, personaje });
  };

  for (const opciones of Object.values(narrador.eventos || {})) {
    for (const texto of opciones) agregar(texto, 'grupier');
  }
  for (const paso of narrador.explicacion?.pasos || []) {
    agregar(paso.texto, paso.voz || 'explicador');
  }
  for (const ronda of Object.values(narrador.rondas || {})) {
    for (const parte of Object.values(ronda.entrada || {})) agregar(parte.texto ?? parte, parte.voz || 'grupier');
  }
  return frases;
}

const voz = crearVozNeural({
  carpetaModelos: join(raiz, 'modelos'),
  carpetaCache: join(process.env.CARPETA_DATOS || join(raiz, 'data'), 'voz'),
  config: narrador.voces,
  log: { info: () => {}, warn: (m) => console.log(`  aviso: ${m}`) }
});

if (!voz.disponible) {
  console.log(`\n[X] No hay motor de voz (${voz.motivo}).`);
  console.log('    Corre descargar-voz.bat y vuelve a intentar.\n');
  process.exit(1);
}

const frases = frasesFijas();
const estado = voz.estado();

console.log('\n============================================');
console.log('   PREPARANDO LAS VOCES DEL JUEGO');
console.log('============================================\n');
console.log(`  Motores:   ${estado.motores.join(', ')}`);
console.log(`  Modelos:   ${Object.values(estado.modelos).join(', ')}`);
console.log(`  Frases:    ${frases.length}  ·  ${tomas} tomas cada una`);
console.log(`  Ya había:  ${estado.frasesEnBanco} frases en el banco\n`);
console.log('  Esto tarda unos minutos y solo hay que hacerlo una vez.');
console.log('  Puedes dejarlo corriendo mientras haces otra cosa.\n');

const inicio = Date.now();
let ultimoAnuncio = 0;

const { generadas, saltadas } = await voz.prerenderizar(frases, {
  tomas,
  alAvanzar(hechas, total) {
    const pct = Math.floor((hechas / total) * 100);
    if (pct >= ultimoAnuncio + 5 || hechas === total) {
      ultimoAnuncio = pct;
      const transcurrido = (Date.now() - inicio) / 1000;
      const restante = hechas > 0 ? (transcurrido / hechas) * (total - hechas) : 0;
      const barra = '█'.repeat(Math.floor(pct / 4)).padEnd(25, '·');
      process.stdout.write(`\r  [${barra}] ${String(pct).padStart(3)}%  ${hechas}/${total}` +
        (restante > 1 ? `  quedan ~${Math.ceil(restante / 60)} min   ` : '                '));
    }
  }
});

const carpetaBanco = join(process.env.CARPETA_DATOS || join(raiz, 'data'), 'voz', 'banco');
let bytes = 0;
try {
  for (const f of readdirSync(carpetaBanco)) bytes += statSync(join(carpetaBanco, f)).size;
} catch {}

console.log('\n');
console.log(`  Listo en ${Math.round((Date.now() - inicio) / 1000)} segundos.`);
console.log(`  ${generadas} audios nuevos, ${saltadas} frases ya estaban.`);
console.log(`  El banco ocupa ${(bytes / 1024 / 1024).toFixed(1)} MB en data/voz/banco.`);

// Cambiar de voz o de motor deja atrás los audios viejos: la clave del banco
// incluye motor y voz, así que no se sirven, solo ocupan disco.
const sobra = voz.huerfanos(frases);
if (sobra.archivos.length) {
  const mb = (sobra.bytes / 1024 / 1024).toFixed(1);
  if (process.argv.includes('--limpiar')) {
    const { borrados } = voz.limpiarBanco(frases);
    console.log(`  Se borraron ${borrados} audios de voces anteriores (${mb} MB liberados).`);
  } else {
    console.log(`  Sobran ${sobra.archivos.length} audios de voces anteriores (${mb} MB).`);
    console.log('  Córrelo con  npm run voces -- --limpiar  para borrarlos.');
  }
}
console.log('');
console.log('  Arranca el juego con iniciar.bat: el grupier ya habla con la voz buena.\n');
