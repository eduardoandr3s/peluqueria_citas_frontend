import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Rol, Usuario } from '../../core/models/usuario.model';
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
  imports: [FormsModule, DatePipe],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Usuarios</h1>
          <p class="text-sm text-slate-500">
            Gestiona cuentas: cambia roles o desactiva usuarios.
          </p>
        </div>
        @if (!loading() && !loadError()) {
          <span class="text-sm text-slate-500">{{ filtered().length }} de {{ usuarios().length }}</span>
        }
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
                        } @else if (esYo(u)) {
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

  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly pending = signal<PendingAction | null>(null);
  protected readonly busyId = signal<number | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);

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
      text: err.error?.error ?? 'Ocurrió un error al procesar la acción.',
    });
  }
}
