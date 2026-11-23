# 3D CHARACTER & ENVIRONMENT DESIGN GUIDELINES (HIG-3D v1.0)

> Guía de diseño para el grupier y el escenario 3D de *El Plan del Amigo Secreto*.
> La parte 1 son las reglas tal como se definieron para este proyecto. La parte 2 las
> complementa con dos fuentes externas. La parte 3 aplica todo al personaje concreto,
> con su tabla de verificación. La parte 4 dice cómo se tradujo a código.

---

# PARTE 1 — HIG-3D v1.0

## 1. JERARQUÍA Y LEGIBILIDAD (Principio Core)
- **Regla de Silueta:** Todo personaje u objeto clave debe ser 100% reconocible relleno en negro sólido. Evita extremidades pegadas al torso o accesorios que rompan la lectura del contorno.
- **Gradiente de Atención (Valor Lumínico):** En personajes, aplica un degradado de contraste de abajo hacia arriba: colores más oscuros y neutros en pies/piernas, mayor contraste y saturación en torso/rostro para guiar el ojo.
- **Descanso Visual (Regla 70/20/10):**
  - 70% superficies limpias o de baja frecuencia de detalle.
  - 20% detalle medio (pliegues, costuras, texturas base).
  - 10% alta densidad de detalle o color de acento (punto focal).

## 2. LENGUAJE DE FORMAS (Shape Language)
Asigna una forma primaria dominante (70%) y una secundaria (30%) según el rol:
- **Círculos / Curvas:** Amigable, seguro, inocente, orgánico, accesible.
- **Cuadrados / Rectángulos:** Fuerte, estable, terco, confiable, pesado, monumental.
- **Triángulos / Diagonales:** Peligroso, ágil, astuto, dinámico, hostil, veloz.
*Restricción:* Nunca mezcles las tres formas en proporciones iguales (33/33/33).

## 3. PROPORCIONES Y ESCALA
- **Evitar el 50/50:** Nunca dividas el cuerpo o un edificio exactamente a la mitad. Usa proporciones 1/3 - 2/3 o proporción áurea.
- **Ancla de Escala:** Todo escenario debe incluir al menos un elemento de escala humana conocida (puerta, escalón, barandilla, silla) para comunicar el tamaño real del entorno.

## 4. NARRATIVA AMBIENTAL Y DE PERSONAJE (Storytelling)
- **Cero elementos gratuitos:** Todo accesorio, cicatriz, grieta o mancha debe justificar una acción pasada o función actual.
- **Asimetría intencional:** Rompe la simetría perfecta en personajes y arquitectura (ej. hombrera distinta, un lado más desgastado) para evitar aspecto artificial o genérico.

## 5. ILUMINACIÓN Y COLOR
- **Contraste Temperatura:** Usa luz cálida contra sombras frías (o viceversa) para separar al personaje del fondo.
- **Separación Figura-Fondo:** El fondo nunca debe tener mayor saturación ni mayor contraste que el personaje principal en el mismo plano.
- **Paleta Limitada:** Máximo 3 colores principales por personaje/escena + 1 color de acento.

## 6. REGLAS DE ANIMACIÓN Y ACTUACIÓN (Motion Specs)
- **Anticipación -> Acción -> Reacción:** Ningún movimiento empieza de golpe; requiere una preparación contraria previa y un asentamiento (*follow-through*) al terminar.
- **Línea de Acción:** Toda pose clave debe poder resumirse en una única curva fluida (en forma de C o S) que recorra desde la cabeza hasta los pies.
- **Peso y Gravedad:** El centro de gravedad (cadera) siempre lidera el movimiento del cuerpo; las extremidades reaccionan con retraso (*overlapping action*).

---

# PARTE 2 — COMPLEMENTOS

## 2.A — Legibilidad de personaje, según el arte de Team Fortress 2 (Valve)

Valve publicó cómo construyó la legibilidad de sus personajes, y coincide con la sección 1
de esta guía hasta en el orden de los pasos. Lo que aporta de nuevo:

**La silueta no es una verificación, es el punto de partida.** En TF2 la silueta se
consideró tan importante que el diseño **empezó** por ahí, y los personajes se modelaron
en poses propias de cada uno en lugar de la típica pose en T genérica.

**El detalle interior debe repetir la silueta, no competir con ella.** Es la regla que más
suele faltar en la sección 1: en los personajes, los detalles interiores como los pliegues de la
ropa se escogen para hacer eco de las formas de la silueta (*Illustrative Rendering in
Team Fortress 2*, Mitchell, Francke y Eng, SIGGRAPH 2007). Es decir, el 20% de detalle
medio de la regla 70/20/10 no es libre: debe reforzar el contorno.

**El contorno se separa con luz, no con línea.** Las siluetas se enfatizan con brillos de
borde (*rim light*) en vez de contornos oscuros (mismo paper). Esto convierte la "Separación
Figura-Fondo" de la sección 5 en una técnica concreta y no solo en una aspiración.

**Jerarquía de lectura por capas, en orden y con un propósito de juego cada una.** En TF2
lo primero que se lee es el color —¿es de mi equipo o del otro?—, y después la clase
—¿corro o ataco?—. Para nosotros: primero se lee **quién habla** (el grupier contra el
marcador), después **qué momento del juego es**.

**El valor manda sobre el color.** TF2 pone un énfasis enorme en la jerarquía de valor
lumínico, y esa jerarquía importa porque es lo que vemos inmediatamente después de la
silueta general (Xavier Coelho-Kostolny, *Character Readability in Team Fortress 2 and
Overwatch*). Aplicado aquí: el personaje debe seguir leyéndose en una TV mal
calibrada, con el brillo por el piso, o vista de reojo desde la cocina.

## 2.B — Narrativa, según las 22 reglas de Emma Coats (Pixar)

> Las reglas originales son suyas y están publicadas en muchos sitios; aquí van
> parafraseadas y solo las cuatro que cambian algo de este personaje.

Las reglas son de guion, no de modelado, pero cuatro de ellas cambian decisiones
concretas de este personaje. Parafraseadas:

- **Se admira a un personaje por intentarlo, más que por lograrlo.** El grupier no es un
  villano que gana: es un maestro de ceremonias que propone tentaciones. No se burla del
  que pierde, se interesa por el que duda.
- **Importa lo que le resulta interesante al público, no lo que es divertido de hacer.**
  Traducción directa: nadie en la sala quiere ver una animación de lucimiento de diez
  segundos entre rondas. La familia quiere saber cuánto le queda y a quién le toca.
- **Simplifica, enfócate, combina personajes, sáltate desvíos.** Perder detalle duele,
  pero libera. De aquí sale la decisión de que el grupier **no tenga manos**: no aportan
  lectura a tres metros y sí rompen la silueta.
- **Pregúntate cuál es la esencia de tu historia y cuál es la forma más económica de
  contarla.** Sabiendo eso, se construye desde ahí (regla 22 de la lista de Emma Coats). La esencia aquí: *alguien en esta
  sala está mintiendo y las fichas lo van a demostrar*. Todo lo que el personaje haga en
  pantalla tiene que servir a esa frase.

Y una regla de proceso que aplica al código tanto como al guion: **termina y suelta,
aunque no esté perfecto**; se hace mejor la próxima vez. Por eso este personaje se
construye por procedimiento y en una sola noche, no se espera a tener un modelo esculpido.

---

# PARTE 3 — APLICACIÓN AL GRUPIER

## 3.1 Ficha del personaje

| Atributo | Decisión | Regla que la justifica |
|---|---|---|
| Rol narrativo | Maestro de ceremonias que tienta, no villano que castiga | Pixar: se admira al que intenta |
| Forma primaria (70%) | **Triángulo** — capucha, hombros caídos en diagonal, manto que se abre hacia abajo | §2: astuto, hostil, dinámico |
| Forma secundaria (30%) | **Rectángulo** — torso-columna vertical, base monumental | §2: estable, pesado, autoridad |
| Forma ausente | Círculos, salvo los dos ojos y la ficha del pecho | §2: prohibido el 33/33/33 |
| Proporción vertical | Capucha+rostro 1/3 superior, manto 2/3 inferior | §3: nunca 50/50 |
| Paleta | 3 principales: violeta-noche `#2b2142`, negro-vacío `#07040c`, gris-humo `#4a4466` | §5: máximo 3 + acento |
| Acento | Oro `#f2c14e` — solo ojos, borde del manto y la ficha | §5 y §1: ese oro es el 10% |
| Asimetría | Hombro derecho más alto y más gastado; la ficha del pecho cuelga de ese lado | §4 |
| Narrativa de objetos | La ficha del pecho es su paga, no un adorno; el borde inferior del manto está raído por arrastrarse en mesas de juego | §4: cero elementos gratuitos |
| Sin manos | No aportan lectura a 3 m y rompen el contorno | §1 + Pixar: simplifica |

## 3.2 Tabla de verificación (Checklist HIG-3D v1.0)

| # | Regla | Cómo se cumple | Verificación |
|---|---|---|---|
| 1.1 | **Silueta** reconocible en negro sólido | Trapecio-triángulo con capucha puntiaguda y manto acampanado; nada se pega al torso porque no hay brazos ni accesorios laterales | `?silueta=1` en `/tv` renderiza la escena con material negro plano y sin luces: el personaje sigue siendo identificable |
| 1.2 | **Gradiente de atención** abajo→arriba | El manto usa violeta oscuro desaturado en la base y aclara hacia los hombros; el rostro es el único negro puro, y contra él van los dos ojos dorados | El punto más claro y el más oscuro de la figura están ambos en el tercio superior: ahí se va el ojo |
| 1.3 | **70/20/10** | 70%: manto y capucha, superficies lisas de baja frecuencia. 20%: tres pliegues verticales y el borde raído. 10%: ojos, ficha y filo dorado del manto | Medido sobre el área proyectada: oro ≈ 8–10% de los píxeles del personaje |
| 2 | **Lenguaje de formas** 70/30 | 70% triangular (capucha, diagonales de hombros, manto que se abre), 30% rectangular (columna del torso, base). Círculos solo como acento | Ninguna de las tres formas llega a un tercio por sí sola; no hay 33/33/33 |
| 3.1 | **Nada de 50/50** | Corte en 1/3 (capucha y rostro) contra 2/3 (manto). El ancho de hombros es 2/3 del ancho de la base | Las dos divisiones principales están en 0,33 y 0,66 de la altura |
| 3.2 | **Ancla de escala** | La mesa de juego con su borde, una silla vacía y las tres cartas tamaño naipe, a escala humana conocida | Puesto al lado, el grupier mide ~2,3 cabezas sobre la mesa: se entiende que está de pie detrás de ella |
| 4.1 | **Cero elementos gratuitos** | Ficha al pecho = su paga. Borde raído = años de arrastrar el manto en mesas. Vela encendida = la única luz de la sala, y es la que lo ilumina | No hay ningún elemento sin esa justificación |
| 4.2 | **Asimetría intencional** | Hombro derecho 8% más alto, desgaste mayor en el lado izquierdo del manto, ficha descentrada | La figura espejada no es igual a la original |
| 5.1 | **Contraste de temperatura** | Luz principal cálida (vela, `#ffb347`) desde abajo-derecha; relleno frío (`#3a2f6b`) desde arriba-izquierda | La sombra del personaje es azulada; su luz es ámbar |
| 5.2 | **Separación figura-fondo** | El fondo es plano, desaturado y más oscuro que el personaje; además hay *rim light* dorado en el borde de la capucha, tomado de TF2 | Medido: saturación y contraste del fondo por debajo del personaje en el mismo plano |
| 5.3 | **Paleta limitada** | 3 + 1 acento, declarados en una sola constante del código | No hay ningún color fuera de esa constante |
| 6.1 | **Anticipación → acción → reacción** | Antes de hablar, retrocede y baja la cabeza (anticipación contraria), se incorpora al empezar la frase, y al terminar hay un asentamiento con rebote amortiguado | Visible al pasar de lámina a lámina |
| 6.2 | **Línea de acción** | La pose base es una **C** suave: cabeza adelantada, torso atrás, base adelante. Al enfatizar se invierte a **S** | Un trazo único recorre cabeza→base en toda pose clave |
| 6.3 | **Peso y gravedad** | La cadera lidera: el giro arranca en la base, el torso la sigue con 90 ms de retraso y la capucha con 180 ms | Al detenerse, la capucha sigue moviéndose: *overlapping* |

## 3.3 El escenario

Minimalista a propósito, porque **el fondo nunca debe competir** (§5.2) y porque la TV
tiene que seguir mostrando el marcador y el texto encima:

- **Mesa de fieltro** en violeta desaturado, ocupando el tercio inferior.
- **Una silla vacía** al borde del plano: es el ancla de escala (§3.2) y además cuenta algo
  —alguien va a sentarse ahí a confesar.
- **Tres cartas** boca abajo sobre la mesa, tamaño naipe real: segunda ancla de escala.
- **Una vela**: única fuente cálida, justifica la iluminación y parpadea, lo que da vida a
  la escena sin mover al personaje.
- **Vacío detrás**: niebla negra. Nada de paredes, cuadros ni muebles que suban el detalle
  del fondo.

---

# PARTE 4 — IMPLEMENTACIÓN

| Decisión | Por qué |
|---|---|
| **Three.js 0.187.0 (MIT), vendorizado** en `web/shared/vendor/three/` | Un personaje 3D necesita un renderizador. Va vendorizado y no como dependencia de npm para que `web/` siga siendo autocontenido y sin paso de build. 2,1 MB servidos desde el propio PC |
| **Geometría por procedimiento**, sin modelo externo | No hay artista 3D ni archivo `.glb` que cargar: el personaje se construye con primitivas y un `LatheGeometry` para el manto. Todo el diseño vive en un archivo legible y se puede ajustar con números |
| **Materiales planos con pocas luces** | Sombreado ilustrativo, no fotorrealista: lectura antes que realismo, igual que TF2 |
| **Respaldo en SVG** | Si el PC no tiene WebGL, `/tv` usa el grupier plano en SVG que ya existía. La presentación nunca se queda sin personaje |
| **`prefers-reduced-motion`** | Con movimiento reducido, el personaje queda quieto y solo cambia la boca |
| **Modo silueta** (`/tv?silueta=1`) | Herramienta de verificación de la regla 1.1, no un adorno |
