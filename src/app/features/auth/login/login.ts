import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div class="w-full max-w-sm">
        <div class="mb-8 text-center">
          <span
            class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-500 text-xl font-bold text-white"
            >LS</span
          >
          <h1 class="text-2xl font-bold text-slate-800">Peluquería Lalo Segovia</h1>
          <p class="text-sm text-slate-500">Panel de administración</p>
        </div>

        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          class="space-y-5 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200"
        >
          <div>
            <label for="email" class="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              autocomplete="username"
              placeholder="admin@peluqueria.com"
              class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            @if (showError('email')) {
              <p class="mt-1 text-xs text-red-600">Introduce un email válido.</p>
            }
          </div>

          <div>
            <label for="password" class="mb-1.5 block text-sm font-medium text-slate-700"
              >Contraseña</label
            >
            <input
              id="password"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              placeholder="••••••••"
              class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            @if (showError('password')) {
              <p class="mt-1 text-xs text-red-600">La contraseña es obligatoria.</p>
            }
          </div>

          @if (errorMsg()) {
            <div class="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {{ errorMsg() }}
            </div>
          }

          <button
            type="submit"
            [disabled]="loading()"
            class="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
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
        </form>
      </div>
    </div>
  `,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly errorMsg = signal<string | null>(null);

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
        if (!this.auth.isAdmin()) {
          // Cuenta válida pero sin permisos de administrador.
          this.auth.logout();
          this.errorMsg.set('Esta cuenta no tiene permisos de administrador.');
          return;
        }
        this.router.navigate(['/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMsg.set(
          err.error?.error ?? 'No se pudo iniciar sesión. Revisa tus credenciales.',
        );
      },
    });
  }
}
