/**
 * Redimensionado de imágenes en el cliente, antes de subirlas.
 *
 * No es cosmético: el servidor rechaza lo que pase de 2 MB, y una foto recién
 * hecha con el móvil pasa de largo. Redimensionar aquí evita el rechazo, gasta
 * la CPU del usuario en vez de la del servidor (que en producción tiene 0,1 CPU
 * y 512 MB) y mantiene el consumo de almacenamiento y de tráfico en el orden de
 * los KB por foto.
 */

/** Lado máximo (px) al que se reduce la imagen. Suficiente para una tarjeta. */
const LADO_MAXIMO = 1200;
/** Calidad JPEG del resultado. 0,82 es el punto donde deja de notarse. */
const CALIDAD = 0.82;

/**
 * Devuelve el fichero reducido, o el original si no se puede procesar.
 *
 * Degradar al original es deliberado: si el entorno no ofrece las APIs de imagen
 * o el fichero no se puede decodificar, quien decide sigue siendo la validación
 * del servidor, que es la única en la que se puede confiar. Aquí solo se
 * optimiza, así que ninguna de estas ramas debe impedir la subida.
 */
export async function redimensionarImagen(
  fichero: File,
  ladoMaximo = LADO_MAXIMO,
  calidad = CALIDAD,
): Promise<File> {
  if (!fichero.type.startsWith('image/') || !sePuedeProcesar()) {
    return fichero;
  }

  let bitmap: ImageBitmap | undefined;
  try {
    // createImageBitmap rechaza si el contenido no es una imagen; no se usa
    // `new Image()` como alternativa porque, si el entorno no carga imagenes,
    // ni onload ni onerror llegan a dispararse y la subida se quedaria colgada.
    bitmap = await createImageBitmap(fichero);
    const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
    // Ya es pequena: recomprimirla solo perderia calidad sin ganar nada.
    if (escala === 1) {
      return fichero;
    }

    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(bitmap.width * escala);
    lienzo.height = Math.round(bitmap.height * escala);
    const contexto = lienzo.getContext('2d');
    if (!contexto) {
      return fichero;
    }
    contexto.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      lienzo.toBlob(resolve, 'image/jpeg', calidad),
    );
    return blob ? new File([blob], renombrarAJpg(fichero.name), { type: 'image/jpeg' }) : fichero;
  } catch {
    return fichero;
  } finally {
    bitmap?.close();
  }
}

/** ¿Están las APIs necesarias? En entornos sin DOM (o tests) no lo están. */
function sePuedeProcesar(): boolean {
  return typeof createImageBitmap === 'function' && typeof document !== 'undefined';
}

function renombrarAJpg(nombre: string): string {
  const base = nombre.replace(/\.[^.]+$/, '');
  return `${base || 'imagen'}.jpg`;
}
