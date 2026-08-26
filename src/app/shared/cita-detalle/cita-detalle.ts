import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { Cita, EstadoCita, EstadoPago, formatearImporte } from '@peluqueria/core';
import { registrarOverlay } from '../overlay-stack';

/**
 * Ficha completa de una cita: el cliente con su teléfono y su email accionables (para
 * llamarle o escribirle desde el propio panel), el servicio, el peluquero y el estado.
 */
@Component({
  selector: 'app-cita-detalle',
  imports: [DatePipe],
  host: { '(document:keydown.escape)': 'alPulsarEscape()' },
  template: `
    <div
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 sm:items-center"
      (click)="cerrar.emit()"
    >
      <div
        class="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold text-main">Detalle de la cita</h2>
            <p class="mt-0.5 text-xs text-muted">#{{ cita().idCita }}</p>
          </div>
          <button
            type="button"
            (click)="cerrar.emit()"
            class="rounded-lg p-1.5 text-muted transition hover:bg-elevated hover:text-main"
            aria-label="Cerrar"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-5 px-5 py-4">
          <!-- Estado -->
          <div class="flex flex-wrap gap-2">
            <span
              class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
              [class]="estadoClass(cita().estado)"
              >{{ cita().estado }}</span
            >
            @if (cita().estadoPago; as estadoPago) {
              <span
                class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                [class]="pagoClass(estadoPago)"
                >{{ etiquetaPago() }}</span
              >
            } @else {
              <span class="inline-flex rounded-full bg-elevated px-2.5 py-0.5 text-xs font-semibold text-muted">
                Sin pago registrado
              </span>
            }
          </div>

          <!-- Cuándo -->
          <div>
            <h3 class="text-xs font-medium uppercase tracking-wide text-muted">Cuándo</h3>
            <p class="mt-1 capitalize text-main">
              {{ cita().fechaHora | date: 'EEEE d \\'de\\' MMMM \\'de\\' y' }}
            </p>
            <p class="text-sm text-muted">
              {{ cita().fechaHora | date: 'HH:mm' }} – {{ horaFin() }}
              ({{ cita().servicio.duracion }} min)
            </p>
          </div>

          <!-- Cliente -->
          <div>
            <h3 class="text-xs font-medium uppercase tracking-wide text-muted">Cliente</h3>
            <p class="mt-1 font-medium text-main">{{ cita().usuario.nombre }}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              @if (cita().usuario.telefono; as telefono) {
                <a
                  [href]="'tel:' + telefono"
                  class="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                  </svg>
                  {{ telefono }}
                </a>
              } @else {
                <span class="text-sm text-muted">Sin teléfono</span>
              }
              <a
                [href]="'mailto:' + cita().usuario.email"
                class="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-main ring-1 ring-line transition hover:bg-elevated"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                {{ cita().usuario.email }}
              </a>
            </div>
          </div>

          <!-- Servicio -->
          <div>
            <h3 class="text-xs font-medium uppercase tracking-wide text-muted">Servicio</h3>
            <div class="mt-1 flex items-baseline justify-between gap-3">
              <p class="font-medium text-main">{{ cita().servicio.nombre }}</p>
              <p class="font-semibold text-main">{{ importe(cita().servicio.precio) }} €</p>
            </div>
            @if (cita().servicio.descripcion; as descripcion) {
              <p class="mt-1 text-sm text-muted">{{ descripcion }}</p>
            }
          </div>

          <!-- Peluquero -->
          <div>
            <h3 class="text-xs font-medium uppercase tracking-wide text-muted">Peluquero</h3>
            <p class="mt-1 text-main">{{ cita().peluquero?.nombre ?? 'Sin asignar' }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CitaDetalle {
  readonly cita = input.required<Cita>();
  readonly cerrar = output<void>();

  private readonly esTope = registrarOverlay();

  /** Formato de importes, uno solo para panel y móvil. */
  protected readonly importe = formatearImporte;

  protected readonly horaFin = computed(() => {
    const c = this.cita();
    const fin = new Date(new Date(c.fechaHora).getTime() + c.servicio.duracion * 60000);
    return fin.toTimeString().slice(0, 5);
  });

  protected readonly etiquetaPago = computed(() => {
    const c = this.cita();
    const importe = formatearImporte(c.servicio.precio);
    switch (c.estadoPago) {
      case 'PENDIENTE':
        return 'Pago pendiente';
      case 'PAGADO':
        return `${importe} € pagado`;
      case 'REEMBOLSADO':
        return `${importe} € reembolsado`;
      case 'CANCELADO':
        return 'Pago cancelado';
      default:
        return c.estadoPago ?? '';
    }
  });

  protected alPulsarEscape(): void {
    if (this.esTope()) this.cerrar.emit();
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

  protected pagoClass(estado: EstadoPago): string {
    switch (estado) {
      case 'PAGADO':
        return 'bg-success/15 text-success';
      case 'PENDIENTE':
        return 'bg-warning/15 text-warning';
      default:
        return 'bg-elevated text-muted';
    }
  }
}
