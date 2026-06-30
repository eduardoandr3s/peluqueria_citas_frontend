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
import { AuthService } from '@peluqueria/core';
import { BiometricService } from '../core/biometric.service';

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

  readonly user = this.auth.user;

  /** La biometría solo se ofrece si el dispositivo la soporta. */
  readonly biometriaDisponible = signal(false);
  readonly biometriaActiva = signal(false);

  async ionViewWillEnter(): Promise<void> {
    this.biometriaDisponible.set(await this.biometric.isAvailable());
    this.biometriaActiva.set(this.biometric.isEnabled());
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
