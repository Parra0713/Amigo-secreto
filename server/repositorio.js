// Persistencia: snapshot JSON con escritura atómica + log de eventos (ndjson).
// Es el único módulo que sabe de disco. Cambiarlo por SQLite no toca nada más.

import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

export function crearRepositorio(carpeta) {
  mkdirSync(carpeta, { recursive: true });
  const archivo = join(carpeta, 'partida.json');
  const log = join(carpeta, 'eventos.ndjson');

  return {
    cargarSnapshot() {
      if (!existsSync(archivo)) return null;
      try {
        return JSON.parse(readFileSync(archivo, 'utf8'));
      } catch (e) {
        // Un JSON corrupto no debe impedir arrancar: se conserva para revisarlo.
        renameSync(archivo, `${archivo}.corrupto-${Date.now()}`);
        return null;
      }
    },

    /** Atómico: escribe a .tmp y renombra. Un corte de luz nunca deja medio archivo. */
    guardarSnapshot(estado) {
      const tmp = `${archivo}.tmp`;
      writeFileSync(tmp, JSON.stringify(estado, null, 1), 'utf8');
      renameSync(tmp, archivo);
    },

    anexarEvento(evento) {
      appendFileSync(log, `${JSON.stringify({ ts: new Date().toISOString(), ...evento })}\n`, 'utf8');
    },

    archivar() {
      if (existsSync(archivo)) renameSync(archivo, join(dirname(archivo), `partida-${Date.now()}.json`));
    }
  };
}
