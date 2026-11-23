// Elige frases del narrador sin repetir la última usada por evento.
// Nunca inyecta variables que no estén en la lista blanca de narrador.json.

export function crearNarrador(config, azar) {
  const ultimas = new Map();

  return function narrar(evento, variables = {}) {
    const opciones = config.eventos[evento];
    if (!opciones || opciones.length === 0) return null;

    const disponibles = opciones.length > 1
      ? opciones.filter((f) => f !== ultimas.get(evento))
      : opciones;
    const frase = disponibles[Math.floor(azar() * disponibles.length)];
    ultimas.set(evento, frase);

    let texto = frase;
    for (const clave of config.variablesPermitidas) {
      if (variables[clave] !== undefined) {
        texto = texto.replaceAll(`{${clave}}`, String(variables[clave]));
      }
    }
    // Si quedó alguna variable sin reemplazar, se limpia antes de mostrarla.
    texto = texto.replace(/\{[a-zA-Z]+\}/g, '').replace(/\s{2,}/g, ' ').trim();
    return { evento, texto };
  };
}
