import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * Por qué no hay foto. Se distingue la cancelación (el usuario cerró el selector,
 * no hay nada que avisar) del permiso denegado (hay que decirle que lo active en los
 * ajustes del sistema, porque la app ya no puede volver a preguntar).
 */
export type MotivoSinFoto = 'cancelado' | 'sin-permiso' | 'error';

export type ResultadoFoto = { ok: true; blob: Blob } | { ok: false; motivo: MotivoSinFoto };

/**
 * Obtención de una foto en el móvil. Es el único punto donde la app deja de
 * compartir código con la web: allí el fichero llega de un `<input type="file">`,
 * aquí de la cámara nativa con sus permisos. El endpoint al que se sube es el mismo.
 *
 * En el navegador (`ionic serve` o la PWA) el plugin cae a un selector de ficheros,
 * así que esto sigue funcionando sin cámara.
 */
@Injectable({ providedIn: 'root' })
export class CamaraService {
  /**
   * Pide una foto dejando que el usuario elija entre cámara y galería, y la
   * devuelve como `Blob` listo para el multipart.
   */
  async elegirFoto(): Promise<ResultadoFoto> {
    if (!(await this.hayPermiso())) {
      return { ok: false, motivo: 'sin-permiso' };
    }

    try {
      const foto = await Camera.getPhoto({
        source: CameraSource.Prompt,
        resultType: CameraResultType.Uri,
        // El backend rechaza lo que pase de 2 MB y luego se reduce en el cliente:
        // pedir ya 80 de calidad ahorra trabajo sin que se note.
        quality: 80,
        // Los textos del selector son NUESTROS: el plugin no los traduce y sus
        // defaults son literales en inglés ('Photo', 'From Photos', 'Take
        // Picture'), así que sin esto salen en inglés con el móvil en español.
        // Lo que viene después (cámara y galería del sistema) sí sigue el idioma
        // del teléfono. `promptLabelCancel` no se pone: es solo de iOS.
        promptLabelHeader: 'Foto de perfil',
        promptLabelPhoto: 'Elegir de la galería',
        promptLabelPicture: 'Hacer una foto',
      });

      if (!foto.webPath) {
        return { ok: false, motivo: 'error' };
      }
      // webPath es una URL local que el WebView sí puede leer; fetch es la forma
      // soportada de convertirla en bytes.
      const respuesta = await fetch(foto.webPath);
      return { ok: true, blob: await respuesta.blob() };
    } catch (error) {
      // getPhoto rechaza también cuando se cierra el selector sin elegir nada: eso
      // es una cancelación y no debe pintarse como un fallo.
      return { ok: false, motivo: this.esCancelacion(error) ? 'cancelado' : 'error' };
    }
  }

  /**
   * True salvo que cámara Y galería estén denegadas: con una de las dos basta,
   * porque el usuario elige de dónde saca la foto.
   *
   * Si el plugin no sabe responder (en el navegador no siempre implementa la
   * consulta) se sigue adelante y decide `getPhoto`.
   */
  private async hayPermiso(): Promise<boolean> {
    try {
      let estado = await Camera.checkPermissions();
      if (estado.camera !== 'granted' && estado.photos !== 'granted') {
        estado = await Camera.requestPermissions();
      }
      return estado.camera !== 'denied' || estado.photos !== 'denied';
    } catch {
      return true;
    }
  }

  private esCancelacion(error: unknown): boolean {
    const mensaje = error instanceof Error ? error.message : String(error ?? '');
    const texto = mensaje.toLowerCase();
    return texto.includes('cancel') || texto.includes('no image');
  }
}
