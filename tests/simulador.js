// Simulador de partida completa con bots por WebSocket.
// Uso:  node tests/simulador.js [cantidadDeBots]
// Levanta el servidor en un puerto aparte y con su propia carpeta de datos,
// juega una partida entera y revisa que ningún bot haya recibido datos ajenos.

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CANTIDAD = Number(process.argv[2] || 8);
// --auto: no se toca el panel del grupier. El juego debe avanzar por sí solo.
const AUTO = process.argv.includes('--auto');
const PUERTO = Number(process.env.PUERTO || 8123);
const BASE = `http://127.0.0.1:${PUERTO}`;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const RESPUESTAS = (i) => ({
  cumple_mes: ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][i % 12],
  comida: ['pizza','sancocho','sushi','ajiaco','pasta','hamburguesa','tamales','empanadas'][i % 8],
  color: ['azul','rojo','verde','negro','morado','amarillo','gris','blanco'][i % 8],
  serie: `Serie ${String.fromCharCode(65 + i)}`,
  lugar: i % 2 ? 'Cartagena' : 'Japon',
  mascota: ['perro','gato','ninguna','pez'][i % 4],
  hobby: ['leer','ver series','hacer deporte','cocinar','videojuegos','música','dormir','manualidades'][i % 8],
  talento: `armar cosas ${i}`,
  mania: `cantar en la ducha ${i}`,
  bebida: ['café','té','gaseosa','agua'][i % 4],
  madrugador: ['madrugador','trasnochador','depende del día'][i % 3]
});

function abrirSocket(saludo, alMensaje) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${PUERTO}/ws`);
    socket.onopen = () => { socket.send(JSON.stringify(saludo)); resolve(socket); };
    socket.onmessage = (e) => alMensaje(JSON.parse(e.data));
    socket.onerror = reject;
  });
}

async function main() {
  const carpeta = mkdtempSync(join(tmpdir(), 'plan-sim-'));
  const servidor = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PUERTO: String(PUERTO), CARPETA_DATOS: carpeta },
    stdio: ["ignore","pipe","pipe"]
  });
  let logServidor = '';
  servidor.stdout.on('data', (d) => { logServidor += d; });
  // Con DEPURAR=1 se ve el log del servidor intercalado: sirve para ver
  // qué acción rechazó y por qué.
  servidor.stderr.on('data', (d) => { logServidor += d; if (process.env.DEPURAR) process.stdout.write(`   [srv] ${d}`); });
  servidor.stdout.on('data', (d) => { if (process.env.DEPURAR) process.stdout.write(`   [srv] ${d}`); });

  // Esperar a que el servidor responda.
  for (let i = 0; i < 40; i++) {
    try { await fetch(`${BASE}/api/cuestionario`); break; } catch { await esperar(250); }
  }

  const bots = [];
  const enviar = (bot, mensaje) => { bot.ultimaAccion = mensaje.t; bot.socket.send(JSON.stringify(mensaje)); };
  const errores = [];
  const narraciones = [];

  // --- registro ---
  for (let i = 0; i < CANTIDAD; i++) {
    const r = await fetch(`${BASE}/api/registrar`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apodo: `Bot${i}`, avatar: '🤖' })
    });
    const datos = await r.json();
    if (!r.ok) throw new Error(`registro falló: ${JSON.stringify(datos)}`);
    const bot = { ...datos, i, vista: null, recibido: [] };
    bot.socket = await abrirSocket({ t: 'hola', rol: 'play', jugadorId: bot.id, pin: bot.pin }, (m) => {
      bot.recibido.push(m);
      if (m.t === 'vista') bot.vista = m.vista;
      if (m.t === 'entradaRonda') bot.esperando = true;
      if (m.t === 'entradaLista') bot.esperando = false;
      if (m.t === 'error') {
        errores.push(`${bot.apodo}: ${m.codigo} (tras ${bot.ultimaAccion || '?'})`);
        if (process.env.DEPURAR) console.log(`   · rechazo ${m.codigo} · bot ${bot.i} · fase ${bot.vista?.fase}`);
      }
    });
    bots.push(bot);
  }

  const admin = await abrirSocket({ t: 'hola', rol: 'admin', pin: '2468' }, (m) => {
    if (m.t === 'error') errores.push(`admin: ${m.codigo}`);
  });
  let entradasExplicadas = 0;
  const tv = await abrirSocket({ t: 'hola', rol: 'tv' }, (m) => {
    if (m.t === 'narrador') narraciones.push(m.texto);
    // La TV de verdad explica la ronda y luego avisa; aquí se simula al instante.
    if (m.t === 'entradaRonda') {
      entradasExplicadas++;
      setTimeout(() => tv.send(JSON.stringify({ t: 'tv.entradaLista' })), 60);
    }
  });

  // Por defecto se apaga el piloto automático para que la prueba sea determinística.
  // Con --auto se deja puesto: entonces nadie toca el panel y el juego avanza solo.
  if (!AUTO) admin.send(JSON.stringify({ t: 'admin.automatico' }));
  await esperar(300);

  for (const bot of bots) {
    bot.socket.send(JSON.stringify({ t: 'registro.cuestionario', respuestas: RESPUESTAS(bot.i) }));
    // En círculo: cada uno le regala al siguiente.
    bot.socket.send(JSON.stringify({ t: 'registro.pareja', receptorId: bots[(bot.i + 1) % CANTIDAD].id }));
    if (bot.i === 0) enviar(bot, { t: 'registro.tarjetas', media: 'Siempre llega con pandebonos' });
  }
  await esperar(600);

  const fase = () => bots[0].vista?.fase;
  /** Espera a la fase Y a que el grupier termine de explicarla. */
  const esperarFase = async (objetivo, limiteMs = 90000) => {
    const hasta = Date.now() + limiteMs;
    while (fase() !== objetivo && Date.now() < hasta) await esperar(200);
    while (bots.some((b) => b.esperando) && Date.now() < hasta) await esperar(100);
    await esperar(150);
    return fase() === objetivo;
  };

  console.log(`\n▶ ${CANTIDAD} bots registrados.${AUTO ? ' Nadie toca el panel: el juego debe arrancar solo.' : ' Iniciando partida…'}`);
  if (AUTO) {
    const arranco = await esperarFase('ronda1');
    console.log(arranco ? '   ✅ arrancó sin intervención' : '   ❌ no arrancó solo');
    if (!arranco) process.exit(1);
  } else {
    admin.send(JSON.stringify({ t: 'admin.iniciar' }));
    await esperarFase('ronda1');
  }

  // --- ronda 1: todos compran lo que puedan ---
  console.log(`▶ Fase: ${fase()} — compra de pistas`);
  for (const bot of bots) {
    for (const tarjeta of bot.vista.monton) {
      if (bot.vista.yo.fichas >= tarjeta.precio && (bot.i + tarjeta.precio) % 3 !== 0) {
        enviar(bot, { t: 'ronda1.comprar', tarjetaId: tarjeta.id });
        await esperar(30);
      }
    }
  }
  await esperar(400);
  // Todos avisan que terminaron de comprar: eso debe cerrar la ronda por sí solo.
  for (const bot of bots) { enviar(bot, { t: 'ronda1.listo' }); await esperar(20); }
  await esperar(300);
  const compradas = bots.reduce((n, b) => n + b.vista.monton.filter((t) => t.comprada).length, 0);
  const conTexto = bots.every((b) => b.vista.monton.every((t) => (t.comprada ? t.texto : t.texto === null)));
  console.log(`   ${compradas} pistas compradas · texto solo en las compradas: ${conTexto ? 'sí' : 'NO'}`);

  // --- ronda 2: trampas ---
  if (!AUTO) admin.send(JSON.stringify({ t: 'admin.siguiente' }));
  await esperarFase('ronda2');
  console.log(`▶ Fase: ${fase()} — trampas`);
  for (const bot of bots) {
    const victima = bots[(bot.i + 3) % CANTIDAD];
    if (victima.id === bot.id) continue;
    bot.socket.send(JSON.stringify({
      t: 'ronda2.trampa', victimaId: victima.id,
      categoria: ['gustos', 'entretenimiento', 'hogar', 'rutina'][bot.i % 4],
      nivel: ['facil', 'media', 'dificil'][bot.i % 3]
    }));
    await esperar(40);
  }
  for (const bot of bots) { enviar(bot, { t: 'ronda2.pasar' }); await esperar(20); }
  await esperar(400);
  const montonesCrecidos = bots.filter((b) => b.vista.monton.length > 3).length;
  console.log(`   ${montonesCrecidos} montones recibieron al menos una falsa`);

  // --- ronda 3: dilema ---
  if (!AUTO) admin.send(JSON.stringify({ t: 'admin.siguiente' }));
  await esperarFase('ronda3');
  console.log(`▶ Fase: ${fase()} — dilema`);
  for (const bot of bots) {
    if (!bot.vista.dilema?.emparejado) continue;
    enviar(bot, { t: 'ronda3.elegir', opcion: bot.i % 2 ? 'cooperar' : 'guardar' });
    await esperar(40);
  }
  await esperar(500);

  // --- ronda 4: apuestas ---
  if (fase() !== 'ronda4') {
    if (!AUTO) admin.send(JSON.stringify({ t: 'admin.siguiente' }));
    await esperarFase('ronda4');
  }
  console.log(`▶ Fase: ${fase()} — apuesta final`);
  for (const bot of bots) {
    // La mitad acierta (su amigo secreto es el bot anterior), la otra mitad falla.
    const correcto = bots[(bot.i - 1 + CANTIDAD) % CANTIDAD].id;
    const otro = bots[(bot.i + 2) % CANTIDAD].id;
    const sospechosoId = bot.i % 2 ? correcto : (otro === bot.id ? correcto : otro);
    bot.socket.send(JSON.stringify({ t: 'ronda4.apostar', sospechosoId, monto: Math.max(1, Math.min(3, bot.vista.yo.fichas)) }));
    await esperar(40);
  }
  await esperar(700);

  // --- revelación ---
  if (fase() !== 'revelacion') {
    if (!AUTO) admin.send(JSON.stringify({ t: 'admin.siguiente' }));
    await esperarFase('revelacion');
  }
  console.log(`▶ Fase: ${fase()} — revelando ${CANTIDAD} parejas`);
  if (AUTO) {
    const termino = await esperarFase('fin', 20000 + CANTIDAD * 8000);
    console.log(termino ? '   ✅ reveló todas las parejas sola' : '   ❌ se quedó atascada en la revelación');
  } else {
    for (let i = 0; i <= CANTIDAD; i++) { admin.send(JSON.stringify({ t: 'admin.revelar' })); await esperar(200); }
  }
  await esperar(400);

  // --- verificación de secretos ---
  const fugas = [];
  for (const bot of bots) {
    const texto = JSON.stringify(bot.recibido);
    for (const otro of bots) {
      if (otro.id === bot.id) continue;
      if (texto.includes(otro.pin)) fugas.push(`${bot.apodo} vio el PIN de ${otro.apodo}`);
    }
    if (/"parejas"|"pinHash"|"autorId"|"respuestas"/.test(texto)) fugas.push(`${bot.apodo} recibió un campo secreto`);
  }

  const marcadorFinal = [...bots]
    .map((b) => ({ apodo: b.apodo, fichas: b.vista.yo.fichas }))
    .sort((a, b) => b.fichas - a.fichas);

  console.log('\n── Marcador final ──');
  marcadorFinal.forEach((j, i) => console.log(`${String(i + 1).padStart(2)}. ${j.apodo.padEnd(8)} ${j.fichas} fichas`));
  console.log(`\nFase final: ${fase()}`);
  console.log(`Narraciones emitidas: ${narraciones.length}`);
  console.log(`Entradas de ronda explicadas: ${entradasExplicadas}`);
  console.log(`Errores rechazados por el servidor: ${errores.length}${errores.length ? ` (${[...new Set(errores)].join(', ')})` : ''}`);
  console.log(`Fugas de información: ${fugas.length ? `❌ ${fugas.join('; ')}` : '✅ ninguna'}`);

  bots.forEach((b) => b.socket.close());
  admin.close(); tv.close();
  servidor.kill();

  const problemas = fugas.length > 0 || fase() !== 'fin' || conTexto === false;
  if (problemas) { console.error('\n❌ La simulación encontró problemas.'); process.exit(1); }
  console.log('\n✅ Partida completa de extremo a extremo sin errores.');
  process.exit(0);
}

main().catch((e) => { console.error('Falló la simulación:', e); process.exit(1); });
