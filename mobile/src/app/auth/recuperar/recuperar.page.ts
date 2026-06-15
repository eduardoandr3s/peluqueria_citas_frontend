import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  IonItem,
  IonSpinner,
  IonNote,
  IonText,
} from '@ionic/angular/standalone';
import { AuthService } from '@peluqueria/core';

@Component({
  selector: 'app-recuperar',
  templateUrl: './recuperar.page.html',
  styleUrls: ['./recuperar.page.scss'],
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonButton, IonInput, IonItem, IonSpinner, IonNote, IonText,
    ReactiveFormsModule, RouterLink,
  ],
})
export class RecuperarPage {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly loading = signal(false);
  readonly enviado = signal(false);
  readonly error = signal('');

  recuperar(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.recuperarPassword(this.form.getRawValue().email).subscribe({
      next: () => {
        this.loading.set(false);
        // Respuesta uniforme (anti-enumeración): siempre confirmamos el envío.
        this.enviado.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(
          err.status === 429
            ? 'Demasiadas solicitudes. Inténtalo más tarde.'
            : 'Error de conexión. Inténtalo de nuevo.',
        );
      },
    });
  }
}
