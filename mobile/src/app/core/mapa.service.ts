import { Injectable } from '@angular/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { Capacitor } from '@capacitor/core';

/**
 * Abre una dirección en un mapa (hoy, la del salón desde Contacto).
 *
 * No basta con un enlace como los de `tel:` y `mailto:`. En la app empaquetada Capacitor saca
 * las URL externas al sistema con un intent, pero si ninguna app lo atiende se traga el error
 * y el enlace no hace nada. Con el marcador da igual, porque siempre lo hay; con un mapa no,
 * porque ese caso tiene que acabar en el navegador. AppLauncher lanza el mismo intent y
 * además dice si alguien lo atendió.
 */
@Injectable({ providedIn: 'root' })
export class MapaService {
  async abrir(direccion: string): Promise<void> {
    const busqueda = encodeURIComponent(direccion);
    const googleMaps = `https://www.google.com/maps/search/?api=1&query=${busqueda}`;

    if (!this.esNativo()) {
      // Sin ningún await antes: el navegador solo deja abrir una pestaña dentro del gesto del
      // usuario, y un await intermedio basta para que el bloqueador de ventanas se la coma.
      window.open(googleMaps, '_blank', 'noopener');
      return;
    }

    // `geo:` es la URI de ubicación de Android: la atienden Google Maps, Waze y cualquier app
    // de mapas, y el sistema abre la predeterminada o pregunta con cuál. Una URL de Google Maps
    // nunca abriría Waze. El 0,0 lo exige la sintaxis al buscar por texto; con `q=` se ignora.
    if (await this.lanzar(`geo:0,0?q=${busqueda}`)) {
      return;
    }
    // No hay app de mapas: un https lo atiende el navegador predeterminado.
    await this.lanzar(googleMaps);
  }

  private async lanzar(url: string): Promise<boolean> {
    try {
      const { completed } = await AppLauncher.openUrl({ url });
      return completed;
    } catch {
      return false;
    }
  }

  /** La costura por la que los tests fuerzan cada rama; el porqué, en `FicheroService.esNativo`. */
  protected esNativo(): boolean {
    return Capacitor.isNativePlatform();
  }
}
