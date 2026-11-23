/* ============================================================
   Reconexión y reinicio, de extremo a extremo y con el servidor
   de verdad: se levanta el proceso, se conectan sockets, se les
   corta la red y se verifica que la partida siga en pie.

   Esto existe porque es el fallo más probable de la noche real:
   el celular se bloquea, el WiFi se cae un segundo, o al PC le
   toca reiniciar el servidor a mitad de juego. Nada de eso puede
   costar la partida.
   ============================================================ */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Levanta el servidor en un puerto y una carpeta de datos propios. */
async function levantar({ puerto, datos }) {
  const proceso = spawn(process.execPath, ['server/index.js'], {
    cwd: raiz,
    // Con la voz en su hilo, como corre de verdad. Puesta en el hilo principal,
    // la generación bloquea el servidor decenas de segundos y estas pruebas
    // fallan por tiempo: justamente el error que el hilo vino a arreglar.
    env: { ...process.env, PUERTO: String(puerto), CARPETA_DATOS: datos },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  proceso.stdout.on('data', (d) => { log += d; });
  proceso.stderr.on('data', (d) => { log += d; });

  const hasta = Date.now() + 25000;
  while (Date.now() < hasta) {
    try {
      const r = await fetch(`http://127.0.0.1:${puerto}/api/cuestionario`);
      if (r.ok) return { proceso, base: `http://127.0.0.1:${puerto}`, get log() { return log; } };
    } catch {}
    await esperar(150);
  }
  proceso.kill('SIGKILL');
  throw new Error(`el servidor no arrancó:\n${log}`);
}

const apagar = async (servidor) => {
  servidor.proceso.kill('SIGKILL');
  await esperar(200);
};

/** Socket con buzón: guarda todo lo recibido y permite esperar un tipo. */
function abrir(base, hola) {
  const ws = new WebSocket(`${base.replace('http', 'ws')}/ws`);
  const recibido = [];
  ws.on('message', (d) => { try { recibido.push(JSON.parse(String(d))); } catch {} });
  const listo = new Promise((cumplir, fallar) => {
    ws.on('open', () => { ws.send(JSON.stringify(hola)); cumplir(); });
    ws.on('error', fallar);
  });
  return {
    ws, recibido, listo,
    enviar: (m) => ws.send(JSON.stringify(m)),
    /** Espera un mensaje de ese tipo; devuelve el último que llegó. */
    async esperarTipo(t, limiteMs = 6000) {
      return this.esperarMensaje((m) => m.t === t, limiteMs, `"${t}"`);
    },
    /** Espera un mensaje que cumpla la condición: el buzón ya tiene los viejos. */
    async esperarMensaje(cumple, limiteMs = 8000, que = 'el mensaje') {
      const hasta = Date.now() + limiteMs;
      while (Date.now() < hasta) {
        const m = [...recibido].reverse().find(cumple);
        if (m) return m;
        await esperar(60);
      }
      throw new Error(`no llegó ${que}. Llegó: ${recibido.map((x) => x.t).join(', ')}`);
    },
    /** Espera una vista en una fase concreta. */
    vistaEn(fase, limiteMs = 12000) {
      return this.esperarMensaje((m) => m.t === 'vista' && m.vista?.fase === fase, limiteMs, `vista en ${fase}`);
    },
    cortar: () => ws.terminate()      // como quedarse sin WiFi: sin despedida
  };
}

const registrar = async (base, apodo) => {
  const r = await fetch(`${base}/api/registrar`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ apodo, avatar: '🤖' })
  });
  assert.ok(r.ok, `registro de ${apodo} falló`);
  return r.json();
};

/** Deja una partida en ronda 1 con dos jugadores y devuelve todo lo necesario. */
async function partidaEnRonda1(servidor) {
  const { base } = servidor;
  const jugadores = [await registrar(base, 'Ana'), await registrar(base, 'Beto')];
  const sockets = [];
  for (const j of jugadores) {
    const s = abrir(base, { t: 'hola', rol: 'play', jugadorId: j.id, pin: j.pin });
    await s.listo;
    sockets.push(s);
  }
  const admin = abrir(base, { t: 'hola', rol: 'admin', pin: '2468' });
  await admin.listo;
  admin.enviar({ t: 'admin.automatico' });        // apagar el piloto: prueba determinística
  await esperar(250);

  for (const [i, s] of sockets.entries()) {
    s.enviar({ t: 'registro.cuestionario', respuestas: respuestas(i) });
    s.enviar({ t: 'registro.pareja', receptorId: jugadores[(i + 1) % 2].id });
  }
  await esperar(500);
  admin.enviar({ t: 'admin.iniciar' });
  // Sin TV conectada no hay explicación de ronda: la fase arranca de una.
  await sockets[0].vistaEn('ronda1');
  return { jugadores, sockets, admin };
}

const respuestas = (i) => ({
  cumple_mes: ['marzo', 'julio'][i], comida: ['ajiaco', 'pizza'][i], color: ['azul', 'verde'][i],
  serie: ['Serie A', 'Serie B'][i], lugar: ['Japón', 'Cartagena'][i], mascota: ['perro', 'gato'][i],
  hobby: ['cocinar', 'leer'][i], talento: ['cantar', 'dibujar'][i], mania: ['tararear', 'morderse el labio'][i],
  bebida: ['café', 'té'][i], madrugador: ['madrugador', 'trasnochador'][i]
});

// ---------------------------------------------------------------

test('se le cae el WiFi a un celular y al volver recupera su partida completa', async (t) => {
  const datos = mkdtempSync(join(tmpdir(), 'recon-'));
  const servidor = await levantar({ puerto: 8211, datos });
  t.after(async () => { await apagar(servidor); rmSync(datos, { recursive: true, force: true }); });

  const { jugadores, sockets } = await partidaEnRonda1(servidor);

  // Ana compra una pista: algo que no se puede perder al reconectar.
  const antes = await sockets[0].vistaEn('ronda1');
  const tarjeta = antes.vista.monton.find((x) => x.precio <= antes.vista.yo.fichas);
  sockets[0].enviar({ t: 'ronda1.comprar', tarjetaId: tarjeta.id });
  const conCompra = await sockets[0].esperarMensaje(
    (m) => m.t === 'vista' && m.vista.monton?.some((x) => x.comprada), 8000, 'la vista con la compra');
  assert.equal(conCompra.vista.monton.filter((x) => x.comprada).length, 1, 'la compra tiene que haber quedado');

  // Se cae la red, sin aviso.
  sockets[0].cortar();
  await esperar(400);

  // Y vuelve con el mismo PIN, como hace el celular solo.
  const vuelta = abrir(servidor.base, { t: 'hola', rol: 'play', jugadorId: jugadores[0].id, pin: jugadores[0].pin });
  await vuelta.listo;
  const despues = await vuelta.vistaEn(conCompra.vista.fase);

  assert.equal(despues.vista.fase, conCompra.vista.fase, 'misma fase');
  assert.equal(despues.vista.yo.fichas, conCompra.vista.yo.fichas, 'las fichas no cambian');
  assert.equal(despues.vista.monton.filter((x) => x.comprada).length, 1, 'la pista comprada sigue comprada');
  assert.ok(despues.vista.monton.find((x) => x.comprada).texto, 'y se puede seguir leyendo');
  assert.ok(!vuelta.recibido.some((m) => m.t === 'error'), 'reconectar no es un error');
  vuelta.cortar();
});

test('al reconectar no se cuela el secreto de nadie', async (t) => {
  const datos = mkdtempSync(join(tmpdir(), 'recon2-'));
  const servidor = await levantar({ puerto: 8212, datos });
  t.after(async () => { await apagar(servidor); rmSync(datos, { recursive: true, force: true }); });

  const { jugadores, sockets } = await partidaEnRonda1(servidor);
  sockets[1].cortar();
  await esperar(300);

  const vuelta = abrir(servidor.base, { t: 'hola', rol: 'play', jugadorId: jugadores[1].id, pin: jugadores[1].pin });
  await vuelta.listo;
  await vuelta.vistaEn('ronda1');

  const todo = JSON.stringify(vuelta.recibido);
  assert.ok(!todo.includes('receptorId'), 'las parejas no salen del servidor');
  assert.ok(!todo.includes('respuestas'), 'ni las respuestas del cuestionario');
  vuelta.cortar();
});

test('el PIN equivocado no entra, y el jugador correcto sí', async (t) => {
  const datos = mkdtempSync(join(tmpdir(), 'recon3-'));
  const servidor = await levantar({ puerto: 8213, datos });
  t.after(async () => { await apagar(servidor); rmSync(datos, { recursive: true, force: true }); });

  const jugador = await registrar(servidor.base, 'Ana');
  const malo = abrir(servidor.base, { t: 'hola', rol: 'play', jugadorId: jugador.id, pin: '0000' });
  await malo.listo;
  const error = await malo.esperarTipo('error');
  assert.match(error.codigo, /PIN/i);
  malo.cortar();

  const bueno = abrir(servidor.base, { t: 'hola', rol: 'play', jugadorId: jugador.id, pin: jugador.pin });
  await bueno.listo;
  await bueno.esperarTipo('vista');
  bueno.cortar();
});

test('se reinicia el servidor a mitad de partida y nadie pierde nada', async (t) => {
  const datos = mkdtempSync(join(tmpdir(), 'recon4-'));
  let servidor = await levantar({ puerto: 8214, datos });
  t.after(async () => { await apagar(servidor); rmSync(datos, { recursive: true, force: true }); });

  const { jugadores, sockets } = await partidaEnRonda1(servidor);
  const antes = await sockets[0].vistaEn('ronda1');
  const tarjeta = antes.vista.monton.find((x) => x.precio <= antes.vista.yo.fichas);
  sockets[0].enviar({ t: 'ronda1.comprar', tarjetaId: tarjeta.id });
  const conCompra = await sockets[0].esperarMensaje(
    (m) => m.t === 'vista' && m.vista.monton?.some((x) => x.comprada), 8000, 'la vista con la compra');
  await esperar(400);        // que el snapshot alcance a quedar en disco

  // Se cae el servidor entero (como cerrar la ventana negra sin querer).
  await apagar(servidor);
  servidor = await levantar({ puerto: 8214, datos });

  const vuelta = abrir(servidor.base, { t: 'hola', rol: 'play', jugadorId: jugadores[0].id, pin: jugadores[0].pin });
  await vuelta.listo;
  const despues = await vuelta.vistaEn(conCompra.vista.fase);

  assert.equal(despues.vista.fase, conCompra.vista.fase, 'la partida sigue en la misma fase');
  assert.equal(despues.vista.yo.fichas, conCompra.vista.yo.fichas, 'y con las mismas fichas');
  assert.equal(despues.vista.monton.filter((x) => x.comprada).length, 1, 'la compra sobrevivió al reinicio');
  assert.equal(despues.vista.yo.apodo, conCompra.vista.yo.apodo);
  vuelta.cortar();
});

test('dos pestañas del mismo jugador no se pelean la sesión', async (t) => {
  const datos = mkdtempSync(join(tmpdir(), 'recon5-'));
  const servidor = await levantar({ puerto: 8215, datos });
  t.after(async () => { await apagar(servidor); rmSync(datos, { recursive: true, force: true }); });

  const { jugadores, sockets } = await partidaEnRonda1(servidor);

  // El celular abre otra pestaña sin cerrar la primera.
  const segunda = abrir(servidor.base, { t: 'hola', rol: 'play', jugadorId: jugadores[0].id, pin: jugadores[0].pin });
  await segunda.listo;
  const vista2 = await segunda.vistaEn('ronda1');
  assert.equal(vista2.vista.yo.apodo, 'Ana');

  // La primera sigue viva y sigue recibiendo: ninguna echa a la otra.
  const antes = sockets[0].recibido.length;
  const tarjeta = vista2.vista.monton.find((x) => x.precio <= vista2.vista.yo.fichas);
  segunda.enviar({ t: 'ronda1.comprar', tarjetaId: tarjeta.id });
  await esperar(500);
  assert.ok(sockets[0].recibido.length > antes, 'la primera pestaña también se enteró');
  const ultima = await sockets[0].esperarTipo('vista');
  assert.equal(ultima.vista.monton.filter((x) => x.comprada).length, 1);
  segunda.cortar();
});

test('mientras genera voz en segundo plano, el servidor sigue atendiendo', async (t) => {
  const datos = mkdtempSync(join(tmpdir(), 'recon6-'));
  const servidor = await levantar({ puerto: 8216, datos });
  t.after(async () => { await apagar(servidor); rmSync(datos, { recursive: true, force: true }); });

  // Registrarse dispara el pre-generado de las frases que nombran al jugador:
  // es el momento de más trabajo de CPU de toda la partida.
  const jugador = await registrar(servidor.base, 'Ana');
  const s = abrir(servidor.base, { t: 'hola', rol: 'play', jugadorId: jugador.id, pin: jugador.pin });
  await s.listo;
  await s.esperarTipo('vista', 8000);

  // Y aun así tiene que contestar rápido. Antes de mover la voz a su hilo,
  // esto se quedaba callado más de veinte segundos.
  const t0 = Date.now();
  s.enviar({ t: 'ping' });
  await s.esperarTipo('pong', 4000);
  const tardo = Date.now() - t0;
  assert.ok(tardo < 2500, `el servidor tardó ${tardo} ms en contestar un ping`);
  s.cortar();
});

test('nadie en el WiFi puede sacarle archivos al servidor', async (t) => {
  /* El servidor sirve una carpeta estática en la red de la casa, y al lado de
     esa carpeta viven las respuestas del cuestionario y las parejas del
     sorteo. Una ruta que se salga de web/ deja de ser un detalle técnico y
     pasa a ser la lista de quién le regala a quién. */
  const datos = mkdtempSync(join(tmpdir(), 'recon7-'));
  const servidor = await levantar({ puerto: 8217, datos });
  t.after(async () => { await apagar(servidor); rmSync(datos, { recursive: true, force: true }); });

  const intentos = [
    '/../config/reglas.json',
    '/../../config/reglas.json',
    '/%2e%2e/config/reglas.json',
    '/..%2fconfig/reglas.json',
    '/%2e%2e%2f%2e%2e%2fpackage.json',
    '/tv/../../config/reglas.json'
  ];
  for (const ruta of intentos) {
    const r = await fetch(`${servidor.base}${ruta}`);
    const cuerpo = await r.text();
    assert.ok(r.status >= 400, `${ruta} respondió ${r.status}`);
    assert.ok(!cuerpo.includes('minimoJugadores'), `${ruta} entregó la configuración`);
    assert.ok(!cuerpo.includes('plan-amigo-secreto'), `${ruta} entregó package.json`);
  }

  // Y lo que sí tiene que servir, sigue sirviendo.
  for (const ruta of ['/tv/', '/play/', '/shared/estilos.css', '/tv/puesta.js']) {
    assert.equal((await fetch(`${servidor.base}${ruta}`)).status, 200, `${ruta} dejó de servirse`);
  }
});
