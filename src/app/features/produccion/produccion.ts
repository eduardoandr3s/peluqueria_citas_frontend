import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AuthService,
  Peluquero,
  PeluqueroService,
  Produccion,
  ProduccionPeluquero,
  ProduccionService,
  formatearEuros,
} from '@peluqueria/core';

/** Atajos de rango. El mes es la unidad en la que se liquida, así que es el de por defecto. */
type Atajo = 'mes' | 'mesAnterior' | 'anio';

@Component({
  selector: 'app-produccion',
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-main">
          {{ esAdmin() ? 'Producción' : 'Mi producción' }}
        </h1>
        <p class="text-sm text-muted">
          Servicios realizados y cobrados, con su comisión. Lo realizado y aún sin cobrar se
          muestra aparte: no suma hasta que el pago está registrado.
        </p>
      </div>

      @if (feedback(); as fb) {
        <div class="flex items-start justify-between gap-3 rounded-lg bg-error/15 px-4 py-3 text-sm text-error">
          <span>{{ fb }}</span>
          <button type="button" (click)="feedback.set(null)" class="font-medium hover:opacity-70">✕</button>
        </div>
      }

      <!-- Filtros -->
      <div class="flex flex-wrap items-end gap-3 rounded-xl bg-surface p-4 shadow-sm ring-1 ring-line">
        @if (esAdmin()) {
          <div>
            <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Peluquero
            </label>
            <select
              [ngModel]="peluqueroSeleccionado()"
              (ngModelChange)="cambiarPeluquero($event)"
              class="rounded-lg border border-line bg-base px-3 py-2 text-sm text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            >
              <option [ngValue]="null">Toda la plantilla</option>
              @for (p of peluqueros(); track p.idPeluquero) {
                <option [ngValue]="p.idPeluquero">{{ p.nombre }}</option>
              }
            </select>
          </div>
        }
        <div>
          <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Desde</label>
          <input
            type="date"
            [ngModel]="desde()"
            (ngModelChange)="desde.set($event)"
            class="rounded-lg border border-line bg-base px-3 py-2 text-sm text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Hasta</label>
          <input
            type="date"
            [ngModel]="hasta()"
            (ngModelChange)="hasta.set($event)"
            class="rounded-lg border border-line bg-base px-3 py-2 text-sm text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button
          type="button"
          (click)="cargar()"
          class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          Ver
        </button>
        <div class="flex gap-2">
          @for (a of atajos; track a.clave) {
            <button
              type="button"
              (click)="aplicarAtajo(a.clave)"
              class="rounded-lg bg-elevated px-3 py-2 text-xs font-medium text-main transition hover:bg-line"
            >
              {{ a.label }}
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="h-24 animate-pulse rounded-xl bg-elevated"></div>
          }
        </div>
      } @else if (comparativa(); as filas) {
        <!-- Vista de plantilla (solo ADMIN) -->
        <div class="rounded-xl bg-surface shadow-sm ring-1 ring-line">
          @if (filas.length === 0) {
            <p class="p-8 text-center text-sm text-muted">
              Nadie tiene servicios cobrados en este rango.
            </p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th class="px-5 py-3 font-medium">Peluquero</th>
                    <th class="px-5 py-3 text-right font-medium">Servicios</th>
                    <th class="px-5 py-3 text-right font-medium">Vendido</th>
                    <th class="px-5 py-3 text-right font-medium">Comisión</th>
                    <th class="px-5 py-3 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-line">
                  @for (f of filas; track f.idPeluquero) {
                    <tr class="hover:bg-elevated">
                      <td class="px-5 py-3 font-medium text-main">{{ f.nombre }}</td>
                      <td class="px-5 py-3 text-right text-main">{{ f.serviciosRealizados }}</td>
                      <td class="px-5 py-3 text-right font-semibold text-main">
                        {{ euros(f.importeVendido) }}
                      </td>
                      <td class="px-5 py-3 text-right text-main">{{ euros(f.comision) }}</td>
                      <td class="px-5 py-3 text-right">
                        <button
                          type="button"
                          (click)="cambiarPeluquero(f.idPeluquero)"
                          class="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot class="border-t border-line bg-elevated/50 text-sm font-semibold text-main">
                  <tr>
                    <td class="px-5 py-3">Total</td>
                    <td class="px-5 py-3 text-right">{{ totalServicios() }}</td>
                    <td class="px-5 py-3 text-right">{{ euros(totalVendido()) }}</td>
                    <td class="px-5 py-3 text-right">{{ euros(totalComision()) }}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }
        </div>
      } @else if (produccion(); as p) {
        <!-- Vista de un peluquero -->
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-xl bg-surface p-5 shadow-sm ring-1 ring-line">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">Servicios realizados</p>
            <p class="mt-2 text-3xl font-bold text-main">{{ p.serviciosRealizados }}</p>
          </div>
          <div class="rounded-xl bg-surface p-5 shadow-sm ring-1 ring-line">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">Vendido</p>
            <p class="mt-2 text-3xl font-bold text-main">{{ euros(p.importeVendido) }}</p>
          </div>
          <div class="rounded-xl bg-surface p-5 shadow-sm ring-1 ring-line">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">Comisión</p>
            <p class="mt-2 text-3xl font-bold text-primary">{{ euros(p.comision) }}</p>
          </div>
          <div
            class="rounded-xl p-5 shadow-sm ring-1"
            [class]="
              p.serviciosSinCobrar > 0
                ? 'bg-warning/10 ring-warning/40'
                : 'bg-surface ring-line'
            "
          >
            <p class="text-xs font-medium uppercase tracking-wide text-muted">Realizado sin cobrar</p>
            <p class="mt-2 text-3xl font-bold text-main">{{ euros(p.importeSinCobrar) }}</p>
            @if (p.serviciosSinCobrar > 0) {
              <p class="mt-1 text-xs text-muted">
                {{ p.serviciosSinCobrar }}
                {{ p.serviciosSinCobrar === 1 ? 'servicio' : 'servicios' }} sin pago registrado.
                No suman en la comisión.
              </p>
            }
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <div class="rounded-xl bg-surface shadow-sm ring-1 ring-line">
            <h2 class="border-b border-line px-5 py-3 text-sm font-semibold text-main">Por servicio</h2>
            @if (p.porServicio.length === 0) {
              <p class="p-6 text-center text-sm text-muted">Nada cobrado en este rango.</p>
            } @else {
              <table class="w-full text-left text-sm">
                <tbody class="divide-y divide-line">
                  @for (l of p.porServicio; track l.etiqueta) {
                    <tr>
                      <td class="px-5 py-2.5 text-main">{{ l.etiqueta }}</td>
                      <td class="px-5 py-2.5 text-right text-muted">{{ l.servicios }}</td>
                      <td class="px-5 py-2.5 text-right font-medium text-main">{{ euros(l.importe) }}</td>
                      <td class="px-5 py-2.5 text-right text-primary">{{ euros(l.comision) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>

          <div class="rounded-xl bg-surface shadow-sm ring-1 ring-line">
            <h2 class="border-b border-line px-5 py-3 text-sm font-semibold text-main">Por mes</h2>
            @if (p.porMes.length === 0) {
              <p class="p-6 text-center text-sm text-muted">Nada cobrado en este rango.</p>
            } @else {
              <table class="w-full text-left text-sm">
                <tbody class="divide-y divide-line">
                  @for (l of p.porMes; track l.etiqueta) {
                    <tr>
                      <td class="px-5 py-2.5 text-main">{{ mes(l.etiqueta) }}</td>
                      <td class="px-5 py-2.5 text-right text-muted">{{ l.servicios }}</td>
                      <td class="px-5 py-2.5 text-right font-medium text-main">{{ euros(l.importe) }}</td>
                      <td class="px-5 py-2.5 text-right text-primary">{{ euros(l.comision) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class ProduccionPagina implements OnInit {
  private readonly produccionService = inject(ProduccionService);
  private readonly peluqueroService = inject(PeluqueroService);
  private readonly auth = inject(AuthService);

  protected readonly esAdmin = this.auth.isAdmin;
  protected readonly loading = signal(true);
  protected readonly feedback = signal<string | null>(null);

  /** Una de las dos está a null: o se ve un peluquero, o se ve la plantilla. */
  protected readonly produccion = signal<Produccion | null>(null);
  protected readonly comparativa = signal<ProduccionPeluquero[] | null>(null);

  protected readonly peluqueros = signal<Peluquero[]>([]);
  /** null = toda la plantilla. Un peluquero siempre se ve a sí mismo. */
  protected readonly peluqueroSeleccionado = signal<number | null>(null);

  protected readonly desde = signal(primerDiaDelMes());
  protected readonly hasta = signal(hoy());

  protected readonly atajos: { clave: Atajo; label: string }[] = [
    { clave: 'mes', label: 'Este mes' },
    { clave: 'mesAnterior', label: 'Mes anterior' },
    { clave: 'anio', label: 'Este año' },
  ];

  protected readonly totalServicios = computed(() =>
    (this.comparativa() ?? []).reduce((suma, f) => suma + f.serviciosRealizados, 0),
  );
  protected readonly totalVendido = computed(() =>
    (this.comparativa() ?? []).reduce((suma, f) => suma + f.importeVendido, 0),
  );
  protected readonly totalComision = computed(() =>
    (this.comparativa() ?? []).reduce((suma, f) => suma + f.comision, 0),
  );

  ngOnInit(): void {
    if (this.esAdmin()) {
      this.peluqueroService.listar().subscribe({
        next: (lista) => this.peluqueros.set(lista),
        // El selector es una comodidad: sin él la comparativa sigue funcionando.
        error: () => {},
      });
    }
    this.cargar();
  }

  protected cargar(): void {
    this.loading.set(true);
    this.feedback.set(null);
    const desde = this.desde();
    const hasta = this.hasta();

    // Un peluquero solo tiene una consulta posible: la suya, y sin pasar su id (lo
    // resuelve el backend desde la cuenta).
    if (!this.esAdmin()) {
      this.produccionService.mia(desde, hasta).subscribe({
        next: (p) => this.mostrarProduccion(p),
        error: (err: HttpErrorResponse) => this.fallo(err),
      });
      return;
    }

    const id = this.peluqueroSeleccionado();
    if (id == null) {
      this.produccionService.comparativa(desde, hasta).subscribe({
        next: (filas) => {
          this.produccion.set(null);
          this.comparativa.set(filas);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => this.fallo(err),
      });
      return;
    }

    this.produccionService.dePeluquero(id, desde, hasta).subscribe({
      next: (p) => this.mostrarProduccion(p),
      error: (err: HttpErrorResponse) => this.fallo(err),
    });
  }

  protected cambiarPeluquero(id: number | null): void {
    this.peluqueroSeleccionado.set(id);
    this.cargar();
  }

  protected aplicarAtajo(atajo: Atajo): void {
    const ahora = new Date();
    if (atajo === 'mes') {
      this.desde.set(primerDiaDelMes());
      this.hasta.set(hoy());
    } else if (atajo === 'mesAnterior') {
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
      const fin = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
      this.desde.set(iso(inicio));
      this.hasta.set(iso(fin));
    } else {
      this.desde.set(iso(new Date(ahora.getFullYear(), 0, 1)));
      this.hasta.set(hoy());
    }
    this.cargar();
  }

  protected euros(valor: number): string {
    return formatearEuros(valor);
  }

  /** `2026-08` → `agosto 2026`. */
  protected mes(etiqueta: string): string {
    const [anio, mes] = etiqueta.split('-').map(Number);
    if (!anio || !mes) return etiqueta;
    const nombre = new Date(anio, mes - 1, 1).toLocaleDateString('es-ES', { month: 'long' });
    return `${nombre} ${anio}`;
  }

  private mostrarProduccion(p: Produccion): void {
    this.comparativa.set(null);
    this.produccion.set(p);
    this.loading.set(false);
  }

  private fallo(err: HttpErrorResponse): void {
    this.loading.set(false);
    this.produccion.set(null);
    this.comparativa.set(null);
    // El 404 propio tiene un mensaje que sirve tal cual: la cuenta no tiene ficha.
    const body = err.error;
    const mensaje =
      typeof body === 'string' ? body : (body?.error ?? body?.message ?? null);
    this.feedback.set(mensaje ?? 'No se pudo cargar la producción.');
  }
}

function iso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function hoy(): string {
  return iso(new Date());
}

function primerDiaDelMes(): string {
  const ahora = new Date();
  return iso(new Date(ahora.getFullYear(), ahora.getMonth(), 1));
}
