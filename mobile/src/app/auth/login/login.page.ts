import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonSpinner,
  IonNote,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { fingerPrint } from 'ionicons/icons';
import { AuthService } from '@peluqueria/core';
import { BiometricService, UnlockResult } from '../../core/biometric.service';

/** Por qué el arranque acabó en el login, en palabras para el usuario. */
const AVISOS: Record<Exclude<UnlockResult, 'ok'>, string> = {
  cancelado: 'Desbloqueo cancelado. Vuelve a intentarlo o entra con tu contraseña.',
  'sesion-caducada':
    'Tu sesión ha caducado. Entra con tu contraseña y vuelve a activar la huella en tu perfil.',
  'error-conexion':
    'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
};

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [IonContent, IonButton, IonIcon, IonInput, IonInputPasswordToggle, IonItem, IonSpinner, IonNote, ReactiveFormsModule, RouterLink],
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly biometric = inject(BiometricService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly loading = signal(false);
  readonly error = signal('');

  /** El botón de huella solo aparece si hay sesión enrolada y sin desbloquear. */
  readonly biometriaDisponible = signal(false);
  readonly desbloqueando = signal(false);
  readonly avisoBiometrico = signal('');

  constructor() {
    addIcons({ fingerPrint });
  }

  async ngOnInit(): Promise<void> {
    this.avisoBiometrico.set(this.aviso(this.biometric.ultimoIntento()));
    await this.revisarBiometria();
  }

  login(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.login({ email, password }).subscribe({
      next: () =>
        this.router.navigateByUrl(this.auth.isAdmin() ? '/admin' : '/tabs', { replaceUrl: true }),
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(err.status === 401 ? 'Email o contraseña incorrectos.' : 'Error de conexión.');
      },
    });
  }

  /**
   * Reintento manual del desbloqueo. Sin esto, cancelar el diálogo de huella al
   * arrancar dejaba al usuario en el login sin más salida que cerrar la app.
   */
  async desbloquear(): Promise<void> {
    if (this.desbloqueando()) return;
    this.desbloqueando.set(true);
    const resultado = await this.biometric.unlock();
    this.desbloqueando.set(false);
    if (resultado === 'ok') {
      await this.router.navigateByUrl(this.auth.isAdmin() ? '/admin' : '/tabs', {
        replaceUrl: true,
      });
      return;
    }
    this.avisoBiometrico.set(this.aviso(resultado));
    // Un refresh rechazado borra el enrolamiento: el botón debe desaparecer.
    await this.revisarBiometria();
  }

  private async revisarBiometria(): Promise<void> {
    this.biometriaDisponible.set(this.biometric.isEnabled() && (await this.biometric.isAvailable()));
  }

  private aviso(resultado: UnlockResult | null): string {
    return resultado && resultado !== 'ok' ? AVISOS[resultado] : '';
  }
}
