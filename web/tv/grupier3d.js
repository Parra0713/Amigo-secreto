/* ============================================================
   El grupier en 3D. Diseñado contra docs/3D_WORLD_HIG.md.

   Correcciones respecto de la primera versión, con la regla que las motiva:
   · La capucha era un cono CERRADO: se tragaba la cara y los ojos. Ahora es un
     casco abierto por delante (torno con sector), con el vacío y los ojos
     visibles. §1.1: sin rostro no hay punto focal.
   · La vela estaba a intensidad 7 y aplastaba la paleta entera a café. Ahora la
     luz cálida es de apoyo y manda una clave fría, con realce dorado de borde
     detrás. §5.1 y §5.2: contraste de temperatura y separación figura-fondo.
   · La cámara estaba lejos y baja, y la mesa tapaba el cuerpo. Ahora encuadra
     del pecho hacia arriba y la mesa quedó más abajo y más atrás. §1.1.
   · Mapeo de tonos ACES y exposición: sin eso, todo lo oscuro se va a barro.

   Lo demás se mantiene: 70% triángulo / 30% rectángulo, proporción 1/3–2/3,
   paleta de tres colores más un acento, asimetría intencional, y la cadera
   liderando el movimiento con torso y capucha en retraso.
   ============================================================ */

import * as THREE from '../shared/vendor/three/three.module.js';

// §5.3 — tres principales + un acento. Ningún color fuera de aquí.
const PALETA = {
  nocturno: 0x3b2f5e,   // manto (subido en valor: antes se iba a negro)
  vacio:    0x05030a,   // rostro, niebla
  humo:     0x565073,   // mesa, silla
  oro:      0xf2c14e    // ACENTO: ojos, filo, ficha
};

/* §5.3 dice tres colores más un acento POR PERSONAJE O ESCENA. El personaje y el
   escenario cumplen con PALETA a rajatabla. La utilería narrativa es la excepción
   consciente: son dos señales que aparecen solas, unos segundos, y nunca juntas.
   Cada una está aquí para decir algo que el color tiene que decir de inmediato. */
const PALETA_UTILERIA = {
  falsa:    0xc0392b,   // la carta de la trampa: rojo = mentira, se lee al instante
  falsaLuz: 0x4a0f0a,   // su emisión, para que no se apague en la penumbra
  fantasma: 0xdfe4f5,   // el bono fantasma: blanco frío, lo único translúcido
  fantasmaLuz: 0x6677aa   // su emisión azulada: frío contra la vela cálida (§5.1)
};

const RETRASO_TORSO = 0.09;      // s — §6.3 overlapping
const RETRASO_CAPUCHA = 0.18;

/** Perfil del manto para el torno: ancho abajo, estrecho en los hombros. */
function perfilManto() {
  const puntos = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const radio = 0.95 - 0.62 * Math.pow(t, 0.75);
    puntos.push(new THREE.Vector2(radio, t * 2.35));
  }
  return puntos;
}

/** Perfil del casco de la capucha, abierto por delante. */
function perfilCapucha() {
  const puntos = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    // Curva que sube y se cierra en punta: triangular, no esférica.
    const radio = 0.52 * Math.cos(t * Math.PI * 0.48);
    puntos.push(new THREE.Vector2(Math.max(radio, 0.012), t * 1.05));
  }
  return puntos;
}

/**
 * Construye la escena completa SIN renderizador. Separado a propósito: así se
 * puede probar en Node, sin WebGL, y un error al armar el grafo (como asignar
 * `position` en vez de `position.set`, que en Three.js lanza) se detecta en
 * `npm test` en vez de descubrirse como "volvió al 2D" en la TV.
 */
export function construirEscena(THREE, { silueta = false } = {}) {
  const escena = new THREE.Scene();
  escena.fog = new THREE.Fog(silueta ? 0xd8d8e0 : PALETA.vacio, 5.5, 13);
  if (silueta) escena.background = new THREE.Color(0xd8d8e0);

  const camara = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  const camaraBase = new THREE.Vector3(0.55, 2.5, 4.35);
  const miraBase = new THREE.Vector3(0, 2.1, 0);
  camara.position.copy(camaraBase);
  camara.lookAt(miraBase);

  // ---------- materiales ----------
  const mat = (color, opciones = {}) => silueta
    ? new THREE.MeshBasicMaterial({ color: 0x000000 })
    : new THREE.MeshStandardMaterial({ color, ...opciones });

  const matManto  = mat(PALETA.nocturno, { roughness: 0.78, metalness: 0.06, flatShading: true });
  const matOscuro = mat(PALETA.vacio,    { roughness: 1 });
  const matHumo   = mat(PALETA.humo,     { roughness: 0.9 });
  const matOro    = silueta
    ? new THREE.MeshBasicMaterial({ color: 0x000000 })
    : new THREE.MeshStandardMaterial({ color: PALETA.oro, emissive: PALETA.oro, emissiveIntensity: 1.2, roughness: 0.35 });
  const matRojo = silueta
    ? new THREE.MeshBasicMaterial({ color: 0x000000 })
    : new THREE.MeshStandardMaterial({ color: PALETA_UTILERIA.falsa, emissive: PALETA_UTILERIA.falsaLuz, roughness: 0.6 });

  // ---------- personaje ----------
  const personaje = new THREE.Group();          // cadera: lidera (§6.3)
  const torso = new THREE.Group();
  const capucha = new THREE.Group();
  personaje.add(torso);
  torso.add(capucha);

  const manto = new THREE.Mesh(new THREE.LatheGeometry(perfilManto(), 7), matManto);
  torso.add(manto);

  const filo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.022, 6, 7), matOro);
  filo.rotation.x = Math.PI / 2;
  filo.position.y = 0.03;
  torso.add(filo);

  const columna = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.4), matManto);
  columna.position.y = 1.5;
  torso.add(columna);

  // Hombros asimétricos: el derecho más alto (§4.2)
  for (const [x, y, escala] of [[-0.44, 2.1, 1], [0.44, 2.27, 0.9]]) {
    const hombro = new THREE.Mesh(new THREE.ConeGeometry(0.32 * escala, 0.46, 4), matManto);
    hombro.position.set(x, y, 0);
    hombro.rotation.z = x < 0 ? 0.55 : -0.66;
    hombro.rotation.y = Math.PI / 4;
    torso.add(hombro);
  }

  // Pliegues: 20% de detalle que repite la silueta, no compite con ella
  for (const angulo of [-0.55, 0, 0.55]) {
    const pliegue = new THREE.Mesh(new THREE.ConeGeometry(0.055, 2.1, 3), matOscuro);
    pliegue.position.set(Math.sin(angulo) * 0.7, 1.05, Math.cos(angulo) * 0.7);
    torso.add(pliegue);
  }

  const ficha = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 16), matOro);
  ficha.rotation.x = Math.PI / 2;
  ficha.position.set(0.16, 1.6, 0.22);
  torso.add(ficha);

  // --- capucha abierta: casco por torno con sector, el frente queda libre ---
  const cascoGeo = new THREE.LatheGeometry(perfilCapucha(), 10, Math.PI * 0.26, Math.PI * 1.48);
  const matCasco = matManto.clone();
  matCasco.side = THREE.DoubleSide;        // se ve por dentro del capuchón
  const casco = new THREE.Mesh(cascoGeo, matCasco);
  capucha.add(casco);

  // Visera: tapa el hueco de arriba y da el pico de la silueta
  const pico = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 4), matManto);
  pico.position.set(0, 1.0, -0.06);
  pico.rotation.y = Math.PI / 4;
  capucha.add(pico);

  capucha.position.set(0, 2.4, 0);

  // Rostro: el vacío. Valor más oscuro de la figura (§1.2)
  const rostro = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 16), matOscuro);
  rostro.position.set(0, 0.56, 0.02);
  capucha.add(rostro);

  // Ojos: punto focal. Con su propia luz, para que se lean a 3 metros.
  const ojos = [];
  for (const x of [-0.12, 0.12]) {
    const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), matOro);
    ojo.position.set(x, 0.62, 0.27);
    capucha.add(ojo);
    ojos.push(ojo);
    if (!silueta) {
      const brillo = new THREE.PointLight(PALETA.oro, 0.9, 1.6, 2);
      brillo.position.copy(ojo.position);
      capucha.add(brillo);
    }
  }

  // Boca: se mueve con la amplitud real de la voz
  const boca = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), matOscuro);
  boca.position.set(0, 0.44, 0.26);
  boca.scale.y = 0.18;
  capucha.add(boca);

  escena.add(personaje);

  // ---------- escenario (§3.2, §5.2) ----------
  const mesa = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.14, 32), matHumo);
  mesa.position.set(0, -0.08, 2.6);
  escena.add(mesa);

  const cartas = [];
  for (const [i, x] of [-0.55, 0, 0.55].entries()) {
    const carta = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.016, 0.52), matManto);
    carta.position.set(x, 0.01, 3.05);
    carta.rotation.y = (i - 1) * 0.1;
    escena.add(carta);
    cartas.push(carta);
  }

  const silla = new THREE.Group();
  const asiento = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.55), matHumo);
  asiento.position.set(0, 0.45, 0);
  const respaldo = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.07), matHumo);
  respaldo.position.set(0, 0.78, -0.24);
  silla.add(asiento, respaldo);
  for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) {
    const pata = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.06), matHumo);
    pata.position.set(x, 0.22, z);
    silla.add(pata);
  }
  silla.position.set(-2.1, -0.15, 3.6);
  silla.rotation.y = 0.55;
  escena.add(silla);

  const vela = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.32, 10), matHumo);
  vela.position.set(1.65, 0.15, 3.0);
  escena.add(vela);
  const llama = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), matOro);
  llama.position.set(1.65, 0.36, 3.0);
  escena.add(llama);

  // ---------- utilería de la explicación ----------
  // Cada pieza aparece solo cuando el guion la nombra, y se va al terminar.
  const utileria = new THREE.Group();
  escena.add(utileria);

  const fichasPila = [];
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.045, 20), matOro);
    f.position.set(-0.95, 0.06 + i * 0.05, 2.75);
    f.visible = false;
    utileria.add(f);
    fichasPila.push(f);
  }

  const cartaFalsa = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.016, 0.52), matRojo);
  cartaFalsa.visible = false;
  utileria.add(cartaFalsa);

  const puertas = [];
  for (const [i, x] of [-0.6, 0.6].entries()) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.07), i === 0 ? matOro : matManto);
    p.position.set(x, 0.42, 2.9);
    p.visible = false;
    utileria.add(p);
    puertas.push(p);
  }

  const fantasma = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12),
    silueta ? matOscuro : new THREE.MeshStandardMaterial({ color: PALETA_UTILERIA.fantasma, emissive: PALETA_UTILERIA.fantasmaLuz, transparent: true, opacity: 0.75, roughness: 1 }));
  fantasma.visible = false;
  utileria.add(fantasma);

  // ---------- luces (§5.1) ----------
  if (!silueta) {
    // Clave fría desde arriba-izquierda: es la que da forma.
    const clave = new THREE.DirectionalLight(0x9fb4ff, 2.6);
    clave.position.set(-3.2, 5, 2.4);
    escena.add(clave);

    // Vela: apoyo cálido desde abajo-derecha. Contraste de temperatura.
    const velaLuz = new THREE.PointLight(0xffa94d, 3.2, 7, 2);
    velaLuz.position.set(1.65, 0.5, 3.0);
    velaLuz.name = 'vela';
    escena.add(velaLuz);

    // Realce de borde dorado desde atrás: separa del fondo con luz, no con línea.
    const borde = new THREE.DirectionalLight(PALETA.oro, 3.4);
    borde.position.set(-1.4, 3.2, -3.4);
    escena.add(borde);

    escena.add(new THREE.AmbientLight(0x343052, 1.6));
  }

  return {
    escena, camara, camaraBase, miraBase,
    personaje, torso, capucha, boca, ojos, manto, casco,
    llama, cartas, fichasPila, cartaFalsa, puertas, fantasma,
    materiales: { matManto, matOscuro, matHumo, matOro, matRojo }
  };
}

export function crearGrupier3D(contenedor, { silueta = false } = {}) {
  let renderizador;
  try {
    renderizador = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;                            // sin WebGL: el llamador usa el SVG
  }
  if (!renderizador.getContext()) return null;

  renderizador.toneMapping = silueta ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderizador.toneMappingExposure = 1.25;

  const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const {
    escena, camara, personaje, torso, capucha, boca, manto, casco,
    llama, cartas, fichasPila, cartaFalsa, puertas, fantasma, materiales
  } = construirEscena(THREE, { silueta });
  const { matOro } = materiales;

  // ---------- montaje ----------
  renderizador.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderizador.setClearColor(0x000000, 0);
  contenedor.appendChild(renderizador.domElement);
  renderizador.domElement.style.cssText = 'width:100%;height:100%;display:block';
  renderizador.domElement.setAttribute('role', 'img');
  renderizador.domElement.setAttribute('aria-label',
    'El grupier: una figura encapuchada de ojos dorados detrás de una mesa de juego');

  function redimensionar() {
    const { clientWidth: w, clientHeight: h } = contenedor;
    if (!w || !h) return;
    renderizador.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }
  redimensionar();
  const observador = new ResizeObserver(redimensionar);
  observador.observe(contenedor);

  // ---------- actuación ----------
  let hablando = false;
  let nivelVoz = 0;            // 0..1, viene de la amplitud real del audio
  let anticipacion = 0;
  let asentamiento = 0;
  let enfasis = 0;
  let gestoActual = null;
  let gestoT = 0;
  const historialGiro = [];
  let animando = true;
  const reloj = new THREE.Clock();

  // Encuadres por gesto: la cámara también actúa (§6: la puesta en escena acompaña).
  const ENCUADRES = {
    reposo:  { pos: [0.55, 2.5, 4.35],  mira: [0, 2.1, 0] },
    cerca:   { pos: [0.2, 2.75, 3.1],   mira: [0, 2.5, 0] },
    mesa:    { pos: [0.35, 2.1, 3.6],   mira: [0, 0.7, 2.6] },
    ancho:   { pos: [1.3, 2.9, 5.4],    mira: [0, 1.8, 1.2] },
    complot: { pos: [-0.8, 2.45, 3.0],  mira: [0.15, 2.3, 0.4] }
  };
  let encuadre = 'reposo';
  const posObjetivo = new THREE.Vector3(...ENCUADRES.reposo.pos);
  const miraObjetivo = new THREE.Vector3(...ENCUADRES.reposo.mira);
  const miraActual = miraObjetivo.clone();

  function ponerEncuadre(nombre) {
    const e = ENCUADRES[nombre] || ENCUADRES.reposo;
    encuadre = nombre;
    posObjetivo.set(...e.pos);
    miraObjetivo.set(...e.mira);
  }

  const ocultarUtileria = () => {
    for (const f of fichasPila) f.visible = false;
    cartaFalsa.visible = false;
    for (const p of puertas) p.visible = false;
    fantasma.visible = false;
    for (const c of cartas) { c.rotation.x = 0; c.position.y = 0.01; }
  };

  /** Pone en escena lo que el guion está contando en ese momento. */
  function gesto(nombre) {
    ocultarUtileria();
    gestoActual = nombre;
    gestoT = 0;
    switch (nombre) {
      case 'grupier':    ponerEncuadre('cerca'); break;
      case 'objetivo':   ponerEncuadre('ancho'); break;
      case 'fichas':     ponerEncuadre('mesa'); fichasPila.forEach((f) => { f.visible = true; f.scale.setScalar(0.01); }); break;
      case 'monton':     ponerEncuadre('mesa'); break;
      case 'compra':     ponerEncuadre('mesa'); break;
      case 'trampa':     ponerEncuadre('complot'); cartaFalsa.visible = true; break;
      case 'dilema':     ponerEncuadre('mesa'); puertas.forEach((p) => { p.visible = true; p.scale.y = 0.01; }); break;
      case 'apuesta':    ponerEncuadre('mesa'); fichasPila.forEach((f) => { f.visible = true; f.scale.setScalar(1); }); break;
      case 'fantasma':   ponerEncuadre('cerca'); fantasma.visible = true; fantasma.position.set(0.9, 0.6, 2.3); break;
      case 'revelacion': ponerEncuadre('mesa'); break;
      default:           ponerEncuadre('reposo');
    }
  }

  function animarUtileria(t, dt) {
    gestoT += dt;
    const p = Math.min(1, gestoT / 1.2);
    const suave = 1 - Math.pow(1 - p, 3);

    if (gestoActual === 'fichas' || gestoActual === 'apuesta') {
      fichasPila.forEach((f, i) => {
        const propio = Math.max(0, Math.min(1, (gestoT - i * 0.12) / 0.5));
        f.scale.setScalar(0.01 + propio * 0.99);
        f.position.y = 0.06 + i * 0.05 + (1 - propio) * 0.9;
        f.rotation.y = t * 0.6 + i;
        if (gestoActual === 'apuesta') f.position.z = 2.75 + Math.sin(t * 1.2 + i) * 0.06;
      });
    }
    if (gestoActual === 'monton' || gestoActual === 'compra' || gestoActual === 'revelacion') {
      cartas.forEach((c, i) => {
        const propio = Math.max(0, Math.min(1, (gestoT - i * 0.3) / 0.7));
        if (gestoActual === 'monton') { c.position.y = 0.01 + Math.sin(t * 1.5 + i) * 0.015; }
        else { c.rotation.x = propio * Math.PI * (gestoActual === 'revelacion' ? 1 : 0.55); c.position.y = 0.01 + propio * 0.18; }
      });
    }
    if (gestoActual === 'trampa') {
      // La carta falsa entra desde fuera de cuadro y se mete en el montón.
      const entrada = Math.min(1, gestoT / 1.6);
      const e = 1 - Math.pow(1 - entrada, 2);
      cartaFalsa.position.set(-2.2 + e * 2.3, 0.2 + (1 - e) * 0.6, 3.05);
      cartaFalsa.rotation.set(0, e * 0.4, (1 - e) * 0.8);
    }
    if (gestoActual === 'dilema') {
      puertas.forEach((p, i) => {
        const propio = Math.max(0, Math.min(1, (gestoT - i * 0.35) / 0.6));
        p.scale.y = 0.01 + propio * 0.99;
        p.position.y = 0.42 * (0.5 + propio * 0.5);
        p.rotation.y = Math.sin(t * 0.8 + i * 2) * 0.12;
      });
    }
    if (gestoActual === 'fantasma') {
      fantasma.position.y = 0.6 + Math.sin(t * 1.4) * 0.18 + suave * 0.5;
      fantasma.material.opacity = 0.35 + Math.abs(Math.sin(t * 1.1)) * 0.45;
      fantasma.rotation.y = t * 0.5;
    }
  }

  function cuadro() {
    if (!animando) return;
    requestAnimationFrame(cuadro);
    const t = reloj.getElapsedTime();
    const dt = Math.min(reloj.getDelta(), 0.05);

    // Boca: si llega amplitud real de la voz, manda esa; si no, oscila.
    const objetivoBoca = hablando
      ? (nivelVoz > 0 ? 0.16 + nivelVoz * 0.95 : 0.25 + Math.abs(Math.sin(t * 11)) * 0.7)
      : 0.16;
    boca.scale.y += (objetivoBoca - boca.scale.y) * 0.42;

    if (!silueta) {
      const parpadeo = 0.78 + Math.sin(t * 9.3) * 0.12 + Math.sin(t * 23.7) * 0.07;
      llama.scale.setScalar(parpadeo);
      const luzVela = escena.getObjectByName('vela');
      if (luzVela) luzVela.intensity = 2.8 + parpadeo * 0.9;
      // Los ojos se encienden con la voz: el punto focal respira con lo que dice.
      matOro.emissiveIntensity = 1 + (hablando ? 0.9 * nivelVoz : 0.25 * Math.abs(Math.sin(t * 1.8)));
    }

    animarUtileria(t, dt);

    // Cámara: siempre en movimiento suave hacia su encuadre.
    camara.position.lerp(posObjetivo, 1 - Math.pow(0.002, dt));
    miraActual.lerp(miraObjetivo, 1 - Math.pow(0.002, dt));
    camara.lookAt(miraActual);

    if (movimientoReducido) { renderizador.render(escena, camara); return; }

    const balanceo = Math.sin(t * 0.55) * 0.07;
    let giroCadera = balanceo;

    if (anticipacion > 0) {
      anticipacion -= dt;
      personaje.position.z = -0.16 * Math.sin((anticipacion / 0.35) * Math.PI);
      capucha.rotation.x = 0.2 * Math.sin((anticipacion / 0.35) * Math.PI);
    } else if (asentamiento > 0) {
      asentamiento -= dt;
      const amortiguado = Math.exp(-asentamiento * 6) * Math.sin(asentamiento * 22) * 0.06;
      personaje.position.y = amortiguado;
      capucha.rotation.x = amortiguado * 1.5;
    } else {
      personaje.position.z += (0 - personaje.position.z) * 0.08;
      personaje.position.y += (0 - personaje.position.y) * 0.1;
      // Al hablar baja apenas la cabeza; con la voz fuerte, la levanta.
      const inclinacion = hablando ? -0.05 + nivelVoz * 0.07 : 0;
      capucha.rotation.x += (inclinacion - capucha.rotation.x) * 0.08;
    }

    if (enfasis > 0) {
      enfasis -= dt;
      giroCadera += 0.1 * Math.sin((enfasis / 0.5) * Math.PI);
      torso.rotation.z = -0.05 * Math.sin((enfasis / 0.5) * Math.PI);
    } else {
      torso.rotation.z += (0 - torso.rotation.z) * 0.07;
    }

    // En el complot, el personaje se inclina hacia la cámara: actúa el secreto.
    const inclinacionEscena = encuadre === 'complot' ? 0.14 : 0;
    torso.rotation.x += (inclinacionEscena - torso.rotation.x) * 0.04;

    personaje.rotation.y = giroCadera;

    historialGiro.push({ t, giro: giroCadera });
    while (historialGiro.length > 40) historialGiro.shift();
    const enElPasado = (retraso) => {
      const objetivo = t - retraso;
      const m = historialGiro.find((h) => h.t >= objetivo) || historialGiro[0];
      return m ? m.giro : giroCadera;
    };
    torso.rotation.y = enElPasado(RETRASO_TORSO) - giroCadera;
    capucha.rotation.y = enElPasado(RETRASO_CAPUCHA) - giroCadera;

    const respira = Math.sin(t * 0.9) * 0.012;
    torso.scale.y = 1 + respira;
    capucha.position.y = 2.4 + respira * 0.6;

    renderizador.render(escena, camara);
  }
  cuadro();

  return {
    disponible: true,
    hablar(valor) {
      if (valor === hablando) return;
      hablando = valor;
      if (valor) { anticipacion = 0.35; asentamiento = 0; }
      else { asentamiento = 0.5; anticipacion = 0; nivelVoz = 0; }
    },
    /** Amplitud real de la voz (0..1): mueve la boca y enciende los ojos. */
    nivel(v) { nivelVoz = Math.max(0, Math.min(1, v || 0)); },
    enfatizar() { enfasis = 0.5; },
    gesto,
    reposo() { gesto('reposo'); },
    redimensionar,
    destruir() {
      animando = false;
      observador.disconnect();
      renderizador.dispose();
      renderizador.domElement.remove();
    }
  };
}
