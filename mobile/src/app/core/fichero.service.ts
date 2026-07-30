import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { descargarBlob } from '@peluqueria/core';

/** Por qué no se ha podido entregar el fichero. */
export type MotivoSinFichero = 'cancelado' | 'error';

export type ResultadoFichero = { ok: true } | { ok: false; motivo: MotivoSinFichero };

/**
 * Entrega al usuario un fichero que llega del API como `Blob` (hoy, el recibo en PDF).
 *
 * Es el segundo punto donde la app se separa de la web: en el navegador basta con disparar
 * una descarga, pero en la app empaquetada no hay carpeta de descargas ni visor de PDF en
 * el WebView, así que el fichero se escribe en disco y se abre con la hoja de compartir del
 * sistema, que es la que ofrece «Guardar en Archivos», «Abrir con…» o enviarlo.
 */
@Injectable({ providedIn: 'root' })
export class FicheroService {
  /**
   * @param blob   contenido que devolvió el API
   * @param nombre nombre con el que se guarda, extensión incluida
   */
  async compartir(blob: Blob, nombre: string): Promise<ResultadoFichero> {
    // En el navegador (ionic serve o la PWA) los plugins nativos no aplican: se degrada a
    // la descarga normal, que es lo que el usuario espera allí.
    if (!this.esNativo()) {
      try {
        descargarBlob(blob, nombre);
        return { ok: true };
      } catch {
        return { ok: false, motivo: 'error' };
      }
    }

    try {
      // Directory.Cache y no Documents: es un fichero que el sistema puede limpiar cuando
      // quiera, y aquí no hace falta permiso de almacenamiento. Si el usuario lo quiere
      // conservar, lo guarda él desde la hoja de compartir.
      const escrito = await Filesystem.writeFile({
        path: nombre,
        data: await this.aBase64(blob),
        directory: Directory.Cache,
      });

      await Share.share({ title: nombre, url: escrito.uri });
      return { ok: true };
    } catch (error) {
      // Cerrar la hoja de compartir sin elegir nada rechaza la promesa: es una cancelación
      // y no debe pintarse como un fallo (mismo criterio que en CamaraService).
      return { ok: false, motivo: this.esCancelacion(error) ? 'cancelado' : 'error' };
    }
  }

  /**
   * Método aparte y no `Capacitor.isNativePlatform()` en línea: es la costura por la que
   * los tests fuerzan cada rama. Se evita a propósito hacer `vi.mock('@capacitor/core')`,
   * porque en esta suite el registro de mocks se comparte entre specs al empaquetarse y un
   * doble parcial de ese módulo podría dejar sin `registerPlugin` a Ionic.
   */
  protected esNativo(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Filesystem escribe texto, no binario, así que el PDF va en base64.
   *
   * Se usa FileReader y no `btoa` sobre el contenido: `btoa` solo acepta latin-1 y un PDF
   * tiene bytes fuera de ese rango, así que lanzaría InvalidCharacterError.
   */
  private aBase64(blob: Blob): Promise<string> {
    return new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onerror = () => rechazar(lector.error ?? new Error('No se ha podido leer el fichero.'));
      lector.onload = () => {
        const resultado = String(lector.result);
        // readAsDataURL devuelve "data:application/pdf;base64,XXXX" y el plugin quiere
        // solo la parte de después de la coma.
        const coma = resultado.indexOf(',');
        if (coma === -1) {
          rechazar(new Error('El fichero no se ha podido codificar.'));
          return;
        }
        resolver(resultado.slice(coma + 1));
      };
      lector.readAsDataURL(blob);
    });
  }

  private esCancelacion(error: unknown): boolean {
    const mensaje = error instanceof Error ? error.message : String(error ?? '');
    const texto = mensaje.toLowerCase();
    return texto.includes('cancel') || texto.includes('abort') || texto.includes('dismiss');
  }
}
