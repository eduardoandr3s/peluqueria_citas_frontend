import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, esAreaAjena, rutaInternaSegura } from '@peluqueria/core';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-base p-4">
      <div class="w-full max-w-sm">
        <div class="mb-8 text-center">
          <img
            src="logo.png"
            alt="Peluquería Lalo Segovia"
            class="mx-auto mb-3 h-auto w-60 max-w-full object-contain"
          />
          <p class="text-sm text-muted">Panel de administración</p>
        </div>

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
              placeholder="admin@peluqueria.com"
              class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            @if (showError('email')) {
              <p class="mt-1 text-xs text-error">Introduce un email válido.</p>
            }
          </div>

          <div>
            <label for="password" class="mb-1.5 block text-sm font-medium text-main"
              >Contraseña</label
            >
            <div class="relative">
              <input
                id="password"
                [type]="verPassword() ? 'text' : 'password'"
                formControlName="password"
                autocomplete="current-password"
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
              <p class="mt-1 text-xs text-error">La contraseña es obligatoria.</p>
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
              Entrando…
            } @else {
              Iniciar sesión
            }
          </button>

          <p class="text-center text-sm">
            <a routerLink="/recuperar" class="font-medium text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
          </p>
        </form>
      </div>
    </div>
  `,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /**
   * A dónde volver después de entrar. Lo ponen los guards cuando rebotan por falta de sesión,
   * para que una sesión caducada devuelva a la pantalla donde se estaba y no a la de inicio.
   * Se valida en el core: un destino que llega en un parámetro es un redirect abierto si no
   * se comprueba.
   */
  private readonly returnUrl = rutaInternaSegura(
    this.route.snapshot.queryParamMap.get('returnUrl'),
    '/login',
  );

  protected readonly loading = signal(false);
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly verPassword = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected showError(control: 'email' | 'password'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.dirty || c.touched);
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMsg.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        if (!this.auth.isStaff()) {
          // Cuenta válida pero que no es de la peluquería: el panel entero no es para ella.
          // Se cierra la sesión que se acaba de abrir para no dejarla a medias.
          this.auth.logout();
          this.errorMsg.set('Esta cuenta no tiene acceso al panel.');
          return;
        }
        // A `/inicio` y no a `/dashboard`: el dashboard vive de `/api/estadisticas`, que es de
        // ADMIN, así que mandar ahí a un peluquero sería mandarlo a un 403. `/inicio` es el
        // redirector que lleva a cada rol a su pantalla.
        this.router.navigateByUrl(this.destino());
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMsg.set(
          err.error?.error ?? 'No se pudo iniciar sesión. Revisa tus credenciales.',
        );
      },
    });
  }

  /**
   * A dónde se entra: al destino guardado si es alcanzable para este rol, y si no a `/inicio`.
   *
   * Un peluquero puede traer una ruta de administración (si la escribió a mano y `adminGuard`
   * la rechazó, o si su sesión caducó ahí), y obedecerla lo mandaría a la pantalla que ese
   * mismo guard va a rebotar. En ese caso decide `/inicio`.
   */
  private destino(): string {
    const vuelta = this.returnUrl;
    if (!vuelta) return '/inicio';
    // Lo único vedado a un peluquero son las pantallas de ADMIN, y no cuelgan de un prefijo
    // común: se comprueba contra la lista de las que llevan `adminGuard` en su ruta.
    const soloAdmin = ['/dashboard', '/servicios', '/usuarios', '/peluqueros', '/permisos', '/bloqueos'];
    if (!this.auth.isAdmin() && soloAdmin.some((ruta) => esAreaAjena(vuelta, ruta))) {
      return '/inicio';
    }
    return vuelta;
  }
}
