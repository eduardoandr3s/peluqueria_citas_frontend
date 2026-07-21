import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonSpinner,
  IonNote,
  IonText,
} from '@ionic/angular/standalone';
import { AuthService } from '@peluqueria/core';

@Component({
  selector: 'app-reset',
  templateUrl: './reset.page.html',
  styleUrls: ['./reset.page.scss'],
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonButton, IonInput, IonInputPasswordToggle, IonItem, IonSpinner, IonNote, IonText,
    ReactiveFormsModule, RouterLink,
  ],
})
export class ResetPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly token = this.route.snapshot.queryParamMap.get('token');

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmar: ['', [Validators.required]],
    },
    { validators: passwordsCoinciden },
  );

  readonly loading = signal(false);
  readonly completado = signal(false);
  readonly error = signal('');

  reset(): void {
    if (!this.token || this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.resetPassword(this.token, this.form.getRawValue().password).subscribe({
      next: () => {
        this.loading.set(false);
        this.completado.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 400) {
          this.error.set(err.error?.error ?? 'El enlace no es válido o ha caducado.');
        } else if (err.status === 429) {
          this.error.set('Demasiados intentos. Inténtalo más tarde.');
        } else {
          this.error.set('Error de conexión. Inténtalo de nuevo.');
        }
      },
    });
  }

  irALogin(): void {
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}

/** Valida que ambos campos de contraseña coincidan. */
function passwordsCoinciden(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmar = group.get('confirmar')?.value;
  return password === confirmar ? null : { noCoincide: true };
}
