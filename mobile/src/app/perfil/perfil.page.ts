import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonToggle,
  AlertController,
} from '@ionic/angular/standalone';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService, Usuario, UsuarioService, redimensionarImagen } from '@peluqueria/core';
import { BiometricService } from '../core/biometric.service';
import { CamaraService } from '../core/camara.service';

/** Un avatar no necesita 1200 px: con 512 sobra para el círculo del perfil. */
const LADO_AVATAR = 512;

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonLabel, IonButton, IonToggle,
  ],
})
export class PerfilPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly biometric = inject(BiometricService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly camara = inject(CamaraService);

  readonly user = this.auth.user;

  /** La biometría solo se ofrece si el dispositivo la soporta. */
  readonly biometriaDisponible = signal(false);
  readonly biometriaActiva = signal(false);

  /**
   * Datos del servidor, que es lo único que trae la URL del avatar: la sesión
   * guardada solo tiene nombre, email y rol (y la URL firmada caduca, así que no
   * tendría sentido guardarla).
   */
  readonly usuario = signal<Usuario | null>(null);
  readonly subiendo = signal(false);
  readonly avatarError = signal<string | null>(null);

  async ionViewWillEnter(): Promise<void> {
    this.biometriaDisponible.set(await this.biometric.isAvailable());
    this.biometriaActiva.set(this.biometric.isEnabled());
    this.cargarPerfil();
  }

  private cargarPerfil(): void {
    this.usuarioService.me().subscribe({
      next: (u) => this.aplicar(u),
      error: () => {
        // El nombre y el email ya se pintan desde la sesión; lo único que se pierde
        // es la foto, así que no hay nada que interrumpir al usuario.
      },
    });
  }

  /**
   * Cambia la foto de perfil desde la cámara o la galería.
   *
   * Es el único punto donde la app no comparte código con la web: allí el fichero
   * llega de un `<input type="file">` y aquí de la cámara nativa. El endpoint es el
   * mismo.
   */
  async cambiarFoto(): Promise<void> {
    const u = this.usuario();
    if (!u || this.subiendo()) {
      return;
    }
    this.avatarError.set(null);

    const elegida = await this.camara.elegirFoto();
    if (!elegida.ok) {
      if (elegida.motivo === 'sin-permiso') {
        await this.avisarSinPermiso();
      } else if (elegida.motivo === 'error') {
        this.avatarError.set('No se pudo abrir la cámara. Inténtalo de nuevo.');
      }
      // 'cancelado' no se avisa: el usuario acaba de cerrar el selector a propósito.
      return;
    }

    this.subiendo.set(true);
    // El plugin devuelve un Blob y `redimensionarImagen` trabaja con File; el nombre
    // da igual, porque la clave del objeto la genera el servidor.
    const fichero = new File([elegida.blob], 'avatar.jpg', {
      type: elegida.blob.type || 'image/jpeg',
    });
    const reducida = await redimensionarImagen(fichero, LADO_AVATAR);

    this.usuarioService.subirAvatar(u.idUsuario, reducida).subscribe({
      next: (actualizado) => {
        this.aplicar(actualizado);
        this.subiendo.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.subiendo.set(false);
        this.avatarError.set(
          err.status === 413
            ? 'La foto es demasiado grande.'
            : 'No se pudo subir la foto. Revisa tu conexión.',
        );
      },
    });
  }

  async confirmarQuitarFoto(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Quitar foto',
      message: '¿Seguro que quieres quitar tu foto de perfil?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Quitar', role: 'destructive', handler: () => this.quitarFoto() },
      ],
    });
    await alert.present();
  }

  private quitarFoto(): void {
    const u = this.usuario();
    if (!u) {
      return;
    }
    this.avatarError.set(null);
    this.subiendo.set(true);
    this.usuarioService.borrarAvatar(u.idUsuario).subscribe({
      next: (actualizado) => {
        this.aplicar(actualizado);
        this.subiendo.set(false);
      },
      error: () => {
        this.subiendo.set(false);
        this.avatarError.set('No se pudo quitar la foto.');
      },
    });
  }

  /**
   * El permiso denegado se explica, no se traga en silencio: la app ya no puede
   * volver a preguntar y solo se arregla desde los ajustes del sistema.
   */
  private async avisarSinPermiso(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Sin permiso',
      message:
        'Para cambiar tu foto necesitas dar acceso a la cámara o a las fotos en los ajustes del teléfono.',
      buttons: ['Entendido'],
    });
    await alert.present();
  }

  private aplicar(u: Usuario): void {
    this.usuario.set(u);
    this.auth.setAvatarUrl(u.urlAvatar ?? null);
  }

  async onToggleBiometria(event: CustomEvent): Promise<void> {
    const activar = (event.detail as { checked: boolean }).checked;
    if (activar === this.biometriaActiva()) {
      return;
    }
    try {
      if (activar) {
        await this.biometric.enable();
      } else {
        await this.biometric.disable();
      }
      this.biometriaActiva.set(this.biometric.isEnabled());
    } catch {
      // El usuario canceló o falló la verificación: revertir el toggle.
      this.biometriaActiva.set(this.biometric.isEnabled());
    }
  }

  async confirmarLogout(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Cerrar sesión',
      message: '¿Seguro que quieres cerrar sesión?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Cerrar sesión', role: 'destructive', handler: () => this.logout() },
      ],
    });
    await alert.present();
  }

  private logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
