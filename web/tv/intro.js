/* ============================================================
   Presentación inicial: el grupier explica el juego en la TV.
   El personaje es un dibujo original (encapuchado, ojos encendidos);
   la boca se mueve mientras la voz habla y se queda quieta cuando calla.
   Cada lámina trae su propia ilustración animada en SVG.
   El guion vive en config/narrador.json -> explicacion.pasos
   ============================================================ */

const NS = 'http://www.w3.org/2000/svg';

const ESTILOS = `
.intro{position:fixed;inset:0;z-index:50;display:grid;grid-template-rows:1fr auto;
  background:radial-gradient(90% 90% at 25% 40%,#1a1324 0%,#0b0f1a 65%);
  padding:4vh 4vw;gap:2vh}
.intro .escena{display:grid;grid-template-columns:46% 1fr;gap:3vw;align-items:center}
.intro .personaje{width:100%;height:68vh;min-height:320px;position:relative}
/* Gana en especificidad a la caja de la pantalla principal, que mide 34vh */
.intro .personaje .grupierCaja{height:100%;width:100%}
.intro .personaje svg.grupier{height:100%;width:auto;display:block;margin-inline:auto}

/* Etiquetas sobre la escena: dicen en dos palabras lo que se está viendo */
.intro .etiquetas{position:absolute;inset:auto 0 2%;display:flex;flex-wrap:wrap;
  gap:.8vw;justify-content:center;pointer-events:none}
.intro .chip{background:rgba(11,15,26,.82);border:2px solid var(--oro);color:var(--oro);
  border-radius:999px;padding:.5vh 1.4vw;font-size:1.5vw;font-weight:700;
  white-space:nowrap;animation:chipEntra .45s cubic-bezier(.2,.8,.2,1) both;
  backdrop-filter:blur(2px)}
.intro .chip.apagado{border-color:#4a5a80;color:var(--tenue)}
.intro .chip:nth-child(2){animation-delay:.5s}
.intro .chip:nth-child(3){animation-delay:1s}
@keyframes chipEntra{from{opacity:0;transform:translateY(16px) scale(.9)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.intro .chip{animation:none}}
.intro .texto h2{font-size:2.2vw;color:var(--oro);letter-spacing:.06em;text-transform:uppercase;margin-bottom:1.5vh}
.intro .texto p{font-size:2.5vw;line-height:1.35;text-wrap:balance;margin:0}
.intro .pie{display:flex;align-items:center;gap:1.5vw;font-size:1.3vw;color:var(--tenue)}
.intro .puntos{display:flex;gap:.6vw;flex:1}
.intro .punto{width:1vw;height:1vw;border-radius:50%;background:#2a3350;transition:background .3s}
.intro .punto.activo{background:var(--oro)}
.intro .punto.visto{background:#5a4a1e}

/* ---- el grupier ---- */
.grupier{width:100%;height:auto;filter:drop-shadow(0 0 4vw rgba(242,193,78,.18))}
.grupier .flota{animation:flotar 6s ease-in-out infinite}
@keyframes flotar{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.2%)}}
.grupier .ojo{fill:#ffcf5a;filter:drop-shadow(0 0 8px #f2c14e)}
.grupier.hablando .ojo{animation:parpadeo 2.4s ease-in-out infinite}
@keyframes parpadeo{0%,92%,100%{opacity:1}95%{opacity:.25}}
.grupier .boca{fill:#120a04;transform-origin:center;transform:scaleY(.18)}
.grupier.hablando .boca{animation:hablar .26s ease-in-out infinite alternate}
@keyframes hablar{from{transform:scaleY(.14)}to{transform:scaleY(1)}}
.grupier .brillo{animation:latido 4s ease-in-out infinite}
@keyframes latido{0%,100%{opacity:.35}50%{opacity:.7}}

/* ---- ilustraciones ---- */
.lamina{width:100%;height:30vh}
.lamina .aparece{animation:surgir .5s ease-out both}
.lamina .aparece:nth-child(2){animation-delay:.25s}
.lamina .aparece:nth-child(3){animation-delay:.5s}
.lamina .aparece:nth-child(4){animation-delay:.75s}
@keyframes surgir{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}
.lamina .gira{animation:girarCarta 1.6s ease-in-out infinite alternate;transform-origin:center}
@keyframes girarCarta{from{transform:rotateY(0)}to{transform:rotateY(-55deg)}}
.lamina .cae{animation:caer 2s ease-in-out infinite}
@keyframes caer{0%{transform:translateY(-30px);opacity:0}30%,70%{transform:none;opacity:1}100%{transform:translateY(6px);opacity:0}}
.lamina .pulsa{animation:pulsar 1.8s ease-in-out infinite}
@keyframes pulsar{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
.lamina .vaiven{animation:vaivenAnim 3s ease-in-out infinite}
@keyframes vaivenAnim{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
.lamina .flota2{animation:flotar2 3.5s ease-in-out infinite}
@keyframes flotar2{0%,100%{transform:translateY(0);opacity:.85}50%{transform:translateY(-10px);opacity:1}}
.lamina .abre{animation:abrirTelon 2.6s ease-in-out infinite alternate;transform-origin:left center}
@keyframes abrirTelon{from{transform:scaleX(1)}to{transform:scaleX(.25)}}
@media (prefers-reduced-motion: reduce){
  .grupier .flota,.grupier.hablando .boca,.grupier.hablando .ojo,.grupier .brillo,
  .lamina *{animation:none!important}
  .grupier .boca{transform:scaleY(.5)}
}
`;

/** Respaldo plano en SVG, para PCs sin WebGL. Dibujo propio. */
export const GRUPIER_SVG = `
<svg class="grupier" viewBox="0 0 200 240" xmlns="${NS}" role="img"
     aria-label="El grupier, una figura encapuchada que presenta el juego">
  <defs>
    <radialGradient id="halo" cx="50%" cy="38%" r="55%">
      <stop offset="0%" stop-color="#f2c14e" stop-opacity=".55"/>
      <stop offset="100%" stop-color="#f2c14e" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="tela" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2b2142"/>
      <stop offset="100%" stop-color="#140d20"/>
    </linearGradient>
  </defs>
  <circle class="brillo" cx="100" cy="92" r="88" fill="url(#halo)"/>
  <g class="flota">
    <path d="M100 18c-34 0-58 26-58 62 0 18 5 30 5 44l-22 96h150l-22-96c0-14 5-26 5-44 0-36-24-62-58-62z" fill="url(#tela)"/>
    <path d="M100 30c-27 0-46 21-46 50 0 22 12 38 46 38s46-16 46-38c0-29-19-50-46-50z" fill="#07040c"/>
    <ellipse class="ojo" cx="82" cy="72" rx="9" ry="5.5"/>
    <ellipse class="ojo" cx="118" cy="72" rx="9" ry="5.5"/>
    <ellipse class="boca" cx="100" cy="100" rx="13" ry="9"/>
    <path d="M58 150l42 14 42-14" stroke="#f2c14e" stroke-opacity=".35" stroke-width="2.5" fill="none"/>
    <circle cx="100" cy="176" r="7" fill="#f2c14e" fill-opacity=".8"/>
  </g>
</svg>`;

/* Lo que dicen las etiquetas sobre la escena 3D. Tres como máximo: a tres metros
   no se lee más. Van sincronizadas con la utilería que aparece detrás. */
const ETIQUETAS = {
  grupier:    ['El grupier', 'No juega: cobra'],
  objetivo:   ['Tú ya sabes a quién le regalas', '¿Quién te regala A TI?'],
  fichas:     ['10 fichas para empezar', 'Gana quien termine con más'],
  monton:     ['3 pistas sobre quien te regala', 'Boca abajo'],
  compra:     ['Fácil · 1 ficha', 'Media · 2', 'Difícil · 4'],
  trampa:     ['1 ficha', 'Una mentira en el montón de otro', 'Nadie sabrá que fuiste tú'],
  dilema:     ['Los dos cooperan · +2 cada uno', 'Uno guarda · +3 para él', 'Los dos guardan · nada'],
  apuesta:    ['Aciertas · x2', 'Fallas · pierdes lo apostado'],
  fantasma:   ['Si quien recibe tu regalo falla…', '…tú ganas +3'],
  revelacion: ['Del último al ganador', 'Se destapan las trampas']
};

/* --- ilustraciones por lámina --- */

const LAMINAS = {
  grupier: '',
  objetivo: `
    <svg class="lamina" viewBox="0 0 320 160" xmlns="${NS}" aria-hidden="true">
      ${[30, 130, 230].map((x, i) => `
        <g class="aparece">
          <circle cx="${x + 25}" cy="60" r="20" fill="#2a3350"/>
          <path d="M${x} 130c0-20 11-32 25-32s25 12 25 32z" fill="#2a3350"/>
          ${i === 1 ? '<text x="' + (x + 25) + '" y="68" font-size="26" fill="#f2c14e" text-anchor="middle" font-weight="700">?</text>' : ''}
        </g>`).join('')}
      <path class="vaiven" d="M155 148h10" stroke="#f2c14e" stroke-width="3"/>
    </svg>`,
  fichas: `
    <svg class="lamina" viewBox="0 0 320 160" xmlns="${NS}" aria-hidden="true">
      ${[0, 1, 2, 3].map((i) => `
        <g class="aparece">
          <ellipse cx="160" cy="${132 - i * 22}" rx="52" ry="16" fill="#f2c14e"/>
          <ellipse cx="160" cy="${127 - i * 22}" rx="52" ry="16" fill="#ffd978"/>
        </g>`).join('')}
      <text x="160" y="40" font-size="22" fill="#f4f6fb" text-anchor="middle" font-weight="700">10</text>
    </svg>`,
  monton: `
    <svg class="lamina" viewBox="0 0 320 160" xmlns="${NS}" aria-hidden="true">
      ${[70, 140, 210].map((x) => `
        <g class="aparece">
          <rect x="${x}" y="40" width="56" height="78" rx="7" fill="#1b2238" stroke="#4a5a80" stroke-width="2"/>
          <circle cx="${x + 28}" cy="79" r="13" fill="none" stroke="#f2c14e" stroke-width="2.5"/>
          <text x="${x + 28}" y="86" font-size="17" fill="#f2c14e" text-anchor="middle" font-weight="700">?</text>
        </g>`).join('')}
    </svg>`,
  compra: `
    <svg class="lamina" viewBox="0 0 320 160" xmlns="${NS}" aria-hidden="true">
      ${[[40, '1', '#5ddba0'], [130, '2', '#f2c14e'], [220, '4', '#ff6b67']].map(([x, p, c]) => `
        <g class="aparece">
          <rect x="${x}" y="34" width="62" height="86" rx="7" fill="#1b2238" stroke="${c}" stroke-width="2.5"/>
          <text x="${Number(x) + 31}" y="86" font-size="30" fill="${c}" text-anchor="middle" font-weight="700">${p}</text>
          <text x="${Number(x) + 31}" y="108" font-size="12" fill="#a8b3cc" text-anchor="middle">ficha${p === '1' ? '' : 's'}</text>
        </g>`).join('')}
      <g class="gira"><rect x="130" y="34" width="62" height="86" rx="7" fill="#f2c14e" fill-opacity=".12"/></g>
    </svg>`,
  trampa: `
    <svg class="lamina" viewBox="0 0 320 160" xmlns="${NS}" aria-hidden="true">
      ${[100, 160].map((x) => `<rect x="${x}" y="50" width="52" height="74" rx="6" fill="#1b2238" stroke="#4a5a80" stroke-width="2"/>`).join('')}
      <g class="cae">
        <rect x="130" y="20" width="52" height="74" rx="6" fill="#2a1420" stroke="#ff6b67" stroke-width="2.5"/>
        <text x="156" y="64" font-size="26" fill="#ff6b67" text-anchor="middle" font-weight="700">✗</text>
      </g>
      <text x="250" y="140" font-size="14" fill="#ff6b67" text-anchor="middle">1 ficha</text>
    </svg>`,
  dilema: `
    <svg class="lamina" viewBox="0 0 320 160" xmlns="${NS}" aria-hidden="true">
      <g class="aparece">
        <rect x="40" y="36" width="90" height="92" rx="10" fill="#14281f" stroke="#5ddba0" stroke-width="2.5"/>
        <text x="85" y="78" font-size="15" fill="#5ddba0" text-anchor="middle">COOPERAR</text>
        <text x="85" y="104" font-size="22" fill="#5ddba0" text-anchor="middle" font-weight="700">+2</text>
      </g>
      <g class="aparece">
        <rect x="190" y="36" width="90" height="92" rx="10" fill="#2a1420" stroke="#f2c14e" stroke-width="2.5"/>
        <text x="235" y="78" font-size="15" fill="#f2c14e" text-anchor="middle">GUARDAR</text>
        <text x="235" y="104" font-size="22" fill="#f2c14e" text-anchor="middle" font-weight="700">+3</text>
      </g>
      <path class="pulsa" d="M150 82h20" stroke="#a8b3cc" stroke-width="3"/>
    </svg>`,
  apuesta: `
    <svg class="lamina" viewBox="0 0 320 160" xmlns="${NS}" aria-hidden="true">
      <g class="aparece">
        <circle cx="90" cy="70" r="26" fill="#2a3350"/>
        <path d="M64 124c0-16 12-26 26-26s26 10 26 26z" fill="#2a3350"/>
        <text x="90" y="78" font-size="26" fill="#f2c14e" text-anchor="middle" font-weight="700">?</text>
      </g>
      <g class="pulsa">
        <ellipse cx="225" cy="96" rx="44" ry="14" fill="#f2c14e"/>
        <ellipse cx="225" cy="80" rx="44" ry="14" fill="#ffd978"/>
        <text x="225" y="86" font-size="18" fill="#1b1405" text-anchor="middle" font-weight="700">x2</text>
      </g>
      <path d="M130 86h55" stroke="#a8b3cc" stroke-width="3"/>
    </svg>`,
  fantasma: `
    <svg class="lamina" viewBox="0 0 320 160" xmlns="${NS}" aria-hidden="true">
      <g class="flota2">
        <path d="M160 28c-26 0-44 20-44 46v52l14-12 15 12 15-12 15 12 14-12V74c0-26-18-46-29-46z" fill="#f4f6fb" fill-opacity=".9"/>
        <circle cx="148" cy="66" r="5" fill="#0b0f1a"/><circle cx="172" cy="66" r="5" fill="#0b0f1a"/>
      </g>
      <text x="160" y="150" font-size="22" fill="#5ddba0" text-anchor="middle" font-weight="700">+3</text>
    </svg>`,
  revelacion: `
    <svg class="lamina" viewBox="0 0 320 160" xmlns="${NS}" aria-hidden="true">
      <rect x="60" y="30" width="200" height="100" rx="8" fill="#14101f"/>
      <text x="160" y="90" font-size="20" fill="#f2c14e" text-anchor="middle" font-weight="700">ERA ELLA</text>
      <g class="abre"><rect x="60" y="30" width="100" height="100" fill="#5b1f28"/></g>
      <g class="abre" style="transform-origin:right center"><rect x="160" y="30" width="100" height="100" fill="#5b1f28"/></g>
    </svg>`
};

/**
 * Crea la presentación.
 * @param {object} opciones
 * @param {Array}  opciones.pasos      guion (config/narrador.json -> explicacion.pasos)
 * @param {Function} opciones.hablar   (texto, {alTerminar}) -> boolean: true si va a hablar
 * @param {Function} opciones.duracion (texto) -> ms estimados, para cuando no hay voz
 * @param {Function} opciones.alCambiar se llama en cada lámina (para el golpe de audio)
 * @param {Function} opciones.alFinal   se llama al terminar o al saltar
 */
export function crearIntro({ pasos, hablar, duracion, alCambiar, alFinal, montarPersonaje,
                             desmontarPersonaje, personaje: actor, pausa = 700, minimo = 3200 }) {
  if (!document.getElementById('estilos-intro')) {
    const hoja = document.createElement('style');
    hoja.id = 'estilos-intro';
    hoja.textContent = ESTILOS;
    document.head.appendChild(hoja);
  }

  let indice = -1;
  let temporizador = null;
  let abierta = false;
  let ficha = 0;          // identifica la lámina en curso (ver siguiente())
  let tope = null;        // por si la voz nunca avisa que terminó

  const capa = document.createElement('div');
  capa.className = 'intro oculto';
  capa.setAttribute('role', 'region');
  capa.setAttribute('aria-label', 'El grupier explica el juego');
  capa.innerHTML = `
    <div class="escena">
      <div id="introPersonaje" class="personaje">
        <div id="introEtiquetas" class="etiquetas" aria-hidden="true"></div>
      </div>
      <div class="texto">
        <h2 id="introTitulo"></h2>
        <p id="introLamina" style="margin-bottom:2vh"></p>
        <p id="introTexto" aria-live="polite"></p>
      </div>
    </div>
    <div class="pie">
      <div class="puntos" id="introPuntos">${pasos.map(() => '<div class="punto"></div>').join('')}</div>
      <div>Toca la pantalla o pulsa una tecla para saltar</div>
    </div>`;
  document.body.appendChild(capa);

  // Si hay personaje 3D, él actúa; si no, se mueve la boca del SVG.
  const svg = () => capa.querySelector('.grupier');
  const bocaQuieta = () => { actor?.hablar(false); svg()?.classList.remove('hablando'); };
  const bocaHabla = () => { actor?.hablar(true); svg()?.classList.add('hablando'); };

  function pintarPaso(paso) {
    capa.querySelector('#introTitulo').textContent = paso.titulo || '';
    capa.querySelector('#introTexto').textContent = paso.texto;

    // Las cifras clave, encima de la escena: lo que se oye también se ve.
    const etiquetas = paso.etiquetas || ETIQUETAS[paso.ilustracion] || [];
    capa.querySelector('#introEtiquetas').innerHTML =
      etiquetas.map((t, i) => `<div class="chip ${i > 0 && etiquetas.length === 3 && i === 2 ? 'apagado' : ''}">${t}</div>`).join('');
    // Con personaje 3D, él es la ilustración: la lámina plana sobra.
    capa.querySelector('#introLamina').innerHTML = actor?.disponible ? '' : (LAMINAS[paso.ilustracion] ?? '');
    [...capa.querySelectorAll('.punto')].forEach((p, i) => {
      p.classList.toggle('activo', i === indice);
      p.classList.toggle('visto', i < indice);
    });
  }

  function siguiente() {
    clearTimeout(temporizador);
    clearTimeout(tope);
    indice++;
    if (indice >= pasos.length) return cerrar();

    // Ficha de esta lámina. Si una voz ajena termina —una narración del
    // servidor, por ejemplo— su aviso llega con una ficha vieja y se ignora:
    // así nada adelanta la lámina antes de tiempo.
    const mia = ++ficha;
    const t0 = Date.now();

    /** Pasa a la siguiente, pero nunca antes del tiempo mínimo de lectura. */
    const programarSiguiente = () => {
      if (mia !== ficha) return;
      const falta = Math.max(pausa, minimo - (Date.now() - t0));
      temporizador = setTimeout(() => { if (mia === ficha) siguiente(); }, falta);
    };

    const paso = pasos[indice];
    pintarPaso(paso);
    alCambiar?.(paso);
    // El personaje 3D pone en escena lo que se está contando.
    actor?.gesto?.(paso.ilustracion);
    actor?.enfatizar();
    bocaHabla();

    // Si hay voz, la lámina avanza cuando la voz termina de hablar.
    // Si no hay voz, se avanza por tiempo estimado: la explicación no se congela.
    const habla = hablar?.(paso.texto, {
      personaje: paso.voz || 'explicador',
      alTerminar: () => { clearTimeout(tope); bocaQuieta(); programarSiguiente(); }
    });

    // Red de seguridad: si el audio nunca suena (el navegador puede bloquearlo
    // hasta que alguien toque la pantalla), la lámina no se queda colgada.
    if (habla) {
      const limite = Math.max(minimo + pausa, (duracion?.(paso.texto, paso.voz) ?? 6000) * 2.2);
      tope = setTimeout(() => { bocaQuieta(); if (mia === ficha) siguiente(); }, limite);
    }
    // Sin voz se avanza por tiempo estimado, con un piso generoso: la
    // explicación no se congela, pero tampoco se lee a medias.
    if (!habla) {
      const estimado = Math.max(minimo + pausa, duracion?.(paso.texto, paso.voz) ?? 6000);
      temporizador = setTimeout(() => { bocaQuieta(); if (mia === ficha) siguiente(); }, estimado);
    }
  }

  function abrir() {
    if (abierta) return;
    abierta = true;
    indice = -1;
    capa.classList.remove('oculto');
    const caja = capa.querySelector('#introPersonaje');
    if (montarPersonaje) montarPersonaje(caja);          // inserta sin borrar las etiquetas
    else if (!caja.querySelector('.grupier')) caja.insertAdjacentHTML('afterbegin', GRUPIER_SVG);
    document.addEventListener('keydown', saltar);
    capa.addEventListener('click', saltar);
    siguiente();
  }

  function cerrar() {
    clearTimeout(temporizador);
    clearTimeout(tope);
    ficha++;
    abierta = false;
    bocaQuieta();
    actor?.reposo?.();
    desmontarPersonaje?.();
    capa.classList.add('oculto');
    document.removeEventListener('keydown', saltar);
    capa.removeEventListener('click', saltar);
    alFinal?.();
  }

  function saltar(evento) {
    evento?.preventDefault?.();
    cerrar();
  }

  return { abrir, cerrar, estaAbierta: () => abierta };
}
