import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { AuthService, esAreaAjena, rutaInternaSegura } from '@peluqueria/core';
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
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly biometric = inject(BiometricService);

  /**
   * A dónde volver después de entrar, si quien manda al login lo pide. Lo usan «El equipo»
   * —que es público: se elige a alguien sin tener cuenta y tras entrar se cae en agendar con
   * esa persona ya puesta— y los guards, que lo ponen cuando rebotan por falta de sesión, para
   * que una sesión caducada devuelva a la pantalla donde estaba y no a la de inicio.
   */
  private readonly returnUrl = rutaInternaSegura(
    this.route.snapshot.queryParamMap.get('returnUrl'),
    '/auth/login',
  );

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
      next: () => this.router.navigateByUrl(this.destino(), { replaceUrl: true }),
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
      await this.router.navigateByUrl(this.destino(), { replaceUrl: true });
      return;
    }
    this.avisoBiometrico.set(this.aviso(resultado));
    // Un refresh rechazado borra el enrolamiento: el botón debe desaparecer.
    await this.revisarBiometria();
  }

  /**
   * A dónde se entra: al destino guardado si es alcanzable para este rol, y si no a su área.
   *
   * Hace falta comprobar el rol porque el destino puede venir de cualquiera de las dos áreas:
   * los guards lo ponen tal cual estaba la URL, así que un cliente puede traer `/admin/...` (si
   * escribió la ruta a mano) y el personal `/tabs/...` (si entró por el enlace del equipo).
   * Obedecerlo a ciegas mandaría a la pantalla que el guard del área contraria va a rebotar,
   * y el usuario vería un salto que no ha pedido.
   */
  private destino(): string {
    const casa = this.auth.isStaff() ? '/admin' : '/tabs';
    const vuelta = this.returnUrl;
    return vuelta && this.alcanzable(vuelta) ? vuelta : casa;
  }

  /**
   * Si esa ruta no la rebotaría el guard del área que no le toca. Se deniega solo eso: el resto
   * —`/pago/:id`, `/equipo`, `/asistente`— no es de ningún área y vale para los dos.
   */
  private alcanzable(ruta: string): boolean {
    return !esAreaAjena(ruta, this.auth.isStaff() ? '/tabs' : '/admin');
  }

  private async revisarBiometria(): Promise<void> {
    this.biometriaDisponible.set(this.biometric.isEnabled() && (await this.biometric.isAvailable()));
  }

  private aviso(resultado: UnlockResult | null): string {
    return resultado && resultado !== 'ok' ? AVISOS[resultado] : '';
  }
}
