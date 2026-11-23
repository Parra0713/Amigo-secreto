// Azar reproducible: misma semilla => misma partida. Nada de Math.random en engine/.

/** Convierte un texto en una semilla numérica (xfnv1a). */
export function semillaDesdeTexto(texto) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** PRNG mulberry32: devuelve una función que da números en [0,1). */
export function crearAzar(semilla) {
  let a = (typeof semilla === 'string' ? semillaDesdeTexto(semilla) : semilla) >>> 0;
  return function azar() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const entero = (azar, n) => Math.floor(azar() * n);
export const elegir = (azar, lista) => lista[entero(azar, lista.length)];

/** Fisher-Yates sin mutar la lista original. */
export function barajar(azar, lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = entero(azar, i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Empareja al azar; con número impar, el sobrante va en `sobrante`. */
export function emparejar(azar, ids) {
  const mezclados = barajar(azar, ids);
  const parejas = [];
  let sobrante = null;
  if (mezclados.length % 2 === 1) sobrante = mezclados.pop();
  for (let i = 0; i < mezclados.length; i += 2) parejas.push([mezclados[i], mezclados[i + 1]]);
  return { parejas, sobrante };
}
