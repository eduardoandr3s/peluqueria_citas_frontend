import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Rol, Usuario, UsuarioRequest, UsuarioUpdate } from '../../core/models/usuario.model';
import { AuthService } from '../../core/services/auth.service';
import { UsuarioService } from '../../core/services/usuario.service';

type PendingType = 'promote' | 'demote' | 'deactivate' | 'activate';

interface PendingAction {
  type: PendingType;
  usuario: Usuario;
}

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

@Component({
  selector: 'app-usuarios',
  imports: [FormsModule, ReactiveFormsModule, DatePipe],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-main">Usuarios</h1>
          <p class="text-sm text-muted">
            Gestiona cuentas: crea, edita, cambia roles o desactiva usuarios.
          </p>
        </div>
        <div class="flex items-center gap-3">
          @if (!loading() && !loadError()) {
            <span class="text-sm text-muted">{{ totalElements() }} usuario(s)</span>
          }
          <label class="flex cursor-pointer items-center gap-2 text-sm text-main">
            <input
              type="checkbox"
              [checked]="incluirInactivos()"
              (change)="toggleInactivos()"
              class="h-4 w-4 rounded border-line text-primary focus:ring-primary"
            />
            Mostrar desactivados
          </label>
          <button
            type="button"
            (click)="abrirCrear()"
            class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nuevo usuario
          </button>
        </div>
      </div>

      <!-- Feedback de acciones -->
      @if (feedback(); as fb) {
        <div
          class="flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm"
          [class]="fb.type === 'success' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'"
        >
          <span>{{ fb.text }}</span>
          <button type="button" (click)="feedback.set(null)" class="font-medium hover:opacity-70">✕</button>
        </div>
      }

      <!-- Buscador -->
      <div class="relative max-w-sm">
        <svg
          class="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-muted"
          fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          [ngModel]="search()"
          (ngModelChange)="onSearchChange($event)"
          placeholder="Buscar por nombre o email…"
          class="w-full rounded-lg border border-line bg-base py-2 pl-10 pr-3 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div class="rounded-xl bg-surface shadow-sm ring-1 ring-line">
        @if (loading()) {
          <div class="p-5 space-y-3">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <div class="h-10 animate-pulse rounded bg-elevated"></div>
            }
          </div>
        } @else if (loadError()) {
          <div class="p-8 text-center">
            <p class="text-sm text-error">{{ loadError() }}</p>
            <button
              type="button"
              (click)="cargar()"
              class="mt-3 rounded-lg bg-elevated px-4 py-2 text-sm font-medium text-main hover:bg-line"
            >
              Reintentar
            </button>
          </div>
        } @else if (usuarios().length === 0) {
          <div class="p-8 text-center text-sm text-muted">
            @if (search().trim()) {
              No se encontraron usuarios para «{{ search() }}».
            } @else {
              No hay usuarios registrados.
            }
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th class="px-5 py-3 font-medium">Usuario</th>
                  <th class="px-5 py-3 font-medium">Teléfono</th>
                  <th class="px-5 py-3 font-medium">Registro</th>
                  <th class="px-5 py-3 font-medium">Rol</th>
                  <th class="px-5 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line">
                @for (u of usuarios(); track u.idUsuario) {
                  <tr class="hover:bg-elevated">
                    <td class="px-5 py-3">
                      <div class="flex items-center gap-3">
                        <span class="flex h-9 w-9 items-center justify-center rounded-full bg-elevated text-xs font-bold text-main">
                          {{ iniciales(u.nombre) }}
                        </span>
                        <div class="leading-tight">
                          <p class="font-medium text-main">
                            {{ u.nombre }}
                            @if (esYo(u)) {
                              <span class="ml-1 text-xs font-normal text-muted">(tú)</span>
                            }
                            @if (esInactivo(u)) {
                              <span class="ml-1.5 inline-flex rounded-full bg-elevated px-2 py-0.5 text-xs font-semibold text-muted">Inactivo</span>
                            }
                          </p>
                          <p class="text-xs text-muted">{{ u.email }}</p>
                        </div>
                      </div>
                    </td>
                    <td class="px-5 py-3 text-main">{{ u.telefono || '—' }}</td>
                    <td class="px-5 py-3 text-main">
                      {{ u.fechaRegistro ? (u.fechaRegistro | date: 'dd/MM/yyyy') : '—' }}
                    </td>
                    <td class="px-5 py-3">
                      <span
                        class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        [class]="u.rol === 'ADMIN' ? 'bg-primary/15 text-primary' : 'bg-elevated text-main'"
                        >{{ u.rol }}</span
                      >
                    </td>
                    <td class="px-5 py-3">
                      <div class="flex items-center justify-end gap-2">
                        @if (busyId() === u.idUsuario) {
                          <span class="text-xs text-muted">Procesando…</span>
                        } @else if (esInactivo(u)) {
                          <button
                            type="button"
                            (click)="pedirConfirmacion('activate', u)"
                            class="rounded-md px-2.5 py-1 text-xs font-medium text-success hover:bg-success/10"
                          >
                            Reactivar
                          </button>
                        } @else {
                          <button
                            type="button"
                            (click)="abrirEditar(u)"
                            class="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                          >
                            Editar
                          </button>
                          @if (esYo(u)) {
                            <span class="text-xs text-muted">Cuenta actual</span>
                          } @else {
                          @if (u.rol === 'USER') {
                            <button
                              type="button"
                              (click)="pedirConfirmacion('promote', u)"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                            >
                              Hacer admin
                            </button>
                          } @else {
                            <button
                              type="button"
                              (click)="pedirConfirmacion('demote', u)"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-warning hover:bg-warning/10"
                            >
                              Quitar admin
                            </button>
                          }
                          <button
                            type="button"
                            (click)="pedirConfirmacion('deactivate', u)"
                            class="rounded-md px-2.5 py-1 text-xs font-medium text-error hover:bg-error/10"
                          >
                            Desactivar
                          </button>
                          }
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- Paginación -->
      @if (!loading() && !loadError() && totalPages() > 1) {
        <div class="flex items-center justify-between text-sm text-main">
          <span>Página {{ page() + 1 }} de {{ totalPages() }}</span>
          <div class="flex items-center gap-1">
            <button
              type="button"
              (click)="irPagina(page() - 1)"
              [disabled]="page() === 0"
              class="rounded-md border border-line px-3 py-1.5 font-medium text-main transition hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              (click)="irPagina(page() + 1)"
              [disabled]="page() + 1 >= totalPages()"
              class="rounded-md border border-line px-3 py-1.5 font-medium text-main transition hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      }
    </div>

    <!-- Modal: crear / editar usuario -->
    @if (formOpen()) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <form
          [formGroup]="form"
          (ngSubmit)="guardar()"
          class="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-xl"
        >
          <h2 class="text-lg font-semibold text-main">
            {{ editando() ? 'Editar usuario' : 'Nuevo usuario' }}
          </h2>
          @if (!editando()) {
            <p class="mt-1 text-xs text-muted">
              La cuenta se crea con rol USER; podrás cambiarle el rol desde el listado.
            </p>
          }

          @if (formError()) {
            <div class="mt-4 rounded-lg bg-error/15 px-3.5 py-2.5 text-sm text-error">
              {{ formError() }}
            </div>
          }

          <div class="mt-5 space-y-4">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">Nombre</label>
              <input
                type="text"
                formControlName="nombre"
                placeholder="Nombre y apellidos"
                class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              @if (invalidCampo('nombre')) {
                <p class="mt-1 text-xs text-error">El nombre es obligatorio.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">Email</label>
              <input
                type="email"
                formControlName="email"
                placeholder="cliente@email.com"
                class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              @if (invalidCampo('email')) {
                <p class="mt-1 text-xs text-error">Introduce un email válido.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">
                Teléfono <span class="text-muted">(opcional)</span>
              </label>
              <input
                type="tel"
                formControlName="telefono"
                placeholder="600123456"
                class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              @if (invalidCampo('telefono')) {
                <p class="mt-1 text-xs text-error">El teléfono debe tener entre 9 y 15 caracteres.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">
                {{ editando() ? 'Nueva contraseña' : 'Contraseña' }}
                @if (editando()) {
                  <span class="text-muted">(en blanco para no cambiarla)</span>
                }
              </label>
              <div class="relative">
                <input
                  [type]="verPassword() ? 'text' : 'password'"
                  formControlName="password"
                  placeholder="Mínimo 6 caracteres"
                  autocomplete="new-password"
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
              @if (invalidCampo('password')) {
                <p class="mt-1 text-xs text-error">La contraseña debe tener al menos 6 caracteres.</p>
              }
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="formOpen.set(false)"
              class="rounded-lg px-4 py-2 text-sm font-medium text-main hover:bg-elevated"
            >
              Cancelar
            </button>
            <button
              type="submit"
              [disabled]="saving()"
              class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              {{ saving() ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </form>
      </div>
    }

    <!-- Modal de confirmación -->
    @if (pending(); as p) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <div class="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-main">{{ confirmTitulo(p) }}</h2>
          <p class="mt-2 text-sm text-main">{{ confirmMensaje(p) }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="pending.set(null)"
              class="rounded-lg px-4 py-2 text-sm font-medium text-main hover:bg-elevated"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="confirmar(p)"
              class="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              [class]="p.type === 'deactivate' ? 'bg-error hover:bg-error/80' : 'bg-primary hover:bg-primary-hover'"
            >
              {{ confirmAccion(p) }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class Usuarios implements OnInit {
  private readonly usuarioService = inject(UsuarioService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly pending = signal<PendingAction | null>(null);
  protected readonly busyId = signal<number | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);

  // Paginación (server-side, Page<> de Spring Data)
  protected readonly page = signal(0); // 0-based
  protected readonly totalPages = signal(0);
  protected readonly totalElements = signal(0);
  protected readonly incluirInactivos = signal(false);
  private readonly size = 20;

  protected readonly formOpen = signal(false);
  protected readonly editando = signal<Usuario | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly verPassword = signal(false);

  protected readonly form = this.fb.group({
    nombre: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.minLength(9), Validators.maxLength(15)]],
    password: [''],
  });

  private readonly miEmail = computed(() => this.auth.user()?.email ?? null);

  // Debounce para no lanzar una petición por cada tecla.
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.cargar();
  }

  protected onSearchChange(value: string): void {
    this.search.set(value);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.page.set(0); // toda búsqueda nueva arranca en la primera página
      this.cargar();
    }, 350);
  }

  protected cargar(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.usuarioService
      .listar({
        page: this.page(),
        size: this.size,
        incluirInactivos: this.incluirInactivos(),
        search: this.search(),
      })
      .subscribe({
        next: (p) => {
          this.usuarios.set(p.content);
          this.totalPages.set(p.totalPages);
          this.totalElements.set(p.totalElements);
          // Si la página actual quedó fuera de rango (p. ej. tras desactivar el último de la página).
          if (this.page() > 0 && this.page() >= p.totalPages) {
            this.page.set(Math.max(0, p.totalPages - 1));
            this.cargar();
            return;
          }
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set('No se pudieron cargar los usuarios.');
          this.loading.set(false);
        },
      });
  }

  protected irPagina(n: number): void {
    if (n < 0 || n >= this.totalPages() || n === this.page()) return;
    this.page.set(n);
    this.cargar();
  }

  protected toggleInactivos(): void {
    this.incluirInactivos.update((v) => !v);
    this.page.set(0);
    this.cargar();
  }

  protected esInactivo(u: Usuario): boolean {
    return u.activo === false;
  }

  protected esYo(u: Usuario): boolean {
    return u.email === this.miEmail();
  }

  protected iniciales(nombre: string): string {
    const parts = nombre.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  }

  protected invalidCampo(control: 'nombre' | 'email' | 'telefono' | 'password'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.dirty || c.touched);
  }

  protected abrirCrear(): void {
    this.feedback.set(null);
    this.formError.set(null);
    this.verPassword.set(false);
    this.editando.set(null);
    this.form.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.reset({ nombre: '', email: '', telefono: '', password: '' });
    this.formOpen.set(true);
  }

  protected abrirEditar(u: Usuario): void {
    this.feedback.set(null);
    this.formError.set(null);
    this.verPassword.set(false);
    this.editando.set(u);
    this.form.controls.password.setValidators([Validators.minLength(6)]);
    this.form.reset({
      nombre: u.nombre,
      email: u.email,
      telefono: u.telefono ?? '',
      password: '',
    });
    this.formOpen.set(true);
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const editando = this.editando();
    this.saving.set(true);
    this.formError.set(null);

    if (editando) {
      const payload: UsuarioUpdate = {
        nombre: v.nombre!.trim(),
        email: v.email!.trim(),
        telefono: v.telefono?.trim() || undefined,
        password: v.password?.trim() || undefined,
      };
      this.usuarioService.actualizar(editando.idUsuario, payload).subscribe({
        next: (actualizado) => {
          this.saving.set(false);
          this.formOpen.set(false);
          this.usuarios.update((list) =>
            list.map((u) => (u.idUsuario === actualizado.idUsuario ? actualizado : u)),
          );
          this.feedback.set({ type: 'success', text: `${actualizado.nombre} fue actualizado.` });
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.formError.set(this.extraerError(err) ?? 'No se pudo guardar el usuario.');
        },
      });
      return;
    }

    const payload: UsuarioRequest = {
      nombre: v.nombre!.trim(),
      email: v.email!.trim(),
      telefono: v.telefono?.trim() || undefined,
      password: v.password!,
    };
    this.usuarioService.crear(payload).subscribe({
      next: (creado) => {
        this.saving.set(false);
        this.formOpen.set(false);
        // El listado va paginado y ordenado por nombre: recargamos para colocarlo donde corresponde.
        this.cargar();
        this.feedback.set({ type: 'success', text: `${creado.nombre} fue creado con rol USER.` });
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(this.extraerError(err) ?? 'No se pudo crear el usuario.');
      },
    });
  }

  protected pedirConfirmacion(type: PendingType, usuario: Usuario): void {
    this.feedback.set(null);
    this.pending.set({ type, usuario });
  }

  protected confirmTitulo(p: PendingAction): string {
    switch (p.type) {
      case 'promote':
        return 'Dar permisos de administrador';
      case 'demote':
        return 'Quitar permisos de administrador';
      case 'deactivate':
        return 'Desactivar usuario';
      case 'activate':
        return 'Reactivar usuario';
    }
  }

  protected confirmMensaje(p: PendingAction): string {
    const n = p.usuario.nombre;
    switch (p.type) {
      case 'promote':
        return `${n} podrá acceder al panel de administración y gestionar todo el sistema.`;
      case 'demote':
        return `${n} dejará de tener acceso de administrador y pasará a ser un usuario normal.`;
      case 'deactivate':
        return `${n} dejará de tener acceso y no aparecerá en el listado. Esta acción es un borrado lógico.`;
      case 'activate':
        return `${n} volverá a tener acceso y aparecerá de nuevo en el listado de usuarios activos.`;
    }
  }

  protected confirmAccion(p: PendingAction): string {
    switch (p.type) {
      case 'deactivate':
        return 'Desactivar';
      case 'activate':
        return 'Reactivar';
      default:
        return 'Confirmar';
    }
  }

  protected confirmar(p: PendingAction): void {
    const id = p.usuario.idUsuario;
    this.pending.set(null);
    this.busyId.set(id);

    if (p.type === 'deactivate') {
      this.usuarioService.eliminar(id).subscribe({
        next: () => {
          if (this.incluirInactivos()) {
            // El toggle muestra inactivos: lo dejamos visible marcado como inactivo.
            this.usuarios.update((list) =>
              list.map((u) => (u.idUsuario === id ? { ...u, activo: false } : u)),
            );
          } else {
            this.usuarios.update((list) => list.filter((u) => u.idUsuario !== id));
            this.totalElements.update((n) => Math.max(0, n - 1));
          }
          this.busyId.set(null);
          this.feedback.set({ type: 'success', text: `${p.usuario.nombre} fue desactivado.` });
        },
        error: (err) => this.onError(err),
      });
      return;
    }

    if (p.type === 'activate') {
      this.usuarioService.activar(id).subscribe({
        next: (actualizado) => {
          this.usuarios.update((list) =>
            list.map((u) => (u.idUsuario === id ? actualizado : u)),
          );
          this.busyId.set(null);
          this.feedback.set({ type: 'success', text: `${actualizado.nombre} fue reactivado.` });
        },
        error: (err) => this.onError(err),
      });
      return;
    }

    const nuevoRol: Rol = p.type === 'promote' ? 'ADMIN' : 'USER';
    this.usuarioService.cambiarRol(id, nuevoRol).subscribe({
      next: (actualizado) => {
        this.usuarios.update((list) =>
          list.map((u) => (u.idUsuario === id ? actualizado : u)),
        );
        this.busyId.set(null);
        this.feedback.set({
          type: 'success',
          text: `${actualizado.nombre} ahora es ${actualizado.rol}.`,
        });
      },
      error: (err) => this.onError(err),
    });
  }

  private onError(err: HttpErrorResponse): void {
    this.busyId.set(null);
    this.feedback.set({
      type: 'error',
      text: this.extraerError(err) ?? 'Ocurrió un error al procesar la acción.',
    });
  }

  /** El backend devuelve {error: "..."} o, en validaciones de campos, {campo: "mensaje"}. */
  private extraerError(err: HttpErrorResponse): string | null {
    const body = err.error;
    if (!body) return null;
    if (typeof body === 'string') return body;
    if (body.error) return body.error;
    const valores = Object.values(body);
    return valores.length ? String(valores[0]) : null;
  }
}
