import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Servicio, ServicioRequest } from '../../core/models/servicio.model';
import { ServicioService } from '../../core/services/servicio.service';

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

@Component({
  selector: 'app-servicios',
  imports: [ReactiveFormsModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Servicios</h1>
          <p class="text-sm text-slate-500">Catálogo de servicios de la peluquería.</p>
        </div>
        <button
          type="button"
          (click)="abrirCrear()"
          class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo servicio
        </button>
      </div>

      @if (feedback(); as fb) {
        <div
          class="flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm"
          [class]="fb.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'"
        >
          <span>{{ fb.text }}</span>
          <button type="button" (click)="feedback.set(null)" class="font-medium hover:opacity-70">✕</button>
        </div>
      }

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
          placeholder="Buscar servicio…"
          class="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <div class="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        @if (loading()) {
          <div class="space-y-3 p-5">
            @for (i of [1, 2, 3, 4]; track i) {
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
            @if (servicios().length === 0) {
              Aún no hay servicios. Crea el primero con «Nuevo servicio».
            } @else {
              No se encontraron servicios para «{{ search() }}».
            }
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th class="px-5 py-3 font-medium">Servicio</th>
                  <th class="px-5 py-3 font-medium">Precio</th>
                  <th class="px-5 py-3 font-medium">Duración</th>
                  <th class="px-5 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (s of filtered(); track s.idServicio) {
                  <tr class="hover:bg-slate-50">
                    <td class="px-5 py-3">
                      <p class="font-medium text-slate-700">{{ s.nombre }}</p>
                      @if (s.descripcion) {
                        <p class="max-w-md truncate text-xs text-slate-500">{{ s.descripcion }}</p>
                      }
                    </td>
                    <td class="px-5 py-3 font-medium text-slate-700">{{ formatPrecio(s.precio) }}</td>
                    <td class="px-5 py-3 text-slate-600">{{ s.duracion }} min</td>
                    <td class="px-5 py-3">
                      <div class="flex items-center justify-end gap-2">
                        @if (busyId() === s.idServicio) {
                          <span class="text-xs text-slate-400">Procesando…</span>
                        } @else {
                          <button
                            type="button"
                            (click)="abrirEditar(s)"
                            class="rounded-md px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            (click)="pendingDelete.set(s)"
                            class="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Eliminar
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

    <!-- Modal de formulario (crear / editar) -->
    @if (formOpen()) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
        <form
          [formGroup]="form"
          (ngSubmit)="guardar()"
          class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        >
          <h2 class="text-lg font-semibold text-slate-800">
            {{ editandoId() ? 'Editar servicio' : 'Nuevo servicio' }}
          </h2>

          <div class="mt-5 space-y-4">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Nombre</label>
              <input
                type="text"
                formControlName="nombre"
                placeholder="Corte de cabello"
                class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              @if (invalid('nombre')) {
                <p class="mt-1 text-xs text-red-600">El nombre es obligatorio.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">
                Descripción <span class="text-slate-400">(opcional)</span>
              </label>
              <textarea
                formControlName="descripcion"
                rows="2"
                placeholder="Breve descripción del servicio…"
                class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              ></textarea>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="mb-1.5 block text-sm font-medium text-slate-700">Precio</label>
                <input
                  type="number"
                  formControlName="precio"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
                @if (invalid('precio')) {
                  <p class="mt-1 text-xs text-red-600">Introduce un precio mayor que 0.</p>
                }
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-medium text-slate-700">Duración (min)</label>
                <input
                  type="number"
                  formControlName="duracion"
                  min="1"
                  step="1"
                  placeholder="30"
                  class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
                @if (invalid('duracion')) {
                  <p class="mt-1 text-xs text-red-600">Introduce una duración mayor que 0.</p>
                }
              </div>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="cerrarForm()"
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

    <!-- Modal de confirmación de borrado -->
    @if (pendingDelete(); as s) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-slate-800">Eliminar servicio</h2>
          <p class="mt-2 text-sm text-slate-600">
            «{{ s.nombre }}» dejará de estar disponible. Es un borrado lógico (se desactiva).
          </p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="pendingDelete.set(null)"
              class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="eliminar(s)"
              class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class Servicios implements OnInit {
  private readonly servicioService = inject(ServicioService);
  private readonly fb = inject(FormBuilder);

  protected readonly servicios = signal<Servicio[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly busyId = signal<number | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);

  protected readonly formOpen = signal(false);
  protected readonly editandoId = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly pendingDelete = signal<Servicio | null>(null);

  protected readonly form = this.fb.group({
    nombre: ['', [Validators.required]],
    descripcion: [''],
    precio: [null as number | null, [Validators.required, Validators.min(0.01)]],
    duracion: [null as number | null, [Validators.required, Validators.min(1)]],
  });

  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const lista = this.servicios();
    if (!q) return lista;
    return lista.filter(
      (s) =>
        s.nombre.toLowerCase().includes(q) ||
        (s.descripcion?.toLowerCase().includes(q) ?? false),
    );
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.servicioService.listar().subscribe({
      next: (data) => {
        this.servicios.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No se pudieron cargar los servicios.');
        this.loading.set(false);
      },
    });
  }

  protected formatPrecio(precio: number): string {
    return `${Number(precio).toFixed(2)} €`;
  }

  protected invalid(control: 'nombre' | 'precio' | 'duracion'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.dirty || c.touched);
  }

  protected abrirCrear(): void {
    this.feedback.set(null);
    this.editandoId.set(null);
    this.form.reset({ nombre: '', descripcion: '', precio: null, duracion: null });
    this.formOpen.set(true);
  }

  protected abrirEditar(s: Servicio): void {
    this.feedback.set(null);
    this.editandoId.set(s.idServicio);
    this.form.reset({
      nombre: s.nombre,
      descripcion: s.descripcion ?? '',
      precio: s.precio,
      duracion: s.duracion,
    });
    this.formOpen.set(true);
  }

  protected cerrarForm(): void {
    this.formOpen.set(false);
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload: ServicioRequest = {
      nombre: v.nombre!.trim(),
      descripcion: v.descripcion?.trim() || undefined,
      precio: v.precio!,
      duracion: v.duracion!,
    };

    this.saving.set(true);
    const id = this.editandoId();

    const peticion = id
      ? this.servicioService.actualizar(id, payload)
      : this.servicioService.crear(payload);

    peticion.subscribe({
      next: (resultado) => {
        this.saving.set(false);
        this.formOpen.set(false);
        if (id) {
          this.servicios.update((list) =>
            list.map((s) => (s.idServicio === id ? resultado : s)),
          );
          this.feedback.set({ type: 'success', text: `«${resultado.nombre}» actualizado.` });
        } else {
          this.servicios.update((list) => [resultado, ...list]);
          this.feedback.set({ type: 'success', text: `«${resultado.nombre}» creado.` });
        }
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.feedback.set({
          type: 'error',
          text: this.extraerError(err) ?? 'No se pudo guardar el servicio.',
        });
      },
    });
  }

  protected eliminar(s: Servicio): void {
    const id = s.idServicio;
    this.pendingDelete.set(null);
    this.busyId.set(id);
    this.servicioService.eliminar(id).subscribe({
      next: () => {
        this.servicios.update((list) => list.filter((x) => x.idServicio !== id));
        this.busyId.set(null);
        this.feedback.set({ type: 'success', text: `«${s.nombre}» eliminado.` });
      },
      error: (err: HttpErrorResponse) => {
        this.busyId.set(null);
        this.feedback.set({
          type: 'error',
          text: this.extraerError(err) ?? 'No se pudo eliminar el servicio.',
        });
      },
    });
  }

  /** El backend devuelve {error: "..."} o, en validaciones, {campo: "mensaje"}. */
  private extraerError(err: HttpErrorResponse): string | null {
    const body = err.error;
    if (!body) return null;
    if (typeof body === 'string') return body;
    if (body.error) return body.error;
    const valores = Object.values(body);
    return valores.length ? String(valores[0]) : null;
  }
}
