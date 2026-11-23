# Interfaz: reglas que sigue el proyecto (Human Interface Guidelines)

Las **Human Interface Guidelines** son la guía de diseño de Apple para apps de sus
plataformas. Esto no es una app de iOS: es una **página web** que se ve en el navegador
de un celular (Android o iPhone), en un PC con Windows conectado a la TV y en el panel
del grupier. Así que aquí no se "certifica" nada; lo que se hizo fue **adoptar las
reglas de las HIG que sí aplican a este caso** y dejar escrito cuáles no aplican y por qué.

Las tres ideas de fondo de las HIG —**claridad, deferencia y profundidad**— se traducen
en este proyecto así: texto grande y legible antes que decoración; la interfaz se quita
del camino para que el contenido (la pista, el marcador, la revelación) sea el
protagonista; y la jerarquía se construye con tamaño y espacio, no con adornos.

---

## 1. Lo que se aplicó

### Áreas de toque y espaciado
- **Área mínima de toque de 44 × 44 px** en todo control: `button`, `input`, `.op` y
  `.boton` tienen `min-height: var(--toque)` con `--toque: 44px`.
- El **pulgar del deslizador** de la apuesta mide 32 px sobre un riel de 44 px de alto:
  antes el área tocable era el riel de 6 px, que es imposible de agarrar con el dedo.
- **Retícula de 8 puntos** (`--e1` a `--e6`): todo el espaciado es múltiplo de 4/8.
- Separación mínima de 8 px entre controles vecinos, para no tocar el botón equivocado.

### Tipografía
- **Tipografía del sistema**: `-apple-system` / `BlinkMacSystemFont` (San Francisco en
  Apple), `Segoe UI` en Windows, `Roboto` en Android. Ninguna fuente descargada.
- **Cuerpo de 17 px**, que es el tamaño de cuerpo de iOS. Escala declarada en variables:
  28 / 22 / 17 / 15 / 13 / 11.
- **Nada por debajo de 11 px**, y las etiquetas chicas van en mayúsculas con
  interletraje, no en texto diminuto.
- `text-size-adjust: 100%` para que el celular no reescale el texto por su cuenta.
- `font-variant-numeric: tabular-nums` en fichas, relojes y marcador: los números no
  bailan al cambiar.

### Apariencia clara y oscura
- `color-scheme: dark light` y un bloque `prefers-color-scheme: light` completo para
  `/play` y `/admin`: si el celular está en modo claro, la página se adapta.
- `/tv` se queda **siempre oscura** (clase `siempre-oscuro`): es una pantalla de
  escenario en una sala de noche, no una app que el usuario configure.
- `theme-color` declarado por separado para claro y oscuro.

### Color y contraste
- El color **nunca es el único portador de significado**: cada estado trae además un
  símbolo (`.si::before` pone ✓, `.no::before` pone ✗) o una palabra.
- Contraste de texto por encima de 4.5:1 en ambas apariencias; en modo claro el oro se
  oscurece a `#8a5a00` justamente para cumplirlo.
- Se respeta **`prefers-contrast: more`**: el texto secundario pasa a color de texto
  pleno y los bordes se refuerzan.

### Movimiento
- Animaciones cortas (0.3–0.4 s) con curvas de salida suave, para acompañar y no estorbar.
- Se respeta **`prefers-reduced-motion`**: todas las animaciones y transiciones se
  desactivan, y el confeti no se dibuja.

### Zonas seguras
- `viewport-fit=cover` más `padding: env(safe-area-inset-*)` en `body`: nada queda
  debajo de la muesca, la isla dinámica ni la barra de gestos del iPhone.
- `apple-mobile-web-app-status-bar-style: black-translucent` para la pantalla completa.

### Retroalimentación y estado
- Todo botón tiene estado **pulsado** visible (`transform: scale(.97)`), y la opción
  escogida queda marcada con `aria-pressed` más un ✓ visible.
- Vibración corta al comprar, elegir o apostar (donde el navegador la permite).
- **Indicador de carga** al reconectar, en lugar de una pantalla en blanco.
- El estado de la red siempre visible ("en línea" / "reconectando…").

### Nada de diálogos del navegador
- Se eliminaron `alert()` y `confirm()`. La acción destructiva ("Nueva partida") usa una
  **confirmación de dos pasos dentro de la página**, con el botón en rojo, el texto de
  la consecuencia ("esto no se puede deshacer") y la opción de cancelar — como una hoja
  de acción, que es lo que piden las HIG para acciones destructivas.

### Accesibilidad
- **Etiquetas visibles** en todos los campos, no solo texto de ejemplo
  (un `placeholder` desaparece al escribir y deja al usuario sin contexto).
- `aria-label` / `aria-labelledby` en los grupos de opciones, `role="group"`,
  `role="status"` con `aria-live="polite"` para el narrador y el contador,
  `role="alert"` para los errores y `role="timer"` para los relojes.
- Tablas del panel con `caption` y `th scope="col"`.
- **Foco visible** con `:focus-visible` (anillo de 3 px), para teclado y control por
  conmutador, sin aparecer al tocar con el dedo.
- Botones con texto, nunca solo un icono.

### Icono
- Icono propio de 180, 192 y 512 px (`apple-touch-icon` y manifiesto), dibujado sin
  texto y sin esquinas redondeadas propias: el sistema aplica la máscara.
- Manifiesto con `name`, `short_name`, `description`, `scope`, `display: standalone`,
  `orientation: portrait` y `lang: es-CO`, para que al agregarla a la pantalla de inicio
  se comporte como una app.

### Lenguaje
- Español de Colombia, frases cortas, verbos primero ("Comprar", "Apostar", "Entrar al
  juego"), nada de "haz clic" en una interfaz que se toca.
- Los mensajes de error dicen **qué pasó y qué hacer**, no un código:
  "No te alcanzan las fichas", "Ese PIN no es. Revisa e intenta otra vez."

---

## 2. Lo que no aplica, y por qué

| Pauta de las HIG | Por qué no aplica aquí |
|---|---|
| Barra de navegación, barra de pestañas, controles nativos de UIKit/SwiftUI | No hay navegación jerárquica: cada fase del juego reemplaza la pantalla completa. Una barra de pestañas invitaría a moverse entre secciones que no existen |
| Gestos del sistema (deslizar para volver, edge swipe) | No hay "atrás": el servidor manda la fase, y un jugador no puede regresar a una ronda cerrada |
| Widgets, Live Activities, Dynamic Island, atajos de Siri, notificaciones | Requieren una app nativa en el dispositivo; esto es una página en el WiFi de la casa |
| Dynamic Type real (escalado por el ajuste de tamaño de texto del sistema) | El navegador móvil no expone ese ajuste a una página web. Se aproximó con cuerpo de 17 px, unidades relativas y `text-size-adjust` |
| Háptica de Taptic Engine | Safari en iOS no expone `navigator.vibrate`. En Android sí funciona; en iPhone simplemente no vibra, sin degradar nada más |
| Pautas de App Store, onboarding, cuentas, Sign in with Apple | No hay distribución ni cuentas: el jugador entra con un PIN de 4 dígitos que se le da en pantalla |
| tvOS (foco, parallax, control remoto) | La TV es un monitor por HDMI. No se navega con control remoto: la TV es solo de lectura y el control está en `/admin` |
| Apariencia clara en `/tv` | Decisión deliberada: pantalla de escenario, en una sala de noche |

---

## 3. Cómo verificar

`tests/interfaz.test.js` revisa de forma automática lo que se puede revisar sin un
navegador: que exista el área de toque de 44 px, que no haya `alert()` ni `confirm()`,
que los campos tengan etiqueta, que el manifiesto y los iconos estén completos, que se
respeten `prefers-reduced-motion`, `prefers-contrast` y `prefers-color-scheme`, y que
haya zonas seguras.

Lo que **sí hay que mirar con ojos** (y conviene hacerlo antes de la reunión):
- La TV a 3 metros de distancia: ¿se lee el marcador sin esforzarse?
- Un celular con la pantalla en modo claro y otro en oscuro.
- Un iPhone con muesca: ¿la barra superior queda completa?
- Con VoiceOver o TalkBack encendido: ¿el narrador se anuncia y los botones se nombran?
