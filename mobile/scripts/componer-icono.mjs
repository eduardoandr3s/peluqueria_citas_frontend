/**
 * Compone las fuentes del icono (`assets/`) y el emblema del splash a partir de
 * `public/logo.png`.
 *
 * Existe porque el logo del negocio NO sirve tal cual: es apaisado (677x369) y por
 * debajo de los 1024 px que pide `@capacitor/assets`. Lo aprovechable es el emblema
 * circular, que hay que recortar y centrar en un lienzo cuadrado con fondo opaco.
 * Dejarlo en un script y no "en el Paint de alguien" es lo que permite rehacer el
 * icono si cambia el logo sin volver a deducir el recorte ni los tamanos.
 *
 * Uso:  node scripts/componer-icono.mjs   (luego `npm run assets`)
 */
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = (relativa) => fileURLToPath(new URL(relativa, import.meta.url));

/** El logo, con el emblema dentro y mucho blanco alrededor. */
const LOGO = raiz('../src/assets/logo.png');
const ASSETS = raiz('../assets/');
const RES = raiz('../android/app/src/main/res/');

/**
 * Recorte del emblema dentro del logo, medido buscando el bounding box de lo que
 * no es transparente. Si se cambia el logo hay que volver a medirlo.
 */
const EMBLEMA = { left: 186, top: 24, width: 297, height: 315 };

/** Cobre de marca: el ion-color-primary de la app. Ver assets/LEEME.md. */
const COBRE = { r: 0xe0, g: 0x7a, b: 0x5f, alpha: 1 };

/** El emblema solo, sin margen, a la altura pedida. */
const emblema = (altura) =>
  sharp(LOGO)
    .extract(EMBLEMA)
    .resize({ height: altura, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

/**
 * El emblema centrado en un lienzo cuadrado. `altura` va en px sobre un lienzo de
 * `lado`: es la proporcion lo que importa, porque el icono adaptativo recorta y
 * solo el ~66 % central se ve con seguridad.
 */
async function cuadrado(lado, altura, fondo) {
  return sharp({ create: { width: lado, height: lado, channels: 4, background: fondo } })
    .composite([{ input: await emblema(altura), gravity: 'centre' }])
    .png()
    .toBuffer();
}

const TRANSPARENTE = { r: 0, g: 0, b: 0, alpha: 0 };

/** Lienzo de color plano, sin emblema. */
const plano = (lado, fondo) =>
  sharp({ create: { width: lado, height: lado, channels: 4, background: fondo } })
    .png()
    .toBuffer();

await mkdir(ASSETS, { recursive: true });

const salidas = [
  // Icono heredado (Android < 8). Fondo OPACO obligatorio.
  [`${ASSETS}icon.png`, await cuadrado(1024, 780, COBRE)],
  // Primer plano del adaptativo: dentro del 66 % central y transparente.
  [`${ASSETS}icon-foreground.png`, await cuadrado(1024, 660, TRANSPARENTE)],
  // La herramienta lo pide para tratar el icono como adaptativo, aunque el fondo
  // que se ve al final salga de @color/marca_cobre.
  [`${ASSETS}icon-background.png`, await plano(1024, COBRE)],
  // Para el panel de Play Store. No va dentro del APK.
  [`${ASSETS}play-store-512.png`, await cuadrado(512, 390, COBRE)],
  // Emblema del splash: 640 px en xxxhdpi = 160 dp, sin fondo (lo pone el
  // layer-list de res/drawable/splash.xml).
  [`${RES}drawable-xxxhdpi/splash_logo.png`, await emblema(640)],
];

for (const [ruta, contenido] of salidas) {
  await sharp(contenido).png({ palette: true, colors: 256, compressionLevel: 9 }).toFile(ruta);
  console.log(`  ${ruta}`);
}
