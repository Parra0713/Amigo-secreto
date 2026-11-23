// Conexión WebSocket con reconexión automática, latido y utilidades de móvil.
export function conectar({ rol, alMensaje, alEstadoRed }) {
  let socket = null, intentos = 0, latido = null, cerradoAposta = false;
  let saludo = { t: 'hola', rol };

  const abrir = () => {
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    socket = new WebSocket(url);

    socket.onopen = () => {
      intentos = 0;
      alEstadoRed?.('conectado');
      socket.send(JSON.stringify(saludo));
      latido = setInterval(() => enviar({ t: 'ping' }), 20000);
    };
    socket.onmessage = (e) => { try { alMensaje(JSON.parse(e.data)); } catch {} };
    socket.onclose = () => {
      clearInterval(latido);
      if (cerradoAposta) return;
      alEstadoRed?.('reconectando');
      // Reintento con espera creciente, con techo de 5 s.
      const espera = Math.min(5000, 400 * 2 ** Math.min(intentos++, 4));
      setTimeout(abrir, espera);
    };
    socket.onerror = () => {};
  };

  const enviar = (mensaje) => {
    if (socket?.readyState === 1) socket.send(JSON.stringify(mensaje));
  };

  abrir();
  // Al volver a primer plano, el celular pudo haber matado el socket sin avisar.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && socket?.readyState !== 1) abrir();
  });

  return {
    enviar,
    /** Guarda el saludo para reenviarlo tras cada reconexión.
        Llamarlo sin datos borra la identidad anterior (partida archivada). */
    identificar(datos = {}) { saludo = { t: 'hola', rol, ...datos }; enviar(saludo); },
    cerrar() { cerradoAposta = true; socket?.close(); }
  };
}

/** Evita que la pantalla del celular se apague durante la partida. */
export async function mantenerPantallaEncendida() {
  try {
    if (!('wakeLock' in navigator)) return null;
    let bloqueo = await navigator.wakeLock.request('screen');
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) { try { bloqueo = await navigator.wakeLock.request('screen'); } catch {} }
    });
    return bloqueo;
  } catch { return null; }
}

export const vibrar = (patron = 60) => { try { navigator.vibrate?.(patron); } catch {} };

export const guardar = (clave, valor) => { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch {} };
export const leer = (clave) => { try { return JSON.parse(localStorage.getItem(clave)); } catch { return null; } };
