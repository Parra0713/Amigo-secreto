// Utilidades compartidas por las pruebas: arma partidas de laboratorio.
import { readFileSync } from 'node:fs';
import { crearPartida, agregarJugador, guardarRespuestas, guardarPareja, prepararPartida } from '../engine/estado.js';

export const config = JSON.parse(readFileSync(new URL('../config/reglas.json', import.meta.url)));
export const cuestionario = JSON.parse(readFileSync(new URL('../config/cuestionario.json', import.meta.url)));

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const COMIDAS = ['pizza','pizza','sancocho','sushi','ajiaco','hamburguesa','pasta','tamales'];
const COLORES = ['azul','azul','rojo','verde','negro','morado','amarillo','gris'];
const HOBBIES = ['leer','ver series','hacer deporte','cocinar','videojuegos','música','dormir','manualidades'];

/** Respuestas variadas pero determinísticas para el jugador i. */
export function respuestasDe(i) {
  return {
    cumple_mes: MESES[i % 12],
    comida: COMIDAS[i % COMIDAS.length],
    color: COLORES[i % COLORES.length],
    serie: `Serie ${String.fromCharCode(65 + i)}`,
    lugar: i % 2 ? 'Cartagena' : 'Japón',
    mascota: ['perro','gato','ninguna','pez'][i % 4],
    hobby: HOBBIES[i % HOBBIES.length],
    talento: `armar cosas ${i}`,
    mania: `hablar durmiendo ${i}`,
    bebida: ['café','té','gaseosa','agua'][i % 4],
    madrugador: ['madrugador','trasnochador','depende del día'][i % 3]
  };
}

/** Partida lista para jugar: N jugadores en círculo (0 regala a 1, 1 a 2, ... último a 0). */
export function partidaDePrueba(n = 8, extra = {}) {
  let e = crearPartida({ config: { ...config, ...extra }, cuestionario, semilla: 'prueba-fija' });
  for (let i = 0; i < n; i++) {
    e = agregarJugador(e, { id: `j${i}`, apodo: `Jugador${i}`, avatar: '🎁', pinHash: 'x' });
  }
  for (let i = 0; i < n; i++) {
    e = guardarRespuestas(e, `j${i}`, respuestasDe(i));
    e = guardarPareja(e, `j${i}`, `j${(i + 1) % n}`);
  }
  return prepararPartida(e);
}
