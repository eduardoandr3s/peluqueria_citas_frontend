import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Peluquero, PeluqueroRequest, PeluqueroService } from '@peluqueria/core';

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

@Component({
  selector: 'app-peluqueros',
  imports: [ReactiveFormsModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-main">Peluqueros</h1>
          <p class="text-sm text-muted">Profesionales de la peluquería.</p>
        </div>
        <button
          type="button"
          (click)="abrirCrear()"
          class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuevo peluquero
        </button>
      </div>

      @if (feedback(); as fb) {
        <div
          class="flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm"
          [class]="fb.type === 'success' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'"
        >
          <span>{{ fb.text }}</span>
          <button type="button" (click)="feedback.set(null)" class="font-medium hover:opacity-70">✕</button>
        </div>
      }

      <div class="rounded-xl bg-surface shadow-sm ring-1 ring-line">
        @if (loading()) {
          <div class="space-y-3 p-5">
            @for (i of [1, 2, 3, 4]; track i) {
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
        } @else if (peluqueros().length === 0) {
          <div class="p-8 text-center text-sm text-muted">
            Aún no hay peluqueros. Crea el primero con «Nuevo peluquero».
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th class="px-5 py-3 font-medium">Nombre</th>
                  <th class="px-5 py-3 font-medium">Estado</th>
                  <th class="px-5 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line">
                @for (p of peluqueros(); track p.idPeluquero) {
                  <tr class="hover:bg-elevated">
                    <td class="px-5 py-3">
                      <p class="font-medium text-main">{{ p.nombre }}</p>
                    </td>
                    <td class="px-5 py-3">
                      <span
                        class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        [class]="p.activo ? 'bg-success/15 text-success' : 'bg-error/15 text-error'"
                      >
                        {{ p.activo ? 'Activo' : 'Inactivo' }}
                      </span>
                    </td>
                    <td class="px-5 py-3">
                      <div class="flex items-center justify-end gap-2">
                        @if (busyId() === p.idPeluquero) {
                          <span class="text-xs text-muted">Procesando…</span>
                        } @else {
                          <button
                            type="button"
                            (click)="abrirEditar(p)"
                            class="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            (click)="pendingDelete.set(p)"
                            class="rounded-md px-2.5 py-1 text-xs font-medium text-error hover:bg-error/10"
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
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <form
          [formGroup]="form"
          (ngSubmit)="guardar()"
          class="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-xl"
        >
          <h2 class="text-lg font-semibold text-main">
            {{ editandoId() ? 'Editar peluquero' : 'Nuevo peluquero' }}
          </h2>

          <div class="mt-5 space-y-4">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">Nombre</label>
              <input
                type="text"
                formControlName="nombre"
                placeholder="Nombre del profesional"
                class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              @if (invalid('nombre')) {
                <p class="mt-1 text-xs text-error">El nombre es obligatorio.</p>
              }
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="cerrarForm()"
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

    <!-- Modal de confirmación de borrado -->
    @if (pendingDelete(); as p) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <div class="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-main">Eliminar peluquero</h2>
          <p class="mt-2 text-sm text-main">
            «{{ p.nombre }}» dejará de estar disponible. Es un borrado lógico (se desactiva).
          </p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="pendingDelete.set(null)"
              class="rounded-lg px-4 py-2 text-sm font-medium text-main hover:bg-elevated"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="eliminar(p)"
              class="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-error/80"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class Peluqueros implements OnInit {
  private readonly peluqueroService = inject(PeluqueroService);
  private readonly fb = inject(FormBuilder);

  protected readonly peluqueros = signal<Peluquero[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busyId = signal<number | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);

  protected readonly formOpen = signal(false);
  protected readonly editandoId = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly pendingDelete = signal<Peluquero | null>(null);

  protected readonly form = this.fb.group({
    nombre: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.peluqueroService.listar().subscribe({
      next: (data) => {
        this.peluqueros.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No se pudieron cargar los peluqueros.');
        this.loading.set(false);
      },
    });
  }

  protected invalid(control: 'nombre'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.dirty || c.touched);
  }

  protected abrirCrear(): void {
    this.feedback.set(null);
    this.editandoId.set(null);
    this.form.reset({ nombre: '' });
    this.formOpen.set(true);
  }

  protected abrirEditar(p: Peluquero): void {
    this.feedback.set(null);
    this.editandoId.set(p.idPeluquero);
    this.form.reset({ nombre: p.nombre });
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
    const payload: PeluqueroRequest = { nombre: v.nombre!.trim() };

    this.saving.set(true);
    const id = this.editandoId();

    const peticion = id
      ? this.peluqueroService.actualizar(id, payload)
      : this.peluqueroService.crear(payload);

    peticion.subscribe({
      next: (resultado) => {
        this.saving.set(false);
        this.formOpen.set(false);
        if (id) {
          this.peluqueros.update((list) =>
            list.map((p) => (p.idPeluquero === id ? resultado : p)),
          );
          this.feedback.set({ type: 'success', text: `«${resultado.nombre}» actualizado.` });
        } else {
          this.peluqueros.update((list) => [resultado, ...list]);
          this.feedback.set({ type: 'success', text: `«${resultado.nombre}» creado.` });
        }
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.feedback.set({
          type: 'error',
          text: this.extraerError(err) ?? 'No se pudo guardar el peluquero.',
        });
      },
    });
  }

  protected eliminar(p: Peluquero): void {
    const id = p.idPeluquero;
    this.pendingDelete.set(null);
    this.busyId.set(id);
    this.peluqueroService.eliminar(id).subscribe({
      next: () => {
        this.peluqueros.update((list) => list.filter((x) => x.idPeluquero !== id));
        this.busyId.set(null);
        this.feedback.set({ type: 'success', text: `«${p.nombre}» eliminado.` });
      },
      error: (err: HttpErrorResponse) => {
        this.busyId.set(null);
        this.feedback.set({
          type: 'error',
          text: this.extraerError(err) ?? 'No se pudo eliminar el peluquero.',
        });
      },
    });
  }

  private extraerError(err: HttpErrorResponse): string | null {
    const body = err.error;
    if (!body) return null;
    if (typeof body === 'string') return body;
    if (body.error) return body.error;
    const valores = Object.values(body);
    return valores.length ? String(valores[0]) : null;
  }
}
