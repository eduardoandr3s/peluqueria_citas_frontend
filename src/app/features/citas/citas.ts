import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import {
  Cita,
  CitaRequest,
  CitaUpdate,
  EstadoCita,
  Servicio,
  Usuario,
  CitaService,
  ServicioService,
  UsuarioService,
  PagoService,
  PagoResponse,
} from '@peluqueria/core';

type EstadoFiltro = 'TODAS' | EstadoCita;

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

@Component({
  selector: 'app-citas',
  imports: [ReactiveFormsModule, FormsModule, DatePipe, DecimalPipe],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-main">Citas</h1>
          <p class="text-sm text-muted">Agenda y gestiona el estado de las citas.</p>
        </div>
        <button
          type="button"
          (click)="abrirAgendar()"
          class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
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
          [class]="fb.type === 'success' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'"
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
              [class]="estadoFiltro() === f.value ? 'bg-primary text-white' : 'bg-surface text-main ring-1 ring-line hover:bg-elevated'"
            >
              {{ f.label }}
              <span
                class="ml-1.5 rounded-full px-1.5 text-xs"
                [class]="estadoFiltro() === f.value ? 'bg-primary' : 'bg-elevated'"
                >{{ contar(f.value) }}</span
              >
            </button>
          }
        </div>
        <div class="relative max-w-xs flex-1">
          <svg
            class="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-muted"
            fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
            placeholder="Buscar por cliente o servicio…"
            class="w-full rounded-lg border border-line bg-base py-2 pl-10 pr-3 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div class="rounded-xl bg-surface shadow-sm ring-1 ring-line">
        @if (loading()) {
          <div class="space-y-3 p-5">
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
        } @else if (filtered().length === 0) {
          <div class="p-8 text-center text-sm text-muted">
            @if (citas().length === 0) {
              Aún no hay citas. Agenda la primera con «Agendar cita».
            } @else {
              No hay citas que coincidan con el filtro.
            }
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th class="px-5 py-3 font-medium">Cliente</th>
                  <th class="px-5 py-3 font-medium">Servicio</th>
                  <th class="px-5 py-3 font-medium">Fecha y hora</th>
                  <th class="px-5 py-3 font-medium">Estado / Pago</th>
                  <th class="px-5 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line">
                @for (c of filtered(); track c.idCita) {
                  <tr class="hover:bg-elevated">
                    <td class="px-5 py-3">
                      <p class="font-medium text-main">{{ c.usuario.nombre }}</p>
                      <p class="text-xs text-muted">{{ c.usuario.email }}</p>
                    </td>
                    <td class="px-5 py-3">
                      <p class="text-main">{{ c.servicio.nombre }}</p>
                      <p class="text-xs text-muted">{{ c.servicio.duracion }} min</p>
                    </td>
                    <td class="px-5 py-3 text-main">
                      <p>{{ c.fechaHora | date: 'EEE dd/MM/yyyy' }}</p>
                      <p class="text-xs text-muted">{{ c.fechaHora | date: 'HH:mm' }} – {{ horaFin(c) }}</p>
                    </td>
                    <td class="px-5 py-3">
                      <div class="flex flex-col gap-1">
                        <span
                          class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          [class]="estadoClass(c.estado)"
                          >{{ c.estado }}</span
                        >
                        @if (pagos()[c.idCita]; as pago) {
                          <span
                            class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            [class]="pagoClass(pago.estadoPago)"
                            >{{ labelPago(pago) }}</span
                          >
                        }
                      </div>
                    </td>
                    <td class="px-5 py-3">
                      <div class="flex items-center justify-end gap-2">
                        @if (busyId() === c.idCita) {
                          <span class="text-xs text-muted">Procesando…</span>
                        } @else {
                          @if (c.estado === 'PENDIENTE') {
                            <button
                              type="button"
                              (click)="cambiarEstado(c, 'CONFIRMADA')"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-success hover:bg-success/10"
                            >
                              Confirmar
                            </button>
                          }
                          @if (c.estado !== 'ANULADA') {
                            @if (puedePagoManual(c)) {
                              <button
                                type="button"
                                (click)="abrirPagoManual(c)"
                                class="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                              >
                                Pago manual
                              </button>
                            }
                            @if (puedeReembolsar(c)) {
                              <button
                                type="button"
                                (click)="pendingReembolso.set(c)"
                                class="rounded-md px-2.5 py-1 text-xs font-medium text-error hover:bg-error/10"
                              >
                                Reembolsar
                              </button>
                            }
                            <button
                              type="button"
                              (click)="abrirEditar(c)"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                            >
                              Reprogramar
                            </button>
                            <button
                              type="button"
                              (click)="pendingAnular.set(c)"
                              class="rounded-md px-2.5 py-1 text-xs font-medium text-warning hover:bg-warning/10"
                            >
                              Anular
                            </button>
                          }
                          <button
                            type="button"
                            (click)="pendingDelete.set(c)"
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

    <!-- Modal: agendar / reprogramar cita -->
    @if (formOpen()) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <form
          [formGroup]="form"
          (ngSubmit)="guardar()"
          class="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-xl"
        >
          <h2 class="text-lg font-semibold text-main">
            {{ editando() ? 'Reprogramar cita' : 'Agendar cita' }}
          </h2>
          <p class="mt-1 text-xs text-muted">
            Horario: lunes a sábado, de 09:00 a 20:00 (la cita debe terminar antes de las 20:00).
          </p>

          @if (formError()) {
            <div class="mt-4 rounded-lg bg-error/15 px-3.5 py-2.5 text-sm text-error">
              {{ formError() }}
            </div>
          }

          <div class="mt-5 space-y-4">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">Cliente</label>
              <select
                formControlName="usuarioId"
                class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option [ngValue]="null" disabled>Selecciona un cliente…</option>
                @for (u of usuariosForm(); track u.idUsuario) {
                  <option [ngValue]="u.idUsuario">{{ u.nombre }} — {{ u.email }}</option>
                }
              </select>
              @if (invalid('usuarioId')) {
                <p class="mt-1 text-xs text-error">Selecciona un cliente.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">Servicio</label>
              <select
                formControlName="servicioId"
                (change)="onContextoSlotsCambio()"
                class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
              >
                <option [ngValue]="null" disabled>Selecciona un servicio…</option>
                @for (s of serviciosForm(); track s.idServicio) {
                  <option [ngValue]="s.idServicio">{{ s.nombre }} ({{ s.duracion }} min)</option>
                }
              </select>
              @if (invalid('servicioId')) {
                <p class="mt-1 text-xs text-error">Selecciona un servicio.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">Fecha</label>
              <input
                type="date"
                formControlName="fecha"
                [min]="minFecha"
                (change)="onContextoSlotsCambio()"
                class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              @if (invalid('fecha')) {
                <p class="mt-1 text-xs text-error">Indica la fecha.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">Hora</label>
              @if (!form.controls.servicioId.value || !form.controls.fecha.value) {
                <p class="text-xs text-muted">Elige servicio y fecha para ver las horas libres.</p>
              } @else if (slotsLoading()) {
                <p class="text-xs text-muted">Cargando horas libres…</p>
              } @else if (slotsError()) {
                <p class="text-xs text-error">{{ slotsError() }}</p>
              } @else if (slotsMostrados().length === 0) {
                <p class="text-xs text-muted">
                  No hay horas libres ese día (puede estar completo o cerrado).
                </p>
              } @else {
                <div class="flex flex-wrap gap-2">
                  @for (s of slotsMostrados(); track s) {
                    <button
                      type="button"
                      (click)="seleccionarHora(s)"
                      class="rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition"
                      [class]="
                        form.controls.hora.value === s
                          ? 'bg-primary text-white ring-primary'
                          : 'bg-surface text-main ring-line hover:bg-elevated'
                      "
                    >
                      {{ s }}@if (esHoraActual(s)) {
                        <span class="ml-1 text-xs opacity-70">(actual)</span>
                      }
                    </button>
                  }
                </div>
              }
              @if (invalid('hora')) {
                <p class="mt-1 text-xs text-error">Selecciona una hora.</p>
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

    <!-- Modal: pago manual -->
    @if (pendingPagoManual(); as c) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <div class="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-main">Registrar pago manual</h2>
          <p class="mt-2 text-sm text-main">
            Cita de {{ c.usuario.nombre }} — {{ c.servicio.nombre }} ({{ c.servicio.precio | number:'1.2-2' }} €)
          </p>
          <div class="mt-4 space-y-3">
            <label class="mb-1.5 block text-sm font-medium text-main">Método de pago</label>
            <div class="flex gap-3">
              <button
                type="button"
                (click)="metodoPagoManual.set('EFECTIVO')"
                class="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition"
                [class]="metodoPagoManual() === 'EFECTIVO' ? 'border-primary bg-primary/10 text-primary' : 'border-line text-main hover:bg-elevated'"
              >
                Efectivo
              </button>
              <button
                type="button"
                (click)="metodoPagoManual.set('TRANSFERENCIA')"
                class="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition"
                [class]="metodoPagoManual() === 'TRANSFERENCIA' ? 'border-primary bg-primary/10 text-primary' : 'border-line text-main hover:bg-elevated'"
              >
                Transferencia
              </button>
            </div>
          </div>
          @if (pagoManualError()) {
            <p class="mt-3 text-sm text-error">{{ pagoManualError() }}</p>
          }
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="cerrarPagoManual()"
              class="rounded-lg px-4 py-2 text-sm font-medium text-main hover:bg-elevated"
            >
              Cancelar
            </button>
            <button
              type="button"
              [disabled]="pagoManualSaving()"
              (click)="registrarPagoManual(c)"
              class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              @if (pagoManualSaving()) {
                Registrando…
              } @else {
                Confirmar pago
              }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: reembolsar -->
    @if (pendingReembolso(); as c) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <div class="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-main">Reembolsar pago</h2>
          <p class="mt-2 text-sm text-main">
            Se reembolsará el pago de {{ c.servicio.nombre }} ({{ c.servicio.precio | number:'1.2-2' }} €) de {{ c.usuario.nombre }}.
          </p>
          <p class="mt-2 text-sm text-warning font-medium">
            El reembolso no anula la cita; anúlala aparte si procede.
          </p>
          @if (reembolsoError()) {
            <p class="mt-3 text-sm text-error">{{ reembolsoError() }}</p>
          }
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="pendingReembolso.set(null); reembolsoError.set(null)"
              class="rounded-lg px-4 py-2 text-sm font-medium text-main hover:bg-elevated"
            >
              Cancelar
            </button>
            <button
              type="button"
              [disabled]="reembolsoSaving()"
              (click)="reembolsar(c)"
              class="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white transition hover:bg-error/80 disabled:opacity-60"
            >
              @if (reembolsoSaving()) {
                Reembolsando…
              } @else {
                Reembolsar
              }
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
  private readonly pagoService = inject(PagoService);
  private readonly fb = inject(FormBuilder);

  protected readonly citas = signal<Cita[]>([]);
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly servicios = signal<Servicio[]>([]);
  protected readonly pagos = signal<Record<number, PagoResponse | null>>({});
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

  // Pago manual
  protected readonly pendingPagoManual = signal<Cita | null>(null);
  protected readonly metodoPagoManual = signal<string>('EFECTIVO');
  protected readonly pagoManualSaving = signal(false);
  protected readonly pagoManualError = signal<string | null>(null);

  // Reembolso
  protected readonly pendingReembolso = signal<Cita | null>(null);
  protected readonly reembolsoSaving = signal(false);
  protected readonly reembolsoError = signal<string | null>(null);

  // Disponibilidad: horas libres para el servicio + fecha elegidos en el modal.
  protected readonly slots = signal<string[]>([]);
  protected readonly slotsLoading = signal(false);
  protected readonly slotsError = signal<string | null>(null);

  protected readonly minFecha = this.calcularMinFecha();

  protected readonly filtros: { value: EstadoFiltro; label: string }[] = [
    { value: 'TODAS', label: 'Todas' },
    { value: 'PENDIENTE', label: 'Pendientes' },
    { value: 'CONFIRMADA', label: 'Confirmadas' },
    { value: 'ANULADA', label: 'Anuladas' },
  ];

  protected readonly form = this.fb.group({
    usuarioId: [null as number | null, [Validators.required]],
    servicioId: [null as number | null, [Validators.required]],
    fecha: ['', [Validators.required]],
    hora: ['', [Validators.required]],
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

  /**
   * Horas a mostrar como botones: las libres del backend y, al reprogramar, también
   * la hora actual de la cita (que el backend ve como ocupada por ella misma).
   */
  protected readonly slotsMostrados = computed<string[]>(() => {
    const libres = this.slots();
    const e = this.editando();
    if (e) {
      const horaActual = e.fechaHora.slice(11, 16);
      if (!libres.includes(horaActual)) {
        return [...libres, horaActual].sort();
      }
    }
    return libres;
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
      usuarios: this.usuarioService.listarTodos(),
      servicios: this.servicioService.listar(),
    }).subscribe({
      next: ({ citas, usuarios, servicios }) => {
        this.citas.set(citas);
        this.usuarios.set(usuarios);
        this.servicios.set(servicios);
        this.loading.set(false);
        this.cargarPagos(citas);
      },
      error: () => {
        this.loadError.set('No se pudieron cargar las citas.');
        this.loading.set(false);
      },
    });
  }

  private cargarPagos(citas: Cita[]): void {
    citas
      .filter((c) => c.estado !== 'ANULADA')
      .forEach((c) => {
        this.pagoService.obtenerPorCita(c.idCita).subscribe({
          next: (pago) => {
            this.pagos.update((m) => ({ ...m, [c.idCita]: pago }));
          },
          error: () => {},
        });
      });
  }

  protected puedePagoManual(c: Cita): boolean {
    const pago = this.pagos()[c.idCita];
    return !pago || (pago.estadoPago !== 'PAGADO' && pago.estadoPago !== 'REEMBOLSADO');
  }

  protected puedeReembolsar(c: Cita): boolean {
    const pago = this.pagos()[c.idCita];
    return !!pago && pago.estadoPago === 'PAGADO';
  }

  protected abrirPagoManual(c: Cita): void {
    this.pendingPagoManual.set(c);
    this.metodoPagoManual.set('EFECTIVO');
    this.pagoManualError.set(null);
  }

  protected cerrarPagoManual(): void {
    this.pendingPagoManual.set(null);
    this.pagoManualError.set(null);
  }

  protected registrarPagoManual(c: Cita): void {
    this.pagoManualSaving.set(true);
    this.pagoManualError.set(null);
    this.pagoService.registrarManual(c.idCita, this.metodoPagoManual()).subscribe({
      next: (pago) => {
        this.pagos.update((m) => ({ ...m, [c.idCita]: pago }));
        this.citas.update((list) =>
          list.map((x) =>
            x.idCita === c.idCita ? { ...x, estado: 'CONFIRMADA' as EstadoCita } : x,
          ),
        );
        this.pagoManualSaving.set(false);
        this.pendingPagoManual.set(null);
        this.feedback.set({ type: 'success', text: 'Pago registrado y cita confirmada.' });
      },
      error: (err: HttpErrorResponse) => {
        this.pagoManualSaving.set(false);
        this.pagoManualError.set(this.extraerError(err) ?? 'No se pudo registrar el pago.');
      },
    });
  }

  protected reembolsar(c: Cita): void {
    this.reembolsoSaving.set(true);
    this.reembolsoError.set(null);
    this.pagoService.reembolsar(c.idCita).subscribe({
      next: () => {
        const pago = this.pagos()[c.idCita];
        if (pago) {
          this.pagos.update((m) => ({
            ...m,
            [c.idCita]: { ...pago, estadoPago: 'REEMBOLSADO' as const },
          }));
        }
        this.reembolsoSaving.set(false);
        this.pendingReembolso.set(null);
        this.feedback.set({ type: 'success', text: 'Pago reembolsado.' });
      },
      error: (err: HttpErrorResponse) => {
        this.reembolsoSaving.set(false);
        this.reembolsoError.set(this.extraerError(err) ?? 'No se pudo reembolsar.');
      },
    });
  }

  protected labelPago(pago: PagoResponse): string {
    switch (pago.estadoPago) {
      case 'PENDIENTE': return 'Pago pendiente';
      case 'PAGADO': return `${pago.monto.toFixed(2)} € pagado`;
      case 'REEMBOLSADO': return `${pago.monto.toFixed(2)} € reembolsado`;
      case 'CANCELADO': return 'Pago cancelado';
      default: return pago.estadoPago;
    }
  }

  protected pagoClass(estado: string): string {
    switch (estado) {
      case 'PAGADO': return 'bg-success/15 text-success';
      case 'PENDIENTE': return 'bg-warning/15 text-warning';
      case 'REEMBOLSADO': return 'bg-elevated text-muted';
      case 'CANCELADO': return 'bg-elevated text-muted';
      default: return 'bg-elevated text-muted';
    }
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
        return 'bg-success/15 text-success';
      case 'ANULADA':
        return 'bg-elevated text-muted';
      default:
        return 'bg-warning/15 text-warning';
    }
  }

  protected invalid(control: 'usuarioId' | 'servicioId' | 'fecha' | 'hora'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.dirty || c.touched);
  }

  protected abrirAgendar(): void {
    this.feedback.set(null);
    this.formError.set(null);
    this.editando.set(null);
    this.slots.set([]);
    this.slotsError.set(null);
    this.form.reset({ usuarioId: null, servicioId: null, fecha: '', hora: '' });
    this.formOpen.set(true);
  }

  protected abrirEditar(c: Cita): void {
    this.feedback.set(null);
    this.formError.set(null);
    this.slots.set([]);
    this.slotsError.set(null);
    this.editando.set(c);
    this.form.reset({
      usuarioId: c.usuario.idUsuario,
      servicioId: c.servicio.idServicio,
      fecha: c.fechaHora.slice(0, 10),
      hora: c.fechaHora.slice(11, 16),
    });
    this.formOpen.set(true);
    this.cargarSlots();
  }

  /** Recarga las horas libres y limpia la hora elegida (cambió servicio o fecha). */
  protected onContextoSlotsCambio(): void {
    this.form.controls.hora.setValue('');
    this.cargarSlots();
  }

  protected seleccionarHora(hora: string): void {
    this.form.controls.hora.setValue(hora);
    this.form.controls.hora.markAsTouched();
  }

  protected esHoraActual(hora: string): boolean {
    const e = this.editando();
    return !!e && e.fechaHora.slice(11, 16) === hora;
  }

  private cargarSlots(): void {
    const servicioId = this.form.controls.servicioId.value;
    const fecha = this.form.controls.fecha.value;
    if (!servicioId || !fecha) {
      this.slots.set([]);
      this.slotsError.set(null);
      return;
    }
    this.slotsLoading.set(true);
    this.slotsError.set(null);
    this.citaService.disponibilidad(fecha, servicioId).subscribe({
      next: (horas) => {
        this.slots.set(horas);
        this.slotsLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.slots.set([]);
        this.slotsError.set(this.extraerError(err) ?? 'No se pudieron cargar las horas libres.');
        this.slotsLoading.set(false);
      },
    });
  }

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set(null);

    const fechaHora = `${v.fecha}T${v.hora}:00`;

    const editando = this.editando();
    if (editando) {
      const payload: CitaUpdate = {
        usuarioId: v.usuarioId!,
        servicioId: v.servicioId!,
        fechaHora,
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
      fechaHora,
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

  private extraerError(err: HttpErrorResponse): string | null {
    const body = err.error;
    if (!body) return null;
    if (typeof body === 'string') return body;
    if (body.error) return body.error;
    const valores = Object.values(body);
    return valores.length ? String(valores[0]) : null;
  }

  private calcularMinFecha(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
}
