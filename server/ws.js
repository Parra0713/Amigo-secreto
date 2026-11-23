// Transporte: un socket por cliente. Traduce mensajes <-> acciones del juego.
// No hay lógica de reglas aquí.

import { crearControlIntentos } from './sesiones.js';

const ACCIONES_JUEGO = [
  'ronda1.comprar', 'ronda1.listo',
  'ronda2.trampa', 'ronda2.pasar',
  'ronda3.elegir', 'ronda4.apostar'
];
const ACCIONES_REGISTRO = ['registro.cuestionario', 'registro.pareja', 'registro.tarjetas'];

export function registrarWebsocket(app, juego) {
  const intentos = crearControlIntentos();

  app.get('/ws', { websocket: true }, (socket, peticion) => {
    const ip = peticion.ip || 'desconocida';
    const cliente = {
      rol: 'tv',
      jugadorId: null,
      esAdmin: false,
      enviar(mensaje) {
        if (socket.readyState === 1) socket.send(JSON.stringify(mensaje));
      }
    };

    const error = (codigo) => cliente.enviar({ t: 'error', codigo });

    socket.on('message', (crudo) => {
      let mensaje;
      try { mensaje = JSON.parse(String(crudo)); } catch { return error('MENSAJE_INVALIDO'); }
      if (!mensaje || typeof mensaje.t !== 'string') return error('MENSAJE_INVALIDO');

      try {
        // --- saludo / autenticación ---
        if (mensaje.t === 'hola') {
          cliente.rol = ['tv', 'play', 'admin'].includes(mensaje.rol) ? mensaje.rol : 'tv';

          if (cliente.rol === 'play' && mensaje.jugadorId) {
            if (!intentos.permitido(ip)) return error('DEMASIADOS_INTENTOS');
            const resultado = juego.autenticar({ jugadorId: mensaje.jugadorId, pin: mensaje.pin });
            // Sesión de una partida ya archivada: no es culpa del jugador ni un
            // intento fallido. Se le pide volver a registrarse.
            if (resultado?.expirada) { intentos.exito(ip); return cliente.enviar({ t: 'reiniciada' }); }
            if (!resultado) return error('PIN_INCORRECTO');
            intentos.exito(ip);
            cliente.jugadorId = resultado.jugador.id;
          }
          if (cliente.rol === 'admin') {
            if (!intentos.permitido(ip)) return error('DEMASIADOS_INTENTOS');
            if (String(mensaje.pin) !== String(juego.config.admin.pin)) return error('PIN_INCORRECTO');
            intentos.exito(ip);
            cliente.esAdmin = true;
          }
          juego.conectar(cliente);
          return;
        }

        if (mensaje.t === 'ping') return cliente.enviar({ t: 'pong' });

        // --- acciones de jugador ---
        if (ACCIONES_REGISTRO.includes(mensaje.t)) {
          if (!cliente.jugadorId) return error('NO_AUTENTICADO');
          return juego.accionRegistro(cliente.jugadorId, mensaje);
        }
        if (ACCIONES_JUEGO.includes(mensaje.t)) {
          if (!cliente.jugadorId) return error('NO_AUTENTICADO');
          return juego.accionJuego(cliente.jugadorId, mensaje);
        }

        // --- control del anfitrión ---
        if (mensaje.t.startsWith('admin.')) {
          if (!cliente.esAdmin) return error('NO_AUTORIZADO');
          const acciones = {
            'admin.abrirRegistro': () => juego.abrirRegistro(),
            'admin.explicar': () => juego.explicar(),
            'admin.iniciar': () => juego.iniciarPartida(),
            'admin.siguiente': () => juego.siguienteRonda(),
            'admin.pausar': () => juego.pausar(),
            'admin.reanudar': () => juego.reanudar(),
            'admin.revelar': () => juego.revelarSiguiente(),
            'admin.nueva': () => juego.nuevaPartida(),
            'admin.automatico': () => juego.alternarAutomatico()
          };
          const accion = acciones[mensaje.t];
          if (!accion) return error('ACCION_DESCONOCIDA');
          return accion();
        }

        error('ACCION_DESCONOCIDA');
      } catch (e) {
        app.log.warn(`acción rechazada (${mensaje.t}): ${e.message}`);
        error(e.message);
      }
    });

    socket.on('close', () => juego.desconectar(cliente));
    socket.on('error', () => juego.desconectar(cliente));
  });
}
