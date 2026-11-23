// Los .bat deben ser utilizables por cmd.exe: CRLF y solo ASCII.
// Con finales de línea de Unix, cmd rompe los bloques if(...) y la ventana
// se cierra sin mostrar nada. Esta prueba existe por un error real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const bats = readdirSync(raiz).filter((f) => f.endsWith('.bat'));

test('hay scripts de arranque para Windows', () => {
  assert.deepEqual(bats.sort(), ['descargar-voz.bat', 'diagnostico.bat', 'firewall.bat', 'iniciar.bat']);
});

for (const bat of bats) {
  test(`${bat}: finales de línea CRLF y solo ASCII`, () => {
    const crudo = readFileSync(join(raiz, bat));
    const texto = crudo.toString('latin1');

    const lineas = texto.split('\n').length - 1;
    const retornos = (texto.match(/\r\n/g) || []).length;
    assert.equal(retornos, lineas, `${bat} tiene líneas sin CR: cmd.exe las rompe`);

    const noAscii = [...crudo].filter((b) => b > 127);
    assert.equal(noAscii.length, 0, `${bat} tiene caracteres no ASCII (${noAscii.length})`);
    assert.notEqual(crudo[0], 0xef, 'no debe tener BOM');
  });
}

test('iniciar.bat no deja la ventana cerrarse sin explicación', () => {
  const texto = readFileSync(join(raiz, 'iniciar.bat'), 'latin1');
  assert.match(texto, /pause/, 'debe terminar en pause para que se lea el mensaje');
  assert.match(texto, /:sinnode/, 'debe avisar si falta Node.js');
  assert.match(texto, /nodejs\.org/, 'debe decir de dónde bajar Node.js');
  // Sin bloques entre paréntesis: son justo lo que falla con finales de línea raros.
  assert.ok(!/if errorlevel 1 \(/.test(texto), 'usar goto en vez de bloques ( )');
});

test('el firewall se abre solo en perfil privado y solo el puerto del juego', () => {
  const texto = readFileSync(join(raiz, 'firewall.bat'), 'latin1');
  assert.match(texto, /profile=private/);
  assert.match(texto, /localport=8080/);
  assert.ok(!/profile=any/.test(texto), 'nunca abrir en todos los perfiles');
});
