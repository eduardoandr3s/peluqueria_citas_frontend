import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Cita, CitaRequest, CitaUpdate, EstadoCita } from '../../core/models/cita.model';
import { Servicio } from '../../core/models/servicio.model';
import { Usuario } from '../../core/models/usuario.model';
import { CitaService } from '../../core/services/cita.service';
import { ServicioService } from '../../core/services/servicio.service';
import { UsuarioService } from '../../core/services/usuario.service';

type EstadoFiltro = 'TODAS' | EstadoCita;

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

@Component({
  selector: 'app-citas',
  imports: [ReactiveFormsModule, FormsModule, DatePipe],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Citas</h1>
          <p class="text-sm text-slate-500">Agenda y gestiona el estado de las citas.</p>
        </div>
        <button
          type="button"
          (click)="abrirAgendar()"
          class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Agendar cita
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

      <!-- Filtros por estado + buscador -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap gap-2">
          @for (f of filtros; track f.value) {
            <button
              type="button"
              (click)="estadoFiltro.set(f.value)"
              class="rounded-full px-3.5 py-1.5 text-sm font-medium transition"
              [class]="estadoFiltro() === f.value ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'"
            >
              {{ f.label }}
              <span
                class="ml-1.5 rounded-full px-1.5 text-xs"
                [class]="estadoFiltro() === f.value ? 'bg-indigo-500' : 'bg-slate-100'"
                >{{ contar(f.value) }}</span
              >
            </button>
          }
        </div>
        <div class="relative max-w-xs flex-1">
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
            placeholder="Buscar por cliente o servicio…"
            class="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      </div>

      <div class="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        @if (loading()) {
          <div class="space-y-3 p-5">
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
            @if (citas().length === 0) {
              Aún no hay citas. Agenda la primera con «Agendar cita».
            } @else {
              No hay citas que coincidan con el filtro.
            }
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th class="px-5 py-3 font-medium">Cliente</th>
                  <th class="px-5 py-3 font-medium">Servicio</th>
                  <th class="px-5 py-3 font-medium">Fecha y hora</th>
                  <th class="px-5 py-3 font-medium">Estado</th>
                  <th class="px-5 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (c of filtered(); track c.idCita) {
                  <tr class="hover:bg-slate-50">
                    <td class="px-5 py-3">
                      <p class="font-medium text-slate-700">{{ c.usuario.nombre }}</p>
                      <p class="text-xs text-slate-500">{{ c.usuario.email }}</p>
                    </td>
                    <td class="px-5 py-3">
                      <p class="text-slate-700">{{ c.servicio.nombre }}</p>
                      <p class="text-xs text-slate-500">{{ c.servicio.duracion }} min</p>
                    </td>
                    <td class="px-5 py-3 text-slate-600">
                      <p>{{ c.fechaHora | date: 'EEE dd/MM/yyyy' }}</p>
                      <p class="text-xs text-slate-500">{{ c.fechaHora | date: 'HH:mm' }} – {{ horaFin(c) }}</p>
                    </td>
                    <td class="px-5 py-3">
                      <span
                        class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        [class]="estadoClass(c.estado)"
                        >{{ c.estado }}</span
                      >
                    </td>
                    <td class="px-5 py-3">
                      <div class="flex items-center justify-end gap-2">
                        @if (busyId() === c.idCita) {
                          <span class="text-xs text-slate-400">Procesando…</span>
                        } @else {
                          @if (c.estado === 'PENDIENTE') {
                            <button
                              type="button"
                              (click)="cambiarEstado(c, 'CONFIRMADA')"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50"
                            >
                              Confirmar
                            </button>
                          }
                          @if (c.estado !== 'ANULADA') {
                            <button
                              type="button"
                              (click)="abrirEditar(c)"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                            >
                              Reprogramar
                            </button>
                            <button
                              type="button"
                              (click)="pendingAnular.set(c)"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50"
                            >
                              Anular
                            </button>
                          }
                          <button
                            type="button"
                            (click)="pendingDelete.set(c)"
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

    <!-- Modal: agendar / reprogramar cita -->
    @if (formOpen()) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
        <form
          [formGroup]="form"
          (ngSubmit)="guardar()"
          class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        >
          <h2 class="text-lg font-semibold text-slate-800">
            {{ editando() ? 'Reprogramar cita' : 'Agendar cita' }}
          </h2>
          <p class="mt-1 text-xs text-slate-500">
            Horario: lunes a sábado, de 09:00 a 20:00 (la cita debe terminar antes de las 20:00).
          </p>

          @if (formError()) {
            <div class="mt-4 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {{ formError() }}
            </div>
          }

          <div class="mt-5 space-y-4">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Cliente</label>
              <select
                formControlName="usuarioId"
                class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              >
                <option [ngValue]="null" disabled>Selecciona un cliente…</option>
                @for (u of usuariosForm(); track u.idUsuario) {
                  <option [ngValue]="u.idUsuario">{{ u.nombre }} — {{ u.email }}</option>
                }
              </select>
              @if (invalid('usuarioId')) {
                <p class="mt-1 text-xs text-red-600">Selecciona un cliente.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Servicio</label>
              <select
                formControlName="servicioId"
                class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              >
                <option [ngValue]="null" disabled>Selecciona un servicio…</option>
                @for (s of serviciosForm(); track s.idServicio) {
                  <option [ngValue]="s.idServicio">{{ s.nombre }} ({{ s.duracion }} min)</option>
                }
              </select>
              @if (invalid('servicioId')) {
                <p class="mt-1 text-xs text-red-600">Selecciona un servicio.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Fecha y hora</label>
              <input
                type="datetime-local"
                formControlName="fechaHora"
                [min]="minFechaHora"
                class="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              @if (invalid('fechaHora')) {
                <p class="mt-1 text-xs text-red-600">Indica la fecha y hora.</p>
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
              @if (saving()) {
                Guardando…
              } @else {
                {{ editando() ? 'Guardar cambios' : 'Agendar' }}
              }
            </button>
          </div>
        </form>
      </div>
    }

    <!-- Modal: anular -->
    @if (pendingAnular(); as c) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-slate-800">Anular cita</h2>
          <p class="mt-2 text-sm text-slate-600">
            La cita de {{ c.usuario.nombre }} ({{ c.servicio.nombre }},
            {{ c.fechaHora | date: 'dd/MM/yyyy HH:mm' }}) pasará a estado ANULADA. El horario
            quedará libre.
          </p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="pendingAnular.set(null)"
              class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="anular(c)"
              class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              Anular cita
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: eliminar -->
    @if (pendingDelete(); as c) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-slate-800">Eliminar cita</h2>
          <p class="mt-2 text-sm text-slate-600">
            Se eliminará permanentemente la cita de {{ c.usuario.nombre }}
            ({{ c.fechaHora | date: 'dd/MM/yyyy HH:mm' }}). Esta acción no se puede deshacer.
            Si solo quieres cancelarla, usa «Anular».
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
              (click)="eliminar(c)"
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
export class Citas implements OnInit {
  private readonly citaService = inject(CitaService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly servicioService = inject(ServicioService);
  private readonly fb = inject(FormBuilder);

  protected readonly citas = signal<Cita[]>([]);
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly servicios = signal<Servicio[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly estadoFiltro = signal<EstadoFiltro>('TODAS');
  protected readonly busyId = signal<number | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);

  protected readonly formOpen = signal(false);
  protected readonly editando = signal<Cita | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly pendingAnular = signal<Cita | null>(null);
  protected readonly pendingDelete = signal<Cita | null>(null);

  protected readonly minFechaHora = this.calcularMin();

  protected readonly filtros: { value: EstadoFiltro; label: string }[] = [
    { value: 'TODAS', label: 'Todas' },
    { value: 'PENDIENTE', label: 'Pendientes' },
    { value: 'CONFIRMADA', label: 'Confirmadas' },
    { value: 'ANULADA', label: 'Anuladas' },
  ];

  protected readonly form = this.fb.group({
    usuarioId: [null as number | null, [Validators.required]],
    servicioId: [null as number | null, [Validators.required]],
    fechaHora: ['', [Validators.required]],
  });

  /** Usuarios para el select; si se reprograma una cita de un usuario desactivado, lo incluye. */
  protected readonly usuariosForm = computed<{ idUsuario: number; nombre: string; email: string }[]>(() => {
    const lista = this.usuarios();
    const e = this.editando();
    if (e && !lista.some((u) => u.idUsuario === e.usuario.idUsuario)) {
      return [e.usuario, ...lista];
    }
    return lista;
  });

  /** Servicios para el select; si se reprograma una cita de un servicio desactivado, lo incluye. */
  protected readonly serviciosForm = computed(() => {
    const lista = this.servicios();
    const e = this.editando();
    if (e && !lista.some((s) => s.idServicio === e.servicio.idServicio)) {
      return [e.servicio, ...lista];
    }
    return lista;
  });

  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const est = this.estadoFiltro();
    return this.citas()
      .filter((c) => est === 'TODAS' || c.estado === est)
      .filter(
        (c) =>
          !q ||
          c.usuario.nombre.toLowerCase().includes(q) ||
          c.servicio.nombre.toLowerCase().includes(q),
      )
      .sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime());
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      citas: this.citaService.listar(),
      usuarios: this.usuarioService.listar(),
      servicios: this.servicioService.listar(),
    }).subscribe({
      next: ({ citas, usuarios, servicios }) => {
        this.citas.set(citas);
        this.usuarios.set(usuarios);
        this.servicios.set(servicios);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No se pudieron cargar las citas.');
        this.loading.set(false);
      },
    });
  }

  protected contar(filtro: EstadoFiltro): number {
    const citas = this.citas();
    return filtro === 'TODAS' ? citas.length : citas.filter((c) => c.estado === filtro).length;
  }

  protected horaFin(c: Cita): string {
    const inicio = new Date(c.fechaHora);
    const fin = new Date(inicio.getTime() + c.servicio.duracion * 60000);
    return fin.toTimeString().slice(0, 5);
  }

  protected estadoClass(estado: EstadoCita): string {
    switch (estado) {
      case 'CONFIRMADA':
        return 'bg-emerald-100 text-emerald-700';
      case 'ANULADA':
        return 'bg-slate-200 text-slate-500';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  }

  protected invalid(control: 'usuarioId' | 'servicioId' | 'fechaHora'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.dirty || c.touched);
  }

  protected abrirAgendar(): void {
    this.feedback.set(null);
    this.formError.set(null);
    this.editando.set(null);
    this.form.reset({ usuarioId: null, servicioId: null, fechaHora: '' });
    this.formOpen.set(true);
  }

  protected abrirEditar(c: Cita): void {
    this.feedback.set(null);
    this.formError.set(null);
    this.editando.set(c);
    this.form.reset({
      usuarioId: c.usuario.idUsuario,
      servicioId: c.servicio.idServicio,
      fechaHora: c.fechaHora.slice(0, 16), // ISO LocalDateTime -> valor de datetime-local
    });
    this.formOpen.set(true);
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set(null);

    const editando = this.editando();
    if (editando) {
      const payload: CitaUpdate = {
        usuarioId: v.usuarioId!,
        servicioId: v.servicioId!,
        fechaHora: v.fechaHora!,
      };
      this.citaService.actualizar(editando.idCita, payload).subscribe({
        next: (actualizada) => {
          this.saving.set(false);
          this.formOpen.set(false);
          this.citas.update((list) =>
            list.map((x) => (x.idCita === actualizada.idCita ? actualizada : x)),
          );
          this.feedback.set({
            type: 'success',
            text: `Cita de ${actualizada.usuario.nombre} reprogramada.`,
          });
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          this.formError.set(this.extraerError(err) ?? 'No se pudo reprogramar la cita.');
        },
      });
      return;
    }

    const payload: CitaRequest = {
      usuarioId: v.usuarioId!,
      servicioId: v.servicioId!,
      fechaHora: v.fechaHora!,
    };
    this.citaService.agendar(payload).subscribe({
      next: (cita) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.citas.update((list) => [...list, cita]);
        this.feedback.set({
          type: 'success',
          text: `Cita agendada para ${cita.usuario.nombre}.`,
        });
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(this.extraerError(err) ?? 'No se pudo agendar la cita.');
      },
    });
  }

  protected cambiarEstado(c: Cita, estado: EstadoCita): void {
    const id = c.idCita;
    this.busyId.set(id);
    this.citaService.actualizar(id, { estado }).subscribe({
      next: (actualizada) => {
        this.citas.update((list) => list.map((x) => (x.idCita === id ? actualizada : x)));
        this.busyId.set(null);
        this.feedback.set({ type: 'success', text: `Cita marcada como ${estado}.` });
      },
      error: (err: HttpErrorResponse) => this.onError(err),
    });
  }

  protected anular(c: Cita): void {
    this.pendingAnular.set(null);
    this.cambiarEstado(c, 'ANULADA');
  }

  protected eliminar(c: Cita): void {
    const id = c.idCita;
    this.pendingDelete.set(null);
    this.busyId.set(id);
    this.citaService.eliminar(id).subscribe({
      next: () => {
        this.citas.update((list) => list.filter((x) => x.idCita !== id));
        this.busyId.set(null);
        this.feedback.set({ type: 'success', text: 'Cita eliminada.' });
      },
      error: (err: HttpErrorResponse) => this.onError(err),
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

  private calcularMin(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
}
