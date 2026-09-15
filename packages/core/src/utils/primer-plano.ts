import { DestroyRef } from '@angular/core';

/**
 * Ejecuta algo cada vez que la página vuelve a primer plano.
 *
 * Existe porque preguntarle algo al backend **solo en el arranque no basta**: en el móvil la
 * app no se cierra, se queda en segundo plano, así que ese arranque puede ser de hace
 * semanas; y en el panel pasa lo mismo con una pestaña abierta desde ayer. Lo que se
 * configura desde el panel (los módulos, los datos del negocio) no llegaría nunca.
 *
 * Con `visibilitychange` y no con `@capacitor/app`: hace lo mismo dentro del WebView, vale
 * igual para el panel, y no añade una dependencia nativa por un evento que ya existe. Si
 * algún día falla en algún Android, esa es la alternativa.
 *
 * Vive aquí y no dentro de cada servicio para que no haya dos copias que un día divergirían.
 */
export function alVolverAPrimerPlano(destroyRef: DestroyRef, accion: () => void): void {
  const escucha = () => {
    if (document.visibilityState === 'visible') {
      accion();
    }
  };
  document.addEventListener('visibilitychange', escucha);
  destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', escucha));
}
