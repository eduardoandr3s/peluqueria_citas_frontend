import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
} from '@ionic/angular/standalone';
import { AuthService } from '@peluqueria/core';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  imports: [
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonButton, IonInput, IonItem, IonSpinner, IonNote,
    ReactiveFormsModule, RouterLink,
  ],
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly loading = signal(false);
  readonly error = signal('');

  register(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { nombre, email, telefono, password } = this.form.getRawValue();
    this.auth.registro({ nombre, email, password, telefono: telefono || undefined }).subscribe({
      next: () => {
        // Registrado: hacer login automático
        this.auth.login({ email, password }).subscribe({
          next: () => this.router.navigateByUrl('/tabs', { replaceUrl: true }),
          error: () => {
            this.loading.set(false);
            this.router.navigateByUrl('/auth/login', { replaceUrl: true });
          },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 409) {
          this.error.set('Ya existe una cuenta con ese email.');
        } else if (err.status === 400) {
          this.error.set('Revisa los datos introducidos.');
        } else {
          this.error.set('Error de conexión. Inténtalo de nuevo.');
        }
      },
    });
  }
}
