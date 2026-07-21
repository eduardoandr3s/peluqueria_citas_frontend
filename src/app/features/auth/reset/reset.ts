import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@peluqueria/core';

@Component({
  selector: 'app-reset',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-base p-4">
      <div class="w-full max-w-sm">
        <div class="mb-8 text-center">
          <span
            class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-xl font-bold text-white"
            >LS</span
          >
          <h1 class="text-2xl font-bold text-main">Nueva contraseña</h1>
          <p class="text-sm text-muted">Elige una contraseña para tu cuenta</p>
        </div>

        @if (!token) {
          <div class="space-y-5 rounded-2xl bg-surface p-8 shadow-sm ring-1 ring-line">
            <div class="rounded-lg bg-error/15 px-3.5 py-2.5 text-sm text-error">
              El enlace no es válido. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".
            </div>
            <a
              routerLink="/recuperar"
              class="block w-full rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              Solicitar enlace
            </a>
          </div>
        } @else if (completado()) {
          <div class="space-y-5 rounded-2xl bg-surface p-8 shadow-sm ring-1 ring-line">
            <div class="rounded-lg bg-primary/10 px-3.5 py-3 text-sm text-main">
              Tu contraseña se ha actualizado. Ya puedes iniciar sesión con ella.
            </div>
            <a
              routerLink="/login"
              class="block w-full rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              Iniciar sesión
            </a>
          </div>
        } @else {
          <form
            [formGroup]="form"
            (ngSubmit)="onSubmit()"
            class="space-y-5 rounded-2xl bg-surface p-8 shadow-sm ring-1 ring-line"
          >
            <div>
              <label for="password" class="mb-1.5 block text-sm font-medium text-main"
                >Nueva contraseña</label
              >
              <div class="relative">
                <input
                  id="password"
                  [type]="verPassword() ? 'text' : 'password'"
                  formControlName="password"
                  autocomplete="new-password"
                  placeholder="••••••••"
                  class="w-full rounded-lg border border-line bg-base py-2.5 pl-3.5 pr-10 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  (click)="verPassword.set(!verPassword())"
                  [attr.aria-label]="verPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted transition hover:text-main"
                >
                  @if (verPassword()) {
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L9.88 9.88" />
                    </svg>
                  } @else {
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.183.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  }
                </button>
              </div>
              @if (showError('password')) {
                <p class="mt-1 text-xs text-error">La contraseña debe tener al menos 6 caracteres.</p>
              }
            </div>

            <div>
              <label for="confirmar" class="mb-1.5 block text-sm font-medium text-main"
                >Repite la contraseña</label
              >
              <div class="relative">
                <input
                  id="confirmar"
                  [type]="verPassword() ? 'text' : 'password'"
                  formControlName="confirmar"
                  autocomplete="new-password"
                  placeholder="••••••••"
                  class="w-full rounded-lg border border-line bg-base py-2.5 pl-3.5 pr-10 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  (click)="verPassword.set(!verPassword())"
                  [attr.aria-label]="verPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted transition hover:text-main"
                >
                  @if (verPassword()) {
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L9.88 9.88" />
                    </svg>
                  } @else {
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.183.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  }
                </button>
              </div>
              @if (form.hasError('noCoincide') && form.controls.confirmar.touched) {
                <p class="mt-1 text-xs text-error">Las contraseñas no coinciden.</p>
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
                Guardando…
              } @else {
                Cambiar contraseña
              }
            </button>
          </form>
        }
      </div>
    </div>
  `,
})
export class Reset {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly token = this.route.snapshot.queryParamMap.get('token');

  protected readonly loading = signal(false);
  protected readonly completado = signal(false);
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly verPassword = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmar: ['', [Validators.required]],
    },
    { validators: passwordsCoinciden },
  );

  protected showError(control: 'password' | 'confirmar'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.dirty || c.touched);
  }

  protected onSubmit(): void {
    if (!this.token || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMsg.set(null);

    this.auth.resetPassword(this.token, this.form.getRawValue().password).subscribe({
      next: () => {
        this.loading.set(false);
        this.completado.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 400) {
          this.errorMsg.set(
            err.error?.error ?? 'El enlace no es válido o ha caducado. Solicita uno nuevo.',
          );
        } else if (err.status === 429) {
          this.errorMsg.set('Demasiados intentos. Inténtalo de nuevo más tarde.');
        } else {
          this.errorMsg.set('No se pudo cambiar la contraseña. Inténtalo de nuevo.');
        }
      },
    });
  }
}

/** Valida que ambos campos de contraseña coincidan. */
function passwordsCoinciden(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmar = group.get('confirmar')?.value;
  return password === confirmar ? null : { noCoincide: true };
}
