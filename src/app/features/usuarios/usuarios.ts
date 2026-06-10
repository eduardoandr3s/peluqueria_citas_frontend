import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Rol, Usuario, UsuarioRequest, UsuarioUpdate } from '../../core/models/usuario.model';
import { AuthService } from '../../core/services/auth.service';
import { UsuarioService } from '../../core/services/usuario.service';

type PendingType = 'promote' | 'demote' | 'deactivate';

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
          <h1 class="text-2xl font-bold text-slate-800">Usuarios</h1>
          <p class="text-sm text-slate-500">
            Gestiona cuentas: crea, edita, cambia roles o desactiva usuarios.
          </p>
        </div>
        <div class="flex items-center gap-3">
          @if (!loading() && !loadError()) {
            <span class="text-sm text-slate-500">{{ filtered().length }} de {{ usuarios().length }}</span>
          }
          <button
            type="button"
            (click)="abrirCrear()"
            class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
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
          [class]="fb.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'"
        >
          <span>{{ fb.text }}</span>
          <button type="button" (click)="feedback.set(null)" class="font-medium hover:opacity-70">✕</button>
        </div>
      }

      <!-- Buscador -->
      <div class="relative max-w-sm">
        <svg
          class="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-slate-400"
          fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          placeholder="Buscar por nombre o email…"
          class="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <div class="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        @if (loading()) {
          <div class="p-5 space-y-3">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <div class="h-10 animate-pulse rounded bg-slate-100"></div>
            }
          </div>
        } @else if (loadError()) {
          <div class="p-8 text-center">
            <p class="text-sm text-red-600">{{ loadError() }}</p>
            <button
              type="button"
              (click)="cargar()"
              class="mt-3 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Reintentar
            </button>
          </div>
        } @else if (filtered().length === 0) {
          <div class="p-8 text-center text-sm text-slate-400">
            @if (usuarios().length === 0) {
              No hay usuarios registrados.
            } @else {
              No se encontraron usuarios para «{{ search() }}».
            }
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th class="px-5 py-3 font-medium">Usuario</th>
                  <th class="px-5 py-3 font-medium">Teléfono</th>
                  <th class="px-5 py-3 font-medium">Registro</th>
                  <th class="px-5 py-3 font-medium">Rol</th>
                  <th class="px-5 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (u of filtered(); track u.idUsuario) {
                  <tr class="hover:bg-slate-50">
                    <td class="px-5 py-3">
                      <div class="flex items-center gap-3">
                        <span class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {{ iniciales(u.nombre) }}
                        </span>
                        <div class="leading-tight">
                          <p class="font-medium text-slate-700">
                            {{ u.nombre }}
                            @if (esYo(u)) {
                              <span class="ml-1 text-xs font-normal text-slate-400">(tú)</span>
                            }
                          </p>
                          <p class="text-xs text-slate-500">{{ u.email }}</p>
                        </div>
                      </div>
                    </td>
                    <td class="px-5 py-3 text-slate-600">{{ u.telefono || '—' }}</td>
                    <td class="px-5 py-3 text-slate-600">
                      {{ u.fechaRegistro ? (u.fechaRegistro | date: 'dd/MM/yyyy') : '—' }}
                    </td>
                    <td class="px-5 py-3">
                      <span
                        class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        [class]="u.rol === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'"
                        >{{ u.rol }}</span
                      >
                    </td>
                    <td class="px-5 py-3">
                      <div class="flex items-center justify-end gap-2">
                        @if (busyId() === u.idUsuario) {
                          <span class="text-xs text-slate-400">Procesando…</span>
                        } @else {
                          <button
                            type="button"
                            (click)="abrirEditar(u)"
                            class="rounded-md px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                          >
                            Editar
                          </button>
                          @if (esYo(u)) {
                            <span class="text-xs text-slate-300">Cuenta actual</span>
                          } @else {
                          @if (u.rol === 'USER') {
                            <button
                              type="button"
                              (click)="pedirConfirmacion('promote', u)"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                            >
                              Hacer admin
                            </button>
                          } @else {
                            <button
                              type="button"
                              (click)="pedirConfirmacion('demote', u)"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
                            >
                              Quitar admin
                            </button>
                          }
                          <button
                            type="button"
                            (click)="pedirConfirmacion('deactivate', u)"
                            class="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
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
    </div>

    <!-- Modal: crear / editar usuario -->
    @if (formOpen()) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
        <form
          [formGroup]="form"
          (ngSubmit)="guardar()"
          class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        >
          <h2 class="text-lg font-semibold text-slate-800">
            {{ editando() ? 'Editar usuario' : 'Nuevo usuario' }}
          </h2>
          @if (!editando()) {
            <p class="mt-1 text-xs text-slate-500">
              La cuenta se crea con rol USER; podrás cambiarle el rol desde el listado.
            </p>
          }

          @if (formError()) {
            <div class="mt-4 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {{ formError() }}
            </div>
          }

          <div class="mt-5 space-y-4">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Nombre</label>
              <input
                type="text"
                formControlName="nombre"
                placeholder="Nombre y apellidos"
                class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              @if (invalidCampo('nombre')) {
                <p class="mt-1 text-xs text-red-600">El nombre es obligatorio.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                formControlName="email"
                placeholder="cliente@email.com"
                class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              @if (invalidCampo('email')) {
                <p class="mt-1 text-xs text-red-600">Introduce un email válido.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">
                Teléfono <span class="text-slate-400">(opcional)</span>
              </label>
              <input
                type="tel"
                formControlName="telefono"
                placeholder="600123456"
                class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              @if (invalidCampo('telefono')) {
                <p class="mt-1 text-xs text-red-600">El teléfono debe tener entre 9 y 15 caracteres.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">
                {{ editando() ? 'Nueva contraseña' : 'Contraseña' }}
                @if (editando()) {
                  <span class="text-slate-400">(en blanco para no cambiarla)</span>
                }
              </label>
              <input
                type="password"
                formControlName="password"
                placeholder="Mínimo 6 caracteres"
                autocomplete="new-password"
                class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              @if (invalidCampo('password')) {
                <p class="mt-1 text-xs text-red-600">La contraseña debe tener al menos 6 caracteres.</p>
              }
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="formOpen.set(false)"
              class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              [disabled]="saving()"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {{ saving() ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </form>
      </div>
    }

    <!-- Modal de confirmación -->
    @if (pending(); as p) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-slate-800">{{ confirmTitulo(p) }}</h2>
          <p class="mt-2 text-sm text-slate-600">{{ confirmMensaje(p) }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="pending.set(null)"
              class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="confirmar(p)"
              class="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              [class]="p.type === 'deactivate' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'"
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

  protected readonly formOpen = signal(false);
  protected readonly editando = signal<Usuario | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    nombre: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.minLength(9), Validators.maxLength(15)]],
    password: [''],
  });

  private readonly miEmail = computed(() => this.auth.user()?.email ?? null);

  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const lista = this.usuarios();
    if (!q) return lista;
    return lista.filter(
      (u) => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.usuarioService.listar().subscribe({
      next: (data) => {
        this.usuarios.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No se pudieron cargar los usuarios.');
        this.loading.set(false);
      },
    });
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
    this.editando.set(null);
    this.form.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.reset({ nombre: '', email: '', telefono: '', password: '' });
    this.formOpen.set(true);
  }

  protected abrirEditar(u: Usuario): void {
    this.feedback.set(null);
    this.formError.set(null);
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
        this.usuarios.update((list) => [creado, ...list]);
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
    }
  }

  protected confirmAccion(p: PendingAction): string {
    return p.type === 'deactivate' ? 'Desactivar' : 'Confirmar';
  }

  protected confirmar(p: PendingAction): void {
    const id = p.usuario.idUsuario;
    this.pending.set(null);
    this.busyId.set(id);

    if (p.type === 'deactivate') {
      this.usuarioService.eliminar(id).subscribe({
        next: () => {
          this.usuarios.update((list) => list.filter((u) => u.idUsuario !== id));
          this.busyId.set(null);
          this.feedback.set({ type: 'success', text: `${p.usuario.nombre} fue desactivado.` });
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
