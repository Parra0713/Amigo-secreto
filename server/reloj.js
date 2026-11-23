// Temporizadores de ronda. El engine no mide tiempo; aquí está todo el reloj.

export function crearReloj({ alExpirar, alTick }) {
  let fin = null;
  let intervalo = null;

  const detener = () => { if (intervalo) clearInterval(intervalo); intervalo = null; fin = null; };

  return {
    iniciar(segundos) {
      detener();
      if (!segundos || segundos <= 0) return;
      fin = Date.now() + segundos * 1000;
      intervalo = setInterval(() => {
        const restante = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
        alTick(restante);
        if (restante <= 0) { detener(); alExpirar(); }
      }, 1000);
    },
    restante: () => (fin ? Math.max(0, Math.ceil((fin - Date.now()) / 1000)) : null),
    detener
  };
}
