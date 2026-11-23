// Confeti propio en canvas (~40 líneas) para no sumar una dependencia.
export function confeti({ cantidad = 160, duracion = 3500 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const lienzo = document.createElement('canvas');
  Object.assign(lienzo.style, { position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 });
  lienzo.width = innerWidth; lienzo.height = innerHeight;
  document.body.appendChild(lienzo);
  const ctx = lienzo.getContext('2d');
  const colores = ['#f2c14e', '#e0514f', '#4ec98b', '#f4f6fb', '#7aa2ff'];

  const piezas = Array.from({ length: cantidad }, () => ({
    x: Math.random() * lienzo.width,
    y: -20 - Math.random() * lienzo.height * 0.4,
    r: 4 + Math.random() * 7,
    vx: (Math.random() - 0.5) * 2.2,
    vy: 2 + Math.random() * 3.5,
    giro: Math.random() * Math.PI,
    vgiro: (Math.random() - 0.5) * 0.25,
    color: colores[Math.floor(Math.random() * colores.length)]
  }));

  const inicio = performance.now();
  (function cuadro(ahora) {
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    for (const p of piezas) {
      p.x += p.vx; p.y += p.vy; p.giro += p.vgiro;
      if (p.y > lienzo.height + 20) { p.y = -20; p.x = Math.random() * lienzo.width; }
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.giro);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      ctx.restore();
    }
    if (ahora - inicio < duracion) requestAnimationFrame(cuadro);
    else lienzo.remove();
  })(inicio);
}
