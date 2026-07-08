import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  Cita, EstadoCita, CitaService, ServicioService, UsuarioService,
  EstadisticasService, EstadisticasResponse,
} from '@peluqueria/core';

interface MetricCard {
  label: string;
  value: number;
  accent: string; // clases de color para el icono
  icon: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, DecimalPipe],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-main">Dashboard</h1>
        <p class="text-sm text-muted">Resumen general de la peluquería.</p>
      </div>

      @if (error()) {
        <div class="rounded-lg bg-error/15 px-4 py-3 text-sm text-error">
          {{ error() }}
        </div>
      }

      <!-- Tarjetas de métricas -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @for (m of metrics(); track m.label) {
          <div class="rounded-xl bg-surface p-5 shadow-sm ring-1 ring-line">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-muted">{{ m.label }}</span>
              <span class="flex h-9 w-9 items-center justify-center rounded-lg" [class]="m.accent">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="m.icon" />
                </svg>
              </span>
            </div>
            <p class="mt-3 text-3xl font-bold text-main">
              @if (loading()) {
                <span class="inline-block h-8 w-12 animate-pulse rounded bg-elevated"></span>
              } @else {
                {{ m.value }}
              }
            </p>
          </div>
        }
      </div>

      <!-- Próximas citas -->
      <div class="rounded-xl bg-surface shadow-sm ring-1 ring-line">
        <div class="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 class="font-semibold text-main">Próximas citas</h2>
          <a routerLink="/citas" class="text-sm font-medium text-primary hover:text-primary-hover"
            >Ver todas →</a
          >
        </div>

        @if (loading()) {
          <div class="p-5 text-sm text-muted">Cargando…</div>
        } @else if (proximasCitas().length === 0) {
          <div class="p-8 text-center text-sm text-muted">No hay próximas citas.</div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th class="px-5 py-3 font-medium">Cliente</th>
                  <th class="px-5 py-3 font-medium">Servicio</th>
                  <th class="px-5 py-3 font-medium">Fecha y hora</th>
                  <th class="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line">
                @for (cita of proximasCitas(); track cita.idCita) {
                  <tr class="hover:bg-elevated">
                    <td class="px-5 py-3 font-medium text-main">{{ cita.usuario.nombre }}</td>
                    <td class="px-5 py-3 text-main">{{ cita.servicio.nombre }}</td>
                    <td class="px-5 py-3 text-main">
                      {{ cita.fechaHora | date: "dd/MM/yyyy 'a las' HH:mm" }}
                    </td>
                    <td class="px-5 py-3">
                      <span
                        class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                        [class]="estadoClass(cita.estado)"
                        >{{ cita.estado }}</span
                      >
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- Estadísticas de negocio -->
      <div class="rounded-xl bg-surface shadow-sm ring-1 ring-line">
        <div class="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 class="font-semibold text-main">Estadísticas de negocio</h2>
          <div class="flex gap-2">
            @for (opt of rangoOptions; track opt.value) {
              <button
                (click)="seleccionarRango(opt.value)"
                class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                [class.bg-primary]="rangoActivo() === opt.value"
                [class.text-white]="rangoActivo() === opt.value"
                [class.bg-elevated]="rangoActivo() !== opt.value"
                [class.text-main]="rangoActivo() !== opt.value"
                [class.hover:bg-line]="rangoActivo() !== opt.value"
              >
                {{ opt.label }}
              </button>
            }
          </div>
        </div>

        @if (statsLoading()) {
          <div class="p-5 text-sm text-muted">Cargando estadísticas…</div>
        } @else if (statsError()) {
          <div class="rounded-lg bg-error/15 px-5 py-4 text-sm text-error">
            {{ statsError() }}
          </div>
        } @else {
          <div class="space-y-5 p-5">
            <!-- Citas por estado + ingresos -->
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h3 class="mb-2 text-sm font-medium text-muted">Citas por estado</h3>
                <div class="space-y-2">
                  @for (item of citasPorEstado(); track item.estado) {
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-main">{{ item.estado }}</span>
                      <span class="font-semibold text-main">{{ item.total }}</span>
                    </div>
                    <div class="h-2 w-full rounded-full bg-elevated">
                      <div
                        class="h-2 rounded-full"
                        [style.width.%]="barWidth(item.total, totalCitas())"
                        [class.bg-success]="item.estado === 'CONFIRMADA'"
                        [class.bg-warning]="item.estado === 'PENDIENTE'"
                        [class.bg-error]="item.estado === 'ANULADA'"
                      ></div>
                    </div>
                  }
                </div>
              </div>
              <div>
                <h3 class="mb-2 text-sm font-medium text-muted">Ingresos</h3>
                <p class="text-2xl font-bold text-main">
                  {{ ingresosTotal() | number:'1.2-2' }} €
                </p>
                <div class="mt-3 space-y-2">
                  @for (entry of ingresosPorMetodo(); track entry[0]) {
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-muted">{{ entry[0] }}</span>
                      <span class="font-medium text-main">{{ entry[1] | number:'1.2-2' }} €</span>
                    </div>
                    <div class="h-2 w-full rounded-full bg-elevated">
                      <div
                        class="h-2 rounded-full bg-primary"
                        [style.width.%]="barWidth(entry[1], ingresosTotal())"
                      ></div>
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Top servicios + nuevos clientes -->
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h3 class="mb-2 text-sm font-medium text-muted">Servicios más demandados</h3>
                @if (topServiciosList().length === 0) {
                  <p class="text-sm text-muted">Sin datos en este periodo.</p>
                } @else {
                  <div class="space-y-2">
                    @for (sv of topServiciosList(); track sv.nombre; let i = $index) {
                      <div class="flex items-center justify-between text-sm">
                        <span class="text-main">{{ i + 1 }}. {{ sv.nombre }}</span>
                        <span class="font-medium text-main">{{ sv.total }} citas</span>
                      </div>
                      <div class="h-2 w-full rounded-full bg-elevated">
                        <div
                          class="h-2 rounded-full bg-secondary"
                          [style.width.%]="barWidth(sv.total, maxTopServicio())"
                        ></div>
                      </div>
                    }
                  </div>
                }
              </div>
              <div>
                <h3 class="mb-2 text-sm font-medium text-muted">Nuevos clientes</h3>
                <p class="text-2xl font-bold text-main">{{ nuevosClientesCount() }}</p>
                <p class="mt-1 text-xs text-muted">en el periodo seleccionado</p>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class Dashboard implements OnInit {
  private readonly citaService = inject(CitaService);
  private readonly servicioService = inject(ServicioService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly estadisticasService = inject(EstadisticasService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly statsLoading = signal(false);
  protected readonly statsError = signal<string | null>(null);
  protected readonly stats = signal<EstadisticasResponse | null>(null);
  protected readonly rangoActivo = signal('30d');

  protected readonly citasPorEstado = computed(() => this.stats()?.citasPorEstado ?? []);
  protected readonly ingresosTotal = computed(() => this.stats()?.ingresos?.total ?? 0);
  protected readonly topServiciosList = computed(() => this.stats()?.topServicios ?? []);
  protected readonly nuevosClientesCount = computed(() => this.stats()?.nuevosClientes ?? 0);

  readonly rangoOptions = [
    { label: 'Este mes', value: 'mes' },
    { label: '30 días', value: '30d' },
    { label: 'Este año', value: 'ano' },
  ];

  private readonly citas = signal<Cita[]>([]);
  private readonly totalServicios = signal(0);
  private readonly totalUsuarios = signal(0);

  protected readonly metrics = computed<MetricCard[]>(() => {
    const hoy = new Date().toDateString();
    const citas = this.citas();
    return [
      {
        label: 'Citas de hoy',
        value: citas.filter((c) => new Date(c.fechaHora).toDateString() === hoy).length,
        accent: 'bg-primary/15 text-primary',
        icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0V11.25A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
      },
      {
        label: 'Citas pendientes',
        value: citas.filter((c) => c.estado === 'PENDIENTE').length,
        accent: 'bg-warning/15 text-warning',
        icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
      },
      {
        label: 'Servicios activos',
        value: this.totalServicios(),
        accent: 'bg-success/15 text-success',
        icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.397-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.241.437-.613.43-.992a7.723 7.723 0 0 1 0-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z',
      },
      {
        label: 'Usuarios',
        value: this.totalUsuarios(),
        accent: 'bg-secondary/15 text-secondary',
        icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
      },
    ];
  });

  protected readonly proximasCitas = computed(() => {
    const ahora = Date.now();
    return this.citas()
      .filter((c) => c.estado !== 'ANULADA' && new Date(c.fechaHora).getTime() >= ahora)
      .sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime())
      .slice(0, 5);
  });

  ngOnInit(): void {
    forkJoin({
      citas: this.citaService.listar(),
      servicios: this.servicioService.listar(),
      usuarios: this.usuarioService.listarTodos(),
    }).subscribe({
      next: ({ citas, servicios, usuarios }) => {
        this.citas.set(citas);
        this.totalServicios.set(servicios.filter((s) => s.activo).length);
        this.totalUsuarios.set(usuarios.length);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los datos del dashboard.');
        this.loading.set(false);
      },
    });
    this.cargarEstadisticas();
  }

  protected seleccionarRango(rango: string): void {
    this.rangoActivo.set(rango);
    this.cargarEstadisticas();
  }

  private cargarEstadisticas(): void {
    this.statsLoading.set(true);
    this.statsError.set(null);
    const { desde, hasta } = this.calcularRango(this.rangoActivo());
    this.estadisticasService.obtener(desde, hasta).subscribe({
      next: (data) => {
        this.stats.set(data);
        this.statsLoading.set(false);
      },
      error: () => {
        this.statsError.set('No se pudieron cargar las estadísticas.');
        this.statsLoading.set(false);
      },
    });
  }

  private calcularRango(rango: string): { desde: string; hasta: string } {
    const hoy = new Date();
    let desde: Date;
    switch (rango) {
      case 'mes':
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        break;
      case 'ano':
        desde = new Date(hoy.getFullYear(), 0, 1);
        break;
      default: // 30d
        desde = new Date(hoy);
        desde.setDate(desde.getDate() - 30);
        break;
    }
    return {
      desde: this.formatearFecha(desde),
      hasta: this.formatearFecha(hoy),
    };
  }

  private formatearFecha(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  protected totalCitas(): number {
    return (this.stats()?.citasPorEstado ?? []).reduce((sum, c) => sum + c.total, 0);
  }

  protected ingresosPorMetodo(): [string, number][] {
    const map = this.stats()?.ingresos.porMetodoPago;
    return map ? Object.entries(map) : [];
  }

  protected maxTopServicio(): number {
    const top = this.stats()?.topServicios ?? [];
    return top.length > 0 ? Math.max(...top.map((s) => s.total)) : 1;
  }

  protected barWidth(value: number, max: number): number {
    if (max <= 0) return 0;
    return Math.round((value / max) * 100);
  }

  protected estadoClass(estado: EstadoCita): string {
    switch (estado) {
      case 'CONFIRMADA':
        return 'bg-success/15 text-success';
      case 'ANULADA':
        return 'bg-error/15 text-error';
      default:
        return 'bg-warning/15 text-warning';
    }
  }
}
