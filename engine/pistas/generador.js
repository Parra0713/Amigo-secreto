// Cuestionario -> pistas. Determinístico: con la misma semilla y las mismas
// respuestas, siempre sale exactamente lo mismo.

import { derivar } from './derivaciones.js';
import { barajar } from '../azar.js';

const NIVELES = ['facil', 'media', 'dificil'];

/** Normaliza para comparar respuestas entre jugadores. */
const clave = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Construye las candidatas de UN jugador.
 * identificacion: 0 = la comparte todo el grupo (descarta poco)
 *                 1 = es única en el grupo (identifica mucho)
 */
export function candidatasDe(jugadorId, { cuestionario, respuestas, jugadores }) {
  const mias = respuestas[jugadorId] || {};
  const total = Object.keys(jugadores).length;
  const salida = [];

  for (const pregunta of cuestionario.preguntas) {
    const valor = mias[pregunta.id];
    if (valor === undefined || valor === null || clave(valor) === '') continue;

    for (const plantilla of pregunta.plantillas) {
      const derivado = derivar(plantilla.derivacion, valor);
      if (clave(derivado) === '' || derivado === '?') continue;

      // ¿Cuántos jugadores comparten ESTE mismo valor derivado?
      let comparten = 0;
      for (const otroId of Object.keys(jugadores)) {
        const otroValor = (respuestas[otroId] || {})[pregunta.id];
        if (otroValor === undefined) continue;
        if (clave(derivar(plantilla.derivacion, otroValor)) === clave(derivado)) comparten++;
      }
      const identificacion = total > 1 ? 1 - (comparten - 1) / (total - 1) : 1;

      salida.push({
        preguntaId: pregunta.id,
        categoria: pregunta.categoria,
        nivelPlantilla: plantilla.nivel,
        texto: plantilla.texto.replace('{v}', derivado),
        valorDerivado: derivado,
        comparten,
        identificacion,
        puntaje: identificacion * (pregunta.peso ?? 1)
      });
    }
  }
  return salida;
}

/** Filtro de seguridad: una pista no puede delatar por nombre. */
export function esSegura(texto, jugadores) {
  const t = clave(texto);
  for (const j of Object.values(jugadores)) {
    for (const nombre of [j.apodo, j.nombre].filter(Boolean)) {
      const n = clave(nombre);
      if (n.length >= 3 && new RegExp(`(^|[^a-záéíóúñ])${n}([^a-záéíóúñ]|$)`, 'i').test(t)) return false;
    }
  }
  return true;
}

/**
 * Elige exactamente 1 fácil + 1 media + 1 difícil para un jugador.
 * Reglas: categorías distintas, preguntas distintas, y la fácil NUNCA puede
 * identificar a una sola persona (debe compartirla al menos otra).
 */
export function seleccionar(candidatas, { jugadores, azar }) {
  const seguras = barajar(azar, candidatas.filter((c) => esSegura(c.texto, jugadores)));
  const elegidas = {};
  const preguntasUsadas = new Set();
  const categoriasUsadas = new Set();
  const incidencias = [];

  const tomar = (nivel, filtro, orden) => {
    let pool = seguras.filter(
      (c) => !preguntasUsadas.has(c.preguntaId) && !categoriasUsadas.has(c.categoria) && filtro(c)
    );
    let relajada = false;
    if (pool.length === 0) {
      // Primero se relaja la categoría, después el nivel de plantilla.
      pool = seguras.filter((c) => !preguntasUsadas.has(c.preguntaId) && filtro(c));
      relajada = pool.length > 0;
      if (pool.length === 0) pool = seguras.filter((c) => !preguntasUsadas.has(c.preguntaId));
    }
    if (pool.length === 0) { incidencias.push(`sin candidata para ${nivel}`); return; }
    if (relajada) incidencias.push(`categoría repetida en ${nivel}`);
    const c = [...pool].sort(orden)[0];
    elegidas[nivel] = c;
    preguntasUsadas.add(c.preguntaId);
    categoriasUsadas.add(c.categoria);
  };

  // Difícil: la que más identifica. Fácil: la que menos, y nunca única.
  tomar('dificil', (c) => c.nivelPlantilla !== 'vago', (a, b) => b.puntaje - a.puntaje);
  tomar('facil',   (c) => c.comparten >= 2,            (a, b) => a.puntaje - b.puntaje);
  tomar('media',   () => true, (a, b) => Math.abs(a.identificacion - 0.5) - Math.abs(b.identificacion - 0.5));

  return { elegidas, incidencias, completo: NIVELES.every((n) => elegidas[n]) };
}

/**
 * Genera el montón de cada jugador. El montón de X lo forman las pistas
 * sobre QUIEN LE REGALA a X (su amigo secreto).
 */
export function generarMontones(estado, azar) {
  const { cuestionario, respuestas, jugadores, parejas, tarjetasManuales = {} } = estado;
  const montones = {};
  const resumen = {};

  for (const [dadorId, receptorId] of Object.entries(parejas)) {
    const candidatas = candidatasDe(dadorId, { cuestionario, respuestas, jugadores });
    const { elegidas, incidencias, completo } = seleccionar(candidatas, { jugadores, azar });
    const manuales = tarjetasManuales[dadorId] || {};

    montones[receptorId] = NIVELES.filter((n) => elegidas[n] || manuales[n]).map((nivel) => {
      const manual = manuales[nivel];
      const auto = elegidas[nivel];
      return {
        id: `${receptorId}:${nivel}`,
        duenoId: receptorId,
        nivel,
        texto: manual ? String(manual) : auto.texto,
        origen: manual ? 'manual' : 'auto',
        preguntaId: manual ? null : auto.preguntaId,
        categoria: manual ? null : auto.categoria,
        autorId: dadorId,
        comprada: false
      };
    });

    // Resumen ANÓNIMO para el admin: cuántas y si quedó incompleto. Sin contenido.
    resumen[receptorId] = { cantidad: montones[receptorId].length, completo, incidencias };
  }
  return { montones, resumen };
}

/**
 * Pista falsa (ronda 2): usa una respuesta REAL de otro jugador, de la misma
 * categoría y nivel, verificando que no coincida con la verdad del dueño del montón.
 */
export function generarFalsa(estado, { victimaId, tramposoId, categoria, nivel }, azar) {
  const { cuestionario, respuestas, jugadores, parejas } = estado;
  const verdaderoAutor = Object.keys(parejas).find((d) => parejas[d] === victimaId);

  const preguntas = cuestionario.preguntas.filter((p) => p.categoria === categoria);
  const candidatos = [];

  // Se intenta primero la plantilla del nivel pedido; si no hay material, se
  // relajan los otros niveles de la misma categoría antes de rendirse.
  const plantillasPorPregunta = preguntas.map((pregunta) => {
    const preferida = pregunta.plantillas.find((p) => p.nivel === nivelAPlantilla(nivel));
    const resto = pregunta.plantillas.filter((p) => p !== preferida);
    return { pregunta, plantillas: preferida ? [preferida, ...resto] : pregunta.plantillas };
  });

  for (const { pregunta, plantillas } of plantillasPorPregunta) {
    for (const plantilla of plantillas) {
    for (const otroId of Object.keys(jugadores)) {
      if (otroId === victimaId || otroId === verdaderoAutor) continue;
      const valor = (respuestas[otroId] || {})[pregunta.id];
      if (valor === undefined) continue;

      const derivado = derivar(plantilla.derivacion, valor);
      const valorReal = (respuestas[verdaderoAutor] || {})[pregunta.id];
      // El engaño no puede coincidir por accidente con la verdad.
      if (valorReal !== undefined && clave(derivar(plantilla.derivacion, valorReal)) === clave(derivado)) continue;

      const texto = plantilla.texto.replace('{v}', derivado);
      if (!esSegura(texto, jugadores)) continue;
      candidatos.push({ texto, preguntaId: pregunta.id, categoria });
    }
    if (candidatos.length > 0) break;   // ya hay material con esta plantilla
    }
  }
  if (candidatos.length === 0) return null;

  const elegida = barajar(azar, candidatos)[0];
  return {
    id: `${victimaId}:falsa:${(estado.montones[victimaId] || []).length}`,
    duenoId: victimaId,
    nivel,
    texto: elegida.texto,
    origen: 'trampa',
    preguntaId: elegida.preguntaId,
    categoria,
    autorId: tramposoId,
    comprada: false
  };
}

const nivelAPlantilla = (nivel) => ({ facil: 'vago', media: 'medio', dificil: 'fuerte' }[nivel] || 'medio');

/**
 * Para la ronda 2: qué categorías tienen material para armar una mentira creíble
 * contra un montón. Sirve para no ofrecerle al tramposo opciones imposibles.
 * Devuelve solo nombres de categoría: no revela respuestas de nadie.
 */
export function categoriasViables(estado, victimaId) {
  const categorias = [...new Set(estado.cuestionario.preguntas.map((p) => p.categoria))];
  const azarFijo = () => 0;   // solo interesa si existe material, no cuál sale
  return categorias.filter((categoria) =>
    ['media', 'facil', 'dificil'].some((nivel) =>
      generarFalsa(estado, { victimaId, tramposoId: null, categoria, nivel }, azarFijo) !== null));
}
