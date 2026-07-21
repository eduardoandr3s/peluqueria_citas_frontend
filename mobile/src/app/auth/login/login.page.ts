import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IonContent,
  IonButton,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonSpinner,
  IonNote,
} from '@ionic/angular/standalone';
import { AuthService } from '@peluqueria/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [IonContent, IonButton, IonInput, IonInputPasswordToggle, IonItem, IonSpinner, IonNote, ReactiveFormsModule, RouterLink],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly loading = signal(false);
  readonly error = signal('');

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
}
