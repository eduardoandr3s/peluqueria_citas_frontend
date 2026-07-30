/**
 * Descarga de un blob en el navegador.
 *
 * Hace falta porque los ficheros que sirve el API (por ahora el recibo en PDF) exigen el
 * JWT: un `<a href>` directo no pasa por el interceptor y recibe un 401. Así que el
 * fichero se pide con `HttpClient`, llega como blob y aquí se convierte en una descarga.
 *
 * En la app móvil empaquetada esto NO es lo que se usa (allí el fichero se guarda con
 * `@capacitor/filesystem` y se abre con `@capacitor/share`); sirve de respaldo cuando la
 * app corre en el navegador como PWA.
 */
export function descargarBlob(blob: Blob, nombreFichero: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreFichero;

  // Se añade al documento antes de pulsarlo: hay navegadores que ignoran el click de un
  // elemento que no está en el árbol.
  enlace.style.display = 'none';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  // El revoke va en el siguiente turno del event loop, no aquí mismo: revocar la URL en
  // el mismo tick que el click puede cancelar la descarga antes de que empiece.
  setTimeout(() => URL.revokeObjectURL(url));
}
