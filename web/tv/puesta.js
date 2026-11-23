/* ============================================================
   Puesta en escena del cortometraje.

   El guion no describe posiciones ni grados: pide acciones
   ("Pipe le mete una carta falsa a Tita") y aquí se traducen a
   movimiento. Las reglas de HIG-3D v1.0 que manda este archivo:

   · §6.1 — nada se mueve en línea recta a velocidad constante:
     toda interpolación entra y sale suave.
   · §6.3 — anticipación y asentamiento: antes de salir, un
     contrapeso; al llegar, un rebote corto que se apaga.
   · §6.4 — una acción a la vez en el centro de atención; lo demás
     se queda quieto para no competir.
   · §7.2 — las transiciones nacen del objeto: la pieza que cierra
     una escena es la que abre la siguiente (la ficha que se paga
     se vuelve la carta que se voltea).

   El motor es un reloj de interpolaciones sobre propiedades de los
   objetos de Three.js. No conoce el guion: solo sabe mover cosas.
   ============================================================ */

/** Suavizado de entrada y salida. Nada arranca ni frena en seco (§6.1). */
export const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Salida con rebote corto: para llegadas que deben sentirse (§6.3). */
export const rebote = (t) => {
  const c = 1.70158 + 1;
  return 1 + c * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
};

/** Empuja un valor de 0 a 1 y vuelve: sirve para latidos y acentos. */
export const pulso = (t) => Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);

const CURVAS = { suave, rebote, pulso, lineal: (t) => t };

/**
 * Reloj de interpolaciones. Cada una mueve una propiedad de un objeto
 * (o llama a una función) durante un tiempo, con una curva y un retardo.
 */
export function crearReloj() {
  let pendientes = [];

  /**
   * @param {object} o  descripción del movimiento
   * @param {Function} o.aplicar  (valor, objeto) -> void
   * @param {number} o.de, o.a    valores inicial y final
   * @param {number} o.duracion   segundos
   * @param {number} [o.retardo]  segundos antes de empezar
   * @param {string} [o.curva]    suave | rebote | pulso | lineal
   * @param {Function} [o.alEmpezar], [o.alTerminar]
   */
  const mover = (o) => {
    pendientes.push({ t: 0, retardo: 0, curva: 'suave', de: 0, a: 1, ...o, arrancado: false });
    return pendientes[pendientes.length - 1];
  };

  /** Solo dispara algo en un momento dado. */
  const cuando = (retardo, hacer) => mover({ retardo, duracion: 0, alTerminar: hacer, aplicar: () => {} });

  function actualizar(dt) {
    if (!pendientes.length) return;
    const vivos = [];
    for (const m of pendientes) {
      m.t += dt;
      if (m.t < m.retardo) { vivos.push(m); continue; }
      if (!m.arrancado) { m.arrancado = true; m.alEmpezar?.(); }
      const p = m.duracion > 0 ? Math.min(1, (m.t - m.retardo) / m.duracion) : 1;
      const curva = CURVAS[m.curva] || suave;
      m.aplicar(m.de + (m.a - m.de) * curva(p), p);
      if (p < 1) vivos.push(m);
      else m.alTerminar?.();
    }
    pendientes = vivos;
  }

  return {
    mover,
    cuando,
    actualizar,
    get ocupado() { return pendientes.length > 0; },
    limpiar() { pendientes = []; }
  };
}

/**
 * Traduce las acciones del guion a movimiento sobre las piezas de la escena.
 * Recibe las piezas ya construidas (no las crea) y el control de encuadre,
 * para que el guion pueda pedir plano corto o plano general por su nombre.
 */
export function crearPuesta({ piezas, encuadre, reloj = crearReloj(), nombres = ['tita', 'nacho', 'pipe'] }) {
  const { invitados = [], cartaFalsa, fantasma, puertas = [], fichasPila = [] } = piezas;
  const indiceDe = (quien) => Math.max(0, nombres.indexOf(String(quien || '').toLowerCase()));
  const invitado = (quien) => invitados[indiceDe(quien)];

  /** Aparecen o desaparecen los tres puestos de la mesa. */
  function mesa(visible) {
    invitados.forEach((inv, i) => {
      if (visible) {
        inv.grupo.visible = true;
        inv.grupo.scale.setScalar(0.01);
        reloj.mover({
          retardo: i * 0.12, duracion: 0.7, curva: 'rebote',
          de: 0.01, a: 1, aplicar: (v) => inv.grupo.scale.setScalar(v)
        });
      } else {
        reloj.mover({
          duracion: 0.4, de: 1, a: 0.01,
          aplicar: (v) => inv.grupo.scale.setScalar(v),
          alTerminar: () => { inv.grupo.visible = false; }
        });
      }
    });
  }

  /** El oro dice de quién estamos hablando (§6.4: una sola atención). */
  function marcar(quien) {
    invitados.forEach((inv) => { inv.foco.visible = false; });
    const inv = invitado(quien);
    if (!inv) return;
    inv.foco.visible = true;
    inv.foco.scale.setScalar(0.4);
    reloj.mover({ duracion: 0.5, curva: 'rebote', de: 0.4, a: 1, aplicar: (v) => inv.foco.scale.setScalar(v) });
    // Y un levantón corto, con su anticipación hacia abajo.
    const y0 = inv.base.y;
    reloj.mover({ duracion: 0.16, de: 0, a: -0.05, aplicar: (v) => { inv.grupo.position.y = y0 + v; } });
    reloj.mover({ retardo: 0.16, duracion: 0.5, curva: 'rebote', de: -0.05, a: 0.07,
      aplicar: (v) => { inv.grupo.position.y = y0 + v; } });
  }

  /** Su montón se asoma: tres cartas boca abajo. */
  function montonDe(quien) {
    const inv = invitado(quien);
    if (!inv) return;
    inv.cartas.forEach((c, i) => {
      c.visible = true;
      c.rotation.x = 0;
      reloj.mover({
        retardo: i * 0.1, duracion: 0.45, curva: 'rebote', de: 0.5, a: 0.52,
        aplicar: (v) => { c.position.z = v; }
      });
    });
  }

  /** Paga una ficha y voltea una carta: la ficha es la que trae la carta (§7.2). */
  function comprar(quien, cual = 0) {
    const inv = invitado(quien);
    if (!inv) return;
    marcar(quien);
    montonDe(quien);

    const ficha = inv.fichas[0];
    ficha.visible = true;
    const desde = { x: 0.46, z: 0.34 };
    reloj.mover({
      duracion: 0.6, de: 0, a: 1,
      aplicar: (v) => {
        ficha.position.x = desde.x + (0 - desde.x) * v;
        ficha.position.z = desde.z + (0.95 - desde.z) * v;
        ficha.position.y = 0.5 + Math.sin(v * Math.PI) * 0.35;   // arco, no línea recta
      },
      alTerminar: () => {
        ficha.visible = false;
        const carta = inv.cartas[cual] || inv.cartas[0];
        carta.visible = true;
        reloj.mover({ duracion: 0.7, curva: 'rebote', de: 0, a: Math.PI * 0.92,
          aplicar: (v) => { carta.rotation.x = v; } });
        reloj.mover({ duracion: 0.7, de: 0.5, a: 0.72, aplicar: (v) => { carta.position.y = v; } });
      }
    });
  }

  /** La carta falsa viaja del tramposo a su víctima y se mete en el montón. */
  function trampa(de, a) {
    const origen = invitado(de), destino = invitado(a);
    if (!origen || !destino) return;
    marcar(de);
    montonDe(a);

    cartaFalsa.visible = true;
    const p0 = origen.grupo.position.clone();
    const p1 = destino.grupo.position.clone();
    cartaFalsa.scale.setScalar(0.7);
    reloj.mover({
      duracion: 1.25, de: 0, a: 1,
      aplicar: (v) => {
        cartaFalsa.position.x = p0.x + (p1.x - p0.x) * v;
        cartaFalsa.position.z = p0.z + 0.5 + (p1.z + 0.5 - p0.z - 0.5) * v;
        cartaFalsa.position.y = 0.55 + Math.sin(v * Math.PI) * 0.55;
        cartaFalsa.rotation.y = v * Math.PI * 1.5;
      },
      alTerminar: () => {
        marcar(a);
        reloj.mover({ duracion: 0.35, de: 0.7, a: 0.9, curva: 'rebote',
          aplicar: (v) => cartaFalsa.scale.setScalar(v) });
      }
    });
  }

  /** Dos puertas: la pareja elige en secreto y una se abre. */
  function dilema(pareja = [], eleccion = []) {
    marcar(pareja[0]);
    puertas.forEach((p, i) => {
      p.visible = true;
      p.scale.y = 0.01;
      reloj.mover({ retardo: i * 0.18, duracion: 0.55, curva: 'rebote', de: 0.01, a: 1,
        aplicar: (v) => { p.scale.y = v; } });
    });
    // La que corresponde a lo elegido se abre girando sobre su borde.
    const abierta = eleccion[0] === 'guardar' ? 1 : 0;
    reloj.mover({ retardo: 1.1, duracion: 0.8, de: 0, a: 1,
      aplicar: (v) => { puertas[abierta].rotation.y = v * 1.15; } });
  }

  /** Las fichas de la apuesta cruzan la mesa hacia el sospechoso. */
  function apuesta(quien, hacia) {
    const origen = invitado(quien), destino = invitado(hacia);
    if (!origen) return;
    marcar(quien);
    const blanco = destino ? destino.grupo.position : { x: 0, z: 2.2 };
    origen.fichas.forEach((f, i) => {
      f.visible = true;
      const o = { x: origen.grupo.position.x + 0.46, z: origen.grupo.position.z + 0.34 };
      reloj.mover({
        retardo: i * 0.14, duracion: 0.75, de: 0, a: 1,
        aplicar: (v) => {
          f.position.x = (o.x + (blanco.x - o.x) * v) - origen.grupo.position.x;
          f.position.z = (o.z + (blanco.z + 0.4 - o.z) * v) - origen.grupo.position.z;
          f.position.y = 0.5 + Math.sin(v * Math.PI) * 0.22;
        }
      });
    });
  }

  /** El bono fantasma: una luz fría que se posa sobre quien no fue descubierto. */
  function bono(quien) {
    const inv = invitado(quien);
    marcar(quien);
    fantasma.visible = true;
    const destino = inv ? inv.grupo.position : { x: 0, z: 2 };
    fantasma.scale.setScalar(0.3);
    reloj.mover({ duracion: 1.1, de: 0, a: 1,
      aplicar: (v) => {
        fantasma.position.set(
          -2 + (destino.x + 2) * v,
          1.9 + Math.sin(v * Math.PI) * 0.4,
          3.4 + (destino.z + 0.3 - 3.4) * v
        );
        fantasma.scale.setScalar(0.3 + 0.7 * v);
      } });
  }

  /** Todo boca arriba: la verdad al final. */
  function revelacion() {
    invitados.forEach((inv) => { inv.foco.visible = false; });
    invitados.forEach((inv, i) => inv.cartas.forEach((c, j) => {
      c.visible = true;
      reloj.mover({ retardo: i * 0.25 + j * 0.12, duracion: 0.6, curva: 'rebote',
        de: c.rotation.x, a: Math.PI * 0.92, aplicar: (v) => { c.rotation.x = v; } });
    }));
  }

  /** Apaga toda la utilería del corto y deja la mesa como estaba. */
  function limpiar() {
    reloj.limpiar();
    invitados.forEach((inv) => {
      inv.foco.visible = false;
      inv.grupo.position.copy(inv.base);
      inv.cartas.forEach((c) => { c.visible = false; c.rotation.x = 0; c.position.y = 0.5; c.position.z = 0.52; });
      inv.fichas.forEach((f, i) => { f.visible = false; f.position.set(0.46, 0.5 + i * 0.038, 0.34); });
    });
    if (cartaFalsa) cartaFalsa.visible = false;
    if (fantasma) fantasma.visible = false;
    puertas.forEach((p) => { p.visible = false; p.rotation.y = 0; });
    fichasPila.forEach((f) => { f.visible = false; });
  }

  const ACCIONES = {
    mesa: () => { mesa(true); encuadre?.('ancho'); },
    quitarMesa: () => mesa(false),
    marcar: (o) => marcar(o.quien),
    monton: (o) => { encuadre?.('mesa'); montonDe(o.quien); },
    comprar: (o) => { encuadre?.('mesa'); comprar(o.quien, o.cual); },
    trampa: (o) => { encuadre?.('complot'); trampa(o.de, o.a); },
    dilema: (o) => { encuadre?.('mesa'); dilema(o.pareja, o.eleccion); },
    apuesta: (o) => { encuadre?.('mesa'); apuesta(o.quien, o.hacia); },
    bono: (o) => { encuadre?.('cerca'); bono(o.quien); },
    revelacion: () => { encuadre?.('mesa'); revelacion(); },
    limpiar: () => limpiar()
  };

  return {
    /** Ejecuta una acción del guion. Devuelve false si no existe. */
    accion(nombre, opciones = {}) {
      const hacer = ACCIONES[nombre];
      if (!hacer) return false;
      hacer(opciones);
      return true;
    },
    acciones: Object.keys(ACCIONES),
    actualizar: reloj.actualizar,
    limpiar,
    get ocupado() { return reloj.ocupado; }
  };
}
