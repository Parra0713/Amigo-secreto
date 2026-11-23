# Guía del anfitrión (el grupier)

Esta guía es para la persona que pone el computador. **No hay que saber programar.**
De principio a fin toma menos de 10 minutos.

---

## Antes de la noche (hazlo con internet, una sola vez)

### 1. Instalar Node.js
1. Entra a **https://nodejs.org** y descarga la versión que dice **LTS**.
2. Instálala con "Siguiente, siguiente, siguiente". No hay que cambiar nada.

### 2. Dar permiso al firewall
En la carpeta del proyecto, haz **clic derecho** en **`firewall.bat`** → **Ejecutar como
administrador** → te pide confirmar → listo.

Esto abre **solo** el puerto 8080 y **solo** para redes privadas (tu casa). No expone
nada a internet.

### 3. Primera prueba
Doble clic en **`iniciar.bat`**. La primera vez descarga lo que necesita (unos 30
segundos). Cuando veas que se abre el navegador con la pantalla de la TV, ya funciona.
Cierra la ventana negra para apagarlo.

> Si ves una ventana de Windows preguntando por el acceso a redes, escoge
> **Redes privadas** y acepta.

---

## La noche del juego

### 1. Conectar el PC a la TV
Conecta el cable HDMI. Pon la TV como pantalla principal o extendida, como prefieras.

### 2. Arrancar
Doble clic en **`iniciar.bat`**.
- Se abre el navegador en la **pantalla de TV**.
- Presiona **F11** para ponerla a pantalla completa.
- **Haz un clic en la pantalla**: eso activa el sonido y la voz del narrador
  (los navegadores no dejan sonar nada hasta que alguien toca la pantalla).

> **No cierres la ventana negra.** Ahí está corriendo el juego.

### 3. Conectar los celulares
En la TV aparece un **código QR** y una dirección tipo `192.168.1.15:8080/play`.
- Cada persona abre la cámara del celular y escanea el QR.
- O escribe esa dirección en el navegador.
- Todos deben estar en **el mismo WiFi de la casa**.

Cada jugador pone un apodo, escoge un emoji y recibe un **PIN de 4 dígitos**.
**Que lo anoten**: si se les apaga el celular, con ese PIN vuelven a su puesto.

### 4. Lo que hace cada jugador en su celular
1. Responde el **cuestionario** (8 a 12 preguntas, 2 minutos). De ahí salen sus pistas.
2. Dice **a quién le regala**. Nadie más lo ve, ni tú.
3. Si quiere, escribe sus propias pistas (opcional).

En la TV ves cuántos están listos: "5 de 8 listos".

### 5. Abrir el panel del grupier
En el PC, abre otra pestaña en **http://localhost:8080/admin/** y pon el PIN de
administrador (está en `config\reglas.json`, por defecto **2468** — cámbialo si quieres).

Desde ahí controlas todo:
| Botón | Qué hace |
|---|---|
| **Avisar registro** | El narrador le dice a la gente que saque el celular |
| **Iniciar partida** | Arranca la ronda 1 (necesita al menos 3 jugadores listos) |
| **Siguiente ronda** | Pasa a la ronda que sigue sin esperar el reloj |
| **Pausar / Reanudar** | Congela el reloj, por si hay que servir el almuerzo |
| **Revelar siguiente** | En la revelación, destapa una pareja a la vez |
| **Nueva partida** | Borra todo y empieza de cero |

En ese panel también ves un **resumen anónimo**: cuántas pistas se armaron por montón y
si alguno quedó incompleto. **No ves el contenido de las pistas ni las parejas**: eso es
a propósito, para que tú también puedas jugar.

### 6. Cómo va la partida
1. **Ronda 1 — Compra de pistas.** Cada uno ve su montón cerrado y compra lo que quiera.
2. **Ronda 2 — Trampa.** Por 1 ficha, cualquiera mete una pista falsa en otro montón.
3. **Ronda 3 — Dilema.** Parejas al azar: cooperar o guardar.
4. **Ronda 4 — Apuesta final.** Cada uno apuesta a quién cree que es su amigo secreto.
5. **Revelación.** Tú vas apretando "Revelar siguiente", del último al ganador.

Al final: confeti para el ganador, y ahí sí se entregan los regalos.

---

## Si algo falla

| Qué pasa | Qué hacer |
|---|---|
| **Los celulares no abren la página** | Revisa que estén en el mismo WiFi (no en datos móviles). Que apaguen los datos un momento. |
| **Sigue sin abrir** | Tu router puede tener "aislamiento de clientes" activado. Solución rápida: prende la **zona WiFi de un celular**, conecta el PC a esa zona y vuelve a arrancar: el QR cambia solo. |
| **El QR no sirve** | Que escriban la dirección a mano, tal como sale en la TV. |
| **No hay sonido ni voz** | Haz un clic en la pantalla de la TV. Si sigue sin voz, es que el PC no tiene voces en español: abre `tools\voces.html` con doble clic para confirmarlo. El texto del narrador siempre sale en pantalla. |
| **Un celular se desconectó** | Que vuelva a abrir la página. Si pide PIN, que ponga el suyo. Recupera todo: fichas, pistas compradas, todo. |
| **Se cerró la ventana negra / se reinició el PC** | Vuelve a abrir `iniciar.bat`. La partida se retoma donde estaba. |
| **La pantalla de la TV se ve pequeña** | F11 para pantalla completa. Ctrl + "+" para agrandar. |
| **Alguien no alcanzó a registrarse** | Puede entrar mientras la fase diga "Registro". Después de iniciar, ya no. |
| **Quiero cambiar precios, fichas o tiempos** | Abre `config\reglas.json` con el Bloc de notas. Cambia los números, guarda y vuelve a arrancar. |
| **Quiero otras preguntas** | Abre `config\cuestionario.json`. Mismo procedimiento. |
| **Quiero otras frases del narrador** | Abre `config\narrador.json`. |

## Variantes rápidas
En `config\reglas.json`, el bloque `variantes` trae tres listas ya armadas:
- **corta**: solo rondas 1 y 4 (para cuando hay afán).
- **familiar**: 15 fichas y sin trampa (para grupos con niños).
- **extrema**: dos trampas por jugador y pista difícil a 5 fichas.

Para usar una, copia sus valores al cuerpo principal del archivo.

## Para probar sin gente
Con el PC prendido y la ventana negra cerrada, abre una ventana de comandos en la
carpeta y escribe:

```
node tests/simulador.js 8
```

Juega una partida completa con 8 jugadores de mentira y te imprime el marcador final.
Sirve para ver que todo funciona antes de la reunión.
