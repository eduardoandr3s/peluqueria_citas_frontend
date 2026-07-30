/**
 * Cuantiza a paleta los PNG del icono: las fuentes de `assets/` y lo que genera
 * `capacitor-assets` en `android/app/src/main/res/`.
 *
 * Por qué existe: los PNG salen en color verdadero y el emblema del logo tiene
 * grano, así que comprimen fatal — recién generados eran ~9 MB, frente a los
 * 0,2 MB de los assets de plantilla, y eso va entero al repo y al APK. Una paleta
 * de 256 colores es indistinguible a la vista a tamaño de icono.
 *
 * Va SIEMPRE detrás de la generación, ver `assets/LEEME.md`.
 */
import { readdir, stat, rename, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// fileURLToPath y no `.pathname`: en Windows este último devuelve "/C:/..." y la
// ruta acabaría como "C:\C:\...".
const DIRECTORIOS = ['../android/app/src/main/res/', '../assets/'].map((relativa) =>
  fileURLToPath(new URL(relativa, import.meta.url)),
);

async function* pngs(directorio) {
  for (const entrada of await readdir(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) yield* pngs(ruta);
    else if (extname(entrada.name) === '.png') yield ruta;
  }
}

let antes = 0;
let despues = 0;
let optimizados = 0;

for (const directorio of DIRECTORIOS) {
  for await (const ruta of pngs(directorio)) {
    antes += (await stat(ruta)).size;

    // sharp no puede escribir sobre el fichero que está leyendo: se pasa por un
    // temporal y se renombra.
    const temporal = `${ruta}.tmp`;
    await sharp(ruta)
      .png({ palette: true, colors: 256, compressionLevel: 9, effort: 10 })
      .toFile(temporal);

    // Si la cuantización no mejora (los iconos chicos ya están al mínimo) se deja
    // el original: no tiene sentido tocar un fichero para empeorarlo.
    if ((await stat(temporal)).size < (await stat(ruta)).size) {
      await rename(temporal, ruta);
      optimizados++;
    } else {
      await unlink(temporal);
    }

    despues += (await stat(ruta)).size;
  }
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2);
console.log(`Optimizados ${optimizados} PNG: ${mb(antes)} MB -> ${mb(despues)} MB`);
