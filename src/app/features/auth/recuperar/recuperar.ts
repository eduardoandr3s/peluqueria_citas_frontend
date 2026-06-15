import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@peluqueria/core';

@Component({
  selector: 'app-recuperar',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-base p-4">
      <div class="w-full max-w-sm">
        <div class="mb-8 text-center">
          <span
            class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-xl font-bold text-white"
            >LS</span
          >
          <h1 class="text-2xl font-bold text-main">Recuperar contraseña</h1>
          <p class="text-sm text-muted">Te enviaremos un enlace para restablecerla</p>
        </div>

        @if (enviado()) {
          <div class="space-y-5 rounded-2xl bg-surface p-8 shadow-sm ring-1 ring-line">
            <div class="rounded-lg bg-primary/10 px-3.5 py-3 text-sm text-main">
              Si el email está registrado, recibirás un correo con instrucciones para
              restablecer tu contraseña. Revisa también la carpeta de spam.
            </div>
            <a
              routerLink="/login"
              class="block w-full rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              Volver a iniciar sesión
            </a>
          </div>
        } @else {
          <form
            [formGroup]="form"
            (ngSubmit)="onSubmit()"
            class="space-y-5 rounded-2xl bg-surface p-8 shadow-sm ring-1 ring-line"
          >
            <div>
              <label for="email" class="mb-1.5 block text-sm font-medium text-main">Email</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                autocomplete="username"
                placeholder="tucorreo@ejemplo.com"
                class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              @if (showError()) {
                <p class="mt-1 text-xs text-error">Introduce un email válido.</p>
              }
            </div>

            @if (errorMsg()) {
              <div class="rounded-lg bg-error/15 px-3.5 py-2.5 text-sm text-error">
                {{ errorMsg() }}
              </div>
            }

            <button
              type="submit"
              [disabled]="loading()"
              class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              @if (loading()) {
                <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
                </svg>
                Enviando…
              } @else {
                Enviar enlace
              }
            </button>

            <p class="text-center text-sm text-muted">
              <a routerLink="/login" class="font-medium text-primary hover:underline">
                Volver a iniciar sesión
              </a>
            </p>
          </form>
        }
      </div>
    </div>
  `,
})
export class Recuperar {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(false);
  protected readonly enviado = signal(false);
  protected readonly errorMsg = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected showError(): boolean {
    const c = this.form.controls.email;
    return c.invalid && (c.dirty || c.touched);
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMsg.set(null);

    this.auth.recuperarPassword(this.form.getRawValue().email).subscribe({
      next: () => {
        this.loading.set(false);
        // Respuesta uniforme (anti-enumeración): siempre confirmamos el envío.
        this.enviado.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMsg.set(
          err.status === 429
            ? 'Has hecho demasiadas solicitudes. Inténtalo de nuevo más tarde.'
            : 'No se pudo procesar la solicitud. Inténtalo de nuevo.',
        );
      },
    });
  }
}
