// PIN por jugador, intentos fallidos y reconexión. Los PIN se guardan hasheados.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const SAL = 'plan-amigo-secreto';

export const hashPin = (pin) => scryptSync(String(pin), SAL, 32).toString('hex');

export function pinCorrecto(pin, hash) {
  const a = Buffer.from(hashPin(pin), 'hex');
  const b = Buffer.from(String(hash), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** PIN de 4 dígitos legible, sin repetir dentro de la partida. */
export function nuevoPin(usados) {
  for (let i = 0; i < 500; i++) {
    const pin = String(1000 + (randomBytes(2).readUInt16BE() % 9000));
    if (!usados.has(pin)) return pin;
  }
  throw new Error('SIN_PINES_DISPONIBLES');
}

export function crearControlIntentos({ maxIntentos = 5, ventanaMs = 60000 } = {}) {
  const intentos = new Map();
  return {
    permitido(clave) {
      const ahora = Date.now();
      const registro = intentos.get(clave) || { n: 0, desde: ahora };
      if (ahora - registro.desde > ventanaMs) { intentos.set(clave, { n: 1, desde: ahora }); return true; }
      registro.n++;
      intentos.set(clave, registro);
      return registro.n <= maxIntentos;
    },
    exito(clave) { intentos.delete(clave); }
  };
}
