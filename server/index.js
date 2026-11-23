// Arranque del servidor. Solo escucha en la red local.
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import QRCode from 'qrcode';
import { networkInterfaces } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { crearRepositorio } from './repositorio.js';
import { crearVozNeural } from './voz-neural.js';
import { crearJuego } from './juego.js';
import { registrarWebsocket } from './ws.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.env.PUERTO || 8080);

/** IPv4 de la red local (la que sirve para el QR). */
export function ipLocal() {
  const candidatas = [];
  for (const [nombre, direcciones] of Object.entries(networkInterfaces())) {
    for (const d of direcciones || []) {
      if (d.family !== 'IPv4' || d.internal) continue;
      const privada = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(d.address);
      candidatas.push({ nombre, address: d.address, privada });
    }
  }
  candidatas.sort((a, b) => Number(b.privada) - Number(a.privada));
  return candidatas[0]?.address || '127.0.0.1';
}

const app = Fastify({ logger: { level: 'info', transport: undefined } });
const repositorio = crearRepositorio(process.env.CARPETA_DATOS || join(raiz, 'data'));
const juego = crearJuego({ repositorio, log: app.log });

// Voz neuronal: opcional. Si no está, el navegador narra como siempre.
const vozNeural = crearVozNeural({
  carpetaModelos: join(raiz, 'modelos'),
  carpetaCache: join(process.env.CARPETA_DATOS || join(raiz, 'data'), 'voz'),
  log: app.log,
  config: juego.configVoz ?? {}
});
if (!vozNeural.disponible) {
  app.log.info(`voz neuronal no disponible (${vozNeural.motivo}) — se usa la voz del navegador`);
}

await app.register(fastifyWebsocket);
await app.register(fastifyStatic, { root: join(raiz, 'web'), prefix: '/' });

app.get('/', (_, respuesta) => respuesta.redirect('/tv/'));
for (const vista of ['tv', 'play', 'admin']) {
  app.get(`/${vista}`, (_, respuesta) => respuesta.redirect(`/${vista}/`));
}

/** Datos de conexión + QR en SVG, generado en el servidor (nada externo). */
app.get('/api/conexion', async () => {
  const url = `http://${ipLocal()}:${PUERTO}/play/`;
  const qr = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return { url, qr };
});

app.get('/api/cuestionario', async () => juego.cuestionarioPublico());

app.get('/api/explicacion', async () => juego.explicacionPublica());

app.get('/api/voz/estado', async () => ({ ...vozNeural.estado(), motivo: vozNeural.motivo }));

/** Audio de una frase. Devuelve 404 si la voz neuronal no está: el cliente cae al navegador. */
app.get('/api/voz', async (peticion, respuesta) => {
  if (!vozNeural.disponible) return respuesta.code(404).send({ error: 'SIN_VOZ_NEURAL' });
  const { t, p = 'grupier' } = peticion.query || {};
  if (!t) return respuesta.code(400).send({ error: 'FALTA_TEXTO' });
  try {
    const archivo = await vozNeural.sintetizar(t, p === 'explicador' ? 'explicador' : 'grupier');
    if (!archivo || !existsSync(archivo)) return respuesta.code(404).send({ error: 'SIN_AUDIO' });
    return respuesta
      .header('content-type', 'audio/wav')
      .header('content-length', statSync(archivo).size)
      .header('cache-control', 'public, max-age=86400')
      .send(createReadStream(archivo));
  } catch (e) {
    app.log.warn(`voz neural falló: ${e.message}`);
    return respuesta.code(500).send({ error: 'FALLO_SINTESIS' });
  }
});

app.post('/api/registrar', async (peticion, respuesta) => {
  try {
    return juego.registrar(peticion.body || {});
  } catch (e) {
    return respuesta.code(400).send({ error: e.message });
  }
});

registrarWebsocket(app, juego);

await app.listen({ port: PUERTO, host: '0.0.0.0' });

// Se generan de antemano las frases fijas que no estén ya en el banco.
if (vozNeural.disponible) {
  setTimeout(() => vozNeural.precalentar(juego.frasesParaPrecalentar()), 500);

  // Y en cuanto alguien se registra, las frases que dicen su apodo: para cuando
  // el grupier lo nombre en la partida, el audio ya está hecho.
  juego.alRegistrarJugador = (apodo) => {
    setTimeout(() => vozNeural.precalentar(juego.frasesConApodo(apodo), { pausaMs: 80 }), 200);
  };
}
app.log.info(`TV:    http://localhost:${PUERTO}/tv/`);
app.log.info(`Celu:  http://${ipLocal()}:${PUERTO}/play/`);
app.log.info(`Admin: http://localhost:${PUERTO}/admin/`);
