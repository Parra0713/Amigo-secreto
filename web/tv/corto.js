/* ============================================================
   El cortometraje que explica el juego.

   No es una lista de reglas con dibujos al lado: es una partida de
   mentiras entre tres personajes —Tita, Nacho y Pipe— en la que cada
   regla se ve ocurrir antes de nombrarse. El guion vive en
   config/corto.json y aquí solo se pone en escena.

   Lo que gobierna este archivo:
   · La voz manda el ritmo. La lámina no pasa hasta que la frase
     termina, y nunca antes del tiempo que toma leerla.
   · Los acentos caen en su palabra: con la duración real del audio se
     reparten los golpes por posición de palabra, sin adivinar.
   · Dos versiones: completa (~3 min) y exprés (~1 min), misma historia.
   · Capítulos navegables con las flechas; cualquier tecla o clic lo salta.
   · El subtítulo es permanente: quien no oye, lee lo mismo.
   ============================================================ */

const ESTILOS = `
.corto{position:fixed;inset:0;z-index:60;display:grid;
  grid-template-rows:auto 1fr auto;gap:1vh;
  background:radial-gradient(85% 85% at 30% 35%,#1a1324 0%,#07060d 70%);
  padding:3vh 4vw}
.corto.oculto{display:none}

.corto .cabecera{display:flex;align-items:baseline;gap:1.5vw;min-height:4vh}
.corto .capitulo{font-size:1.5vw;letter-spacing:.14em;text-transform:uppercase;color:var(--oro)}
.corto .capitulo .n{opacity:.55;margin-right:.6vw}
.corto .marcas{display:flex;gap:.5vw;margin-left:auto}
.corto .marca{width:2.4vw;height:.5vh;border-radius:99px;background:#2a3350;transition:background .4s}
.corto .marca.vista{background:#5a4a1e}
.corto .marca.activa{background:var(--oro)}

.corto .escenario{position:relative;min-height:0}
.corto .escenario .grupierCaja{position:absolute;inset:0;height:100%;width:100%}
.corto .escenario svg.grupier{height:100%;width:auto;display:block;margin-inline:auto}

.corto .etiquetas{position:absolute;inset:auto 0 1%;display:flex;flex-wrap:wrap;
  gap:.8vw;justify-content:center;pointer-events:none}
.corto .chip{background:rgba(7,6,13,.82);border:2px solid var(--oro);color:var(--oro);
  border-radius:999px;padding:.5vh 1.4vw;font-size:1.5vw;font-weight:700;white-space:nowrap;
  animation:chipCorto .5s cubic-bezier(.2,.8,.2,1) both;backdrop-filter:blur(2px)}
.corto .chip:nth-child(2){animation-delay:.45s}
.corto .chip:nth-child(3){animation-delay:.9s}
@keyframes chipCorto{from{opacity:0;transform:translateY(14px) scale(.92)}to{opacity:1;transform:none}}

/* Rótulo del capítulo: entra, se lee, se va. Nace del centro de la escena. */
.corto .rotulo{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
.corto .rotulo span{font-size:3.4vw;color:var(--oro);letter-spacing:.08em;text-align:center;
  text-shadow:0 0 6vw rgba(0,0,0,.9);animation:rotuloCorto 2.2s ease-in-out both}
@keyframes rotuloCorto{
  0%{opacity:0;transform:scale(.92)}
  18%{opacity:1;transform:scale(1)}
  78%{opacity:1;transform:scale(1)}
  100%{opacity:0;transform:scale(1.03)}}

.corto .pie{display:grid;gap:.8vh}
.corto .subtitulo{font-size:2.3vw;line-height:1.3;text-wrap:balance;text-align:center;
  margin:0;min-height:6vh}
.corto .subtitulo b{color:var(--oro);font-weight:700}
.corto .ayuda{display:flex;justify-content:center;gap:2vw;font-size:1.2vw;color:var(--tenue)}

@media (prefers-reduced-motion: reduce){
  .corto .chip,.corto .rotulo span{animation:none}
}
`;

/** Parte el texto en palabras conservando la posición de cada una. */
const palabrasDe = (texto) => String(texto).trim().split(/\s+/);

/**
 * En qué fracción del audio cae una palabra. Reparte por posición:
 * no es alineación fonética, pero con la duración real del audio cae
 * lo bastante cerca para que el golpe se sienta a tiempo.
 */
export function fraccionDePalabra(texto, palabra) {
  const palabras = palabrasDe(texto);
  const limpia = (p) => p.toLowerCase().replace(/[^0-9a-zá-úñü]/gi, '');
  const i = palabras.findIndex((p) => limpia(p) === limpia(palabra));
  if (i < 0) return null;
  // El centro de la palabra, no su borde.
  return (i + 0.5) / palabras.length;
}

/**
 * @param {object} o
 * @param {Array}  o.capitulos  guion (config/corto.json)
 * @param {Function} o.hablar   (texto, {personaje, alEmpezar(dur), alTerminar}) -> boolean
 * @param {Function} o.duracion (texto, personaje) -> ms estimados
 * @param {object}  o.personaje actor 3D (opcional)
 * @param {Function} o.montarPersonaje / o.desmontarPersonaje
 * @param {Function} o.alCambiar  golpe de audio en cada lámina
 * @param {Function} o.alFinal
 */
export function crearCorto({
  capitulos, hablar, duracion, personaje: actor, montarPersonaje, desmontarPersonaje,
  alCambiar, alFinal, pausa = 900, minimo = 3600
}) {
  if (!document.getElementById('estilos-corto')) {
    const hoja = document.createElement('style');
    hoja.id = 'estilos-corto';
    hoja.textContent = ESTILOS;
    document.head.appendChild(hoja);
  }

  const capa = document.createElement('div');
  capa.className = 'corto oculto';
  capa.setAttribute('role', 'region');
  capa.setAttribute('aria-label', 'Explicación del juego');
  capa.innerHTML = `
    <div class="cabecera">
      <div class="capitulo" id="cortoCapitulo" aria-live="polite"></div>
      <div class="marcas" id="cortoMarcas" aria-hidden="true"></div>
    </div>
    <div class="escenario" id="cortoEscenario">
      <div class="etiquetas" id="cortoEtiquetas" aria-hidden="true"></div>
      <div class="rotulo oculto" id="cortoRotulo"><span></span></div>
    </div>
    <div class="pie">
      <p class="subtitulo" id="cortoSubtitulo" aria-live="polite"></p>
      <div class="ayuda">
        <span>Flechas: capítulo</span><span>Barra: pausa</span><span>Cualquier otra tecla: saltar</span>
      </div>
    </div>`;
  document.body.appendChild(capa);

  const $ = (id) => capa.querySelector(`#${id}`);
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let guion = [];          // pasos aplanados, con su capítulo
  let indice = -1;
  let ficha = 0;           // identifica la lámina en curso
  let temporizador = null;
  let tope = null;
  let acentos = [];        // temporizadores de los golpes
  let abierta = false;
  let enPausa = false;
  let expres = false;

  const bocaQuieta = () => { actor?.hablar(false); capa.querySelector('.grupier')?.classList.remove('hablando'); };
  const bocaHabla = () => { actor?.hablar(true); capa.querySelector('.grupier')?.classList.add('hablando'); };

  /** Aplana el guion a una lista de láminas, según la versión elegida. */
  function armar() {
    guion = [];
    capitulos.forEach((cap, iCap) => {
      const pasos = expres ? cap.pasos.filter((p) => p.expres) : cap.pasos;
      pasos.forEach((paso, iPaso) => guion.push({
        ...paso,
        texto: expres ? (paso.textoExpres || paso.texto) : paso.texto,
        capitulo: cap.titulo,
        nCapitulo: iCap,
        primeroDelCapitulo: iPaso === 0
      }));
    });
    $('cortoMarcas').innerHTML = capitulos.map(() => '<div class="marca"></div>').join('');
  }

  function pintarMarcas(nCapitulo) {
    [...capa.querySelectorAll('.marca')].forEach((m, i) => {
      m.classList.toggle('activa', i === nCapitulo);
      m.classList.toggle('vista', i < nCapitulo);
    });
  }

  function rotulo(texto) {
    const caja = $('cortoRotulo');
    caja.querySelector('span').textContent = texto;
    caja.classList.remove('oculto');
    const visible = reducido ? 1400 : 2200;
    setTimeout(() => caja.classList.add('oculto'), visible);
  }

  function limpiarAcentos() {
    acentos.forEach(clearTimeout);
    acentos = [];
  }

  /** Programa los golpes de cada acento sobre la duración real del audio. */
  function programarAcentos(paso, duracionMs) {
    limpiarAcentos();
    for (const acento of paso.acentos || []) {
      const f = fraccionDePalabra(paso.texto, acento.palabra);
      if (f === null) continue;
      acentos.push(setTimeout(() => {
        if (acento.hacer === 'marcar') actor?.escena?.('marcar', { quien: acento.quien });
        else actor?.enfatizar?.();
      }, Math.max(0, duracionMs * f - 120)));   // un pelo antes: el ojo va delante del oído
    }
  }

  function pintar(paso) {
    $('cortoCapitulo').innerHTML = `<span class="n">${paso.nCapitulo + 1}/${capitulos.length}</span>${paso.capitulo}`;
    $('cortoSubtitulo').textContent = paso.texto;
    $('cortoEtiquetas').innerHTML = (paso.etiquetas || [])
      .map((t) => `<div class="chip">${t}</div>`).join('');
    pintarMarcas(paso.nCapitulo);
  }

  function siguiente() {
    clearTimeout(temporizador);
    clearTimeout(tope);
    limpiarAcentos();
    indice++;
    if (indice >= guion.length) return cerrar();

    const paso = guion[indice];
    const mia = ++ficha;
    const t0 = Date.now();

    pintar(paso);
    if (paso.primeroDelCapitulo && !expres) rotulo(paso.capitulo);
    alCambiar?.(paso);
    // La escena hace lo que el texto va a contar, medio segundo antes de contarlo.
    if (paso.accion) actor?.escena?.(paso.accion.nombre, paso.accion);
    bocaHabla();

    let duracionReal = 0;        // ms, cuando el audio dice cuánto mide

    const programarSiguiente = () => {
      if (mia !== ficha || enPausa) return;
      const falta = Math.max(pausa, minimo - (Date.now() - t0));
      temporizador = setTimeout(() => { if (mia === ficha) siguiente(); }, falta);
    };

    const habla = hablar?.(paso.texto, {
      personaje: paso.voz || 'explicador',
      alEmpezar: (segundos) => {
        duracionReal = (segundos || 0) * 1000;
        programarAcentos(paso, duracionReal || (duracion?.(paso.texto, paso.voz) ?? 6000));
      },
      alTerminar: () => {
        // Un "ya terminé" que llega mucho antes de lo que mide el audio no es
        // el final de esta frase: es el eco de otra que se canceló. Se ignora,
        // y el tope de seguridad sigue vigilando por si de verdad no suena.
        if (duracionReal && Date.now() - t0 < duracionReal * 0.6) return;
        clearTimeout(tope);
        bocaQuieta();
        programarSiguiente();
      }
    });

    if (habla) {
      const limite = Math.max(minimo + pausa, (duracion?.(paso.texto, paso.voz) ?? 6000) * 2.4);
      tope = setTimeout(() => { bocaQuieta(); if (mia === ficha) siguiente(); }, limite);
    } else {
      const estimado = Math.max(minimo + pausa, duracion?.(paso.texto, paso.voz) ?? 6000);
      programarAcentos(paso, estimado);
      temporizador = setTimeout(() => { bocaQuieta(); if (mia === ficha) siguiente(); }, estimado);
    }
  }

  /** Salta al primer paso de otro capítulo. */
  function irACapitulo(n) {
    const destino = Math.max(0, Math.min(capitulos.length - 1, n));
    const i = guion.findIndex((p) => p.nCapitulo === destino);
    if (i < 0) return;
    indice = i - 1;
    ficha++;
    siguiente();
  }

  function pausar() {
    enPausa = !enPausa;
    if (enPausa) {
      clearTimeout(temporizador);
      clearTimeout(tope);
      limpiarAcentos();
      $('cortoSubtitulo').textContent = `⏸ ${guion[indice]?.texto || ''}`;
    } else {
      indice--;                 // repite la lámina en pausa, con su voz
      siguiente();
    }
  }

  function teclas(evento) {
    const k = evento.key;
    if (k === 'ArrowRight') { evento.preventDefault(); return irACapitulo((guion[indice]?.nCapitulo ?? 0) + 1); }
    if (k === 'ArrowLeft')  { evento.preventDefault(); return irACapitulo((guion[indice]?.nCapitulo ?? 0) - 1); }
    if (k === ' ')          { evento.preventDefault(); return pausar(); }
    saltar(evento);
  }

  function abrir({ expres: corta = false } = {}) {
    if (abierta) return;
    abierta = true;
    expres = corta;
    enPausa = false;
    armar();
    if (!guion.length) { abierta = false; return alFinal?.(); }
    indice = -1;
    capa.classList.remove('oculto');
    const escenario = $('cortoEscenario');
    if (montarPersonaje) montarPersonaje(escenario);
    document.addEventListener('keydown', teclas);
    capa.addEventListener('click', saltar);
    siguiente();
  }

  function cerrar() {
    clearTimeout(temporizador);
    clearTimeout(tope);
    limpiarAcentos();
    ficha++;
    abierta = false;
    bocaQuieta();
    actor?.reposo?.();
    desmontarPersonaje?.();
    capa.classList.add('oculto');
    document.removeEventListener('keydown', teclas);
    capa.removeEventListener('click', saltar);
    alFinal?.();
  }

  function saltar(evento) {
    evento?.preventDefault?.();
    cerrar();
  }

  return {
    abrir,
    cerrar,
    irACapitulo,
    estaAbierta: () => abierta,
    /** Cuántas láminas tiene cada versión: lo usa la prueba. */
    cuenta: ({ expres: corta = false } = {}) =>
      capitulos.reduce((n, c) => n + (corta ? c.pasos.filter((p) => p.expres).length : c.pasos.length), 0)
  };
}
