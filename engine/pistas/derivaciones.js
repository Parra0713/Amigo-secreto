// Cada derivación convierte una respuesta cruda en un valor más vago.
// Se referencian por nombre desde config/cuestionario.json.

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_MES = [31,28,31,30,31,30,31,31,30,31,30,31];

const COMIDA_CATEGORIA = {
  'bandeja paisa':'bien criollo', sancocho:'bien criollo', ajiaco:'bien criollo',
  tamales:'bien criollo', empanadas:'bien criollo', asado:'bien criollo',
  pizza:'de comida rápida', hamburguesa:'de comida rápida',
  sushi:'de otro país', 'arroz chino':'de otro país', pasta:'de otro país'
};
const COLOR_CALIDO = ['rojo','amarillo','naranja','rosado'];
const COLOR_GRUPO = {
  rojo:'intensos', naranja:'intensos', amarillo:'brillantes', verde:'de la naturaleza',
  azul:'tranquilos', morado:'poco comunes', rosado:'poco comunes',
  negro:'neutros', blanco:'neutros', gris:'neutros'
};
const HOBBY_LUGAR = {
  'ver series':'de puertas para adentro', leer:'de puertas para adentro',
  videojuegos:'de puertas para adentro', cocinar:'de puertas para adentro',
  manualidades:'de puertas para adentro', dormir:'de puertas para adentro',
  'redes sociales':'de puertas para adentro', música:'de puertas para adentro',
  'hacer deporte':'de puertas para afuera', 'salir a caminar':'de puertas para afuera'
};
const LUGARES_COLOMBIA = ['cali','bogotá','bogota','medellín','medellin','cartagena','santa marta','barranquilla','san andrés','san andres','eje cafetero','villavicencio','pasto','popayán','popayan','buenaventura','guatapé','guatape','salento','tayrona','amazonas','providencia','bucaramanga','cúcuta','cucuta','manizales','pereira','armenia','neiva','ibagué','ibague','montería','monteria','valledupar','tunja','colombia'];

const norm = (v) => String(v ?? '').trim().toLowerCase();

export const derivaciones = {
  semestre: (v) => (MESES.indexOf(norm(v)) < 6 ? 'el primer semestre' : 'el segundo semestre'),

  estacionDias: (v) => String(DIAS_MES[Math.max(0, MESES.indexOf(norm(v)))]),

  primeraLetra: (v) => (norm(v)[0] || '?').toUpperCase(),

  iniciales: (v) => `la letra ${(norm(v)[0] || '?').toUpperCase()}`,

  cantidadPalabras: (v) => {
    const n = norm(v).split(/\s+/).filter(Boolean).length;
    if (n <= 1) return 'una sola palabra';
    if (n === 2) return 'dos palabras';
    if (n === 3) return 'tres palabras';
    return 'más de tres palabras';
  },

  categoriaComida: (v) => COMIDA_CATEGORIA[norm(v)] || 'que no es lo típico de la casa',

  temperaturaColor: (v) => (COLOR_CALIDO.includes(norm(v)) ? 'cálidos' : 'fríos'),

  grupoColor: (v) => COLOR_GRUPO[norm(v)] || 'poco comunes',

  tieneONo: (v) => (norm(v) === 'ninguna' ? 'no hay' : 'hay'),

  patasMascota: (v) => {
    const m = norm(v);
    if (m === 'perro' || m === 'gato') return 'andan en cuatro patas';
    if (m === 'pájaro' || m === 'pajaro') return 'tienen alas';
    if (m === 'pez') return 'viven en el agua';
    return 'no son las más comunes';
  },

  dentroOFuera: (v) => HOBBY_LUGAR[norm(v)] || 'de puertas para adentro',

  dentroOFueraDelPais: (v) => {
    const t = norm(v);
    return LUGARES_COLOMBIA.some((l) => t.includes(l)) ? 'dentro de Colombia' : 'fuera del país';
  },

  conOSinCafeina: (v) => (['café','cafe','té','te','gaseosa'].includes(norm(v)) ? 'con cafeína' : 'sin cafeína'),

  horarioVago: (v) => {
    const t = norm(v);
    if (t === 'madrugador') return 'de los que ven amanecer';
    if (t === 'trasnochador') return 'de los que ven la madrugada';
    return 'impredecible';
  }
};

/** Aplica una derivación por nombre; sin nombre, devuelve el valor tal cual. */
export function derivar(nombre, valor) {
  if (!nombre) return String(valor ?? '').trim();
  const fn = derivaciones[nombre];
  if (!fn) throw new Error(`Derivación desconocida en cuestionario.json: ${nombre}`);
  return fn(valor);
}
