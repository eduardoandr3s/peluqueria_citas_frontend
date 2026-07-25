import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  Cita, EstadoCita, CitaService, PagoResponse, PagoService, Servicio, ServicioService,
  Usuario, UsuarioService, EstadisticasService, EstadisticasResponse,
} from '@peluqueria/core';
import { CitaDetalle } from '../../shared/cita-detalle/cita-detalle';
import { ListaModal } from '../../shared/lista-modal/lista-modal';

interface MetricCard {
  label: string;
  value: number;
  accent: string; // clases de color para el icono
  icon: string;
  /** Lista que se abre al pulsar la tarjeta. */
  abrir: () => void;
}

interface Rango {
  desde: string; // ISO YYYY-MM-DD, inclusive
  hasta: string; // ISO YYYY-MM-DD, inclusive
}

/**
 * Modal de lista abierto. Cada variante lleva sus propios elementos porque la fila se
 * pinta distinta en cada caso; `tipo` es lo que decide qué plantilla usa la vista.
 */
type ModalLista =
  | { tipo: 'citas'; titulo: string; subtitulo: string; citas: Cita[] }
  | { tipo: 'servicios'; titulo: string; subtitulo: string; servicios: Servicio[] }
  | { tipo: 'usuarios'; titulo: string; subtitulo: string; usuarios: Usuario[] }
  | { tipo: 'pagos'; titulo: string; subtitulo: string; pagos: PagoResponse[] };

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, DecimalPipe, ListaModal, CitaDetalle],
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
          <button
            type="button"
            (click)="m.abrir()"
            [disabled]="loading()"
            class="rounded-xl bg-surface p-5 text-left shadow-sm ring-1 ring-line transition hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default disabled:hover:ring-line"
          >
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
          </button>
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
                  <tr
                    tabindex="0"
                    (click)="citaDetalle.set(cita)"
                    (keydown.enter)="citaDetalle.set(cita)"
                    (keydown.space)="$event.preventDefault(); citaDetalle.set(cita)"
                    class="cursor-pointer hover:bg-elevated focus-visible:bg-elevated focus-visible:outline-none"
                    [attr.aria-label]="'Ver detalle de la cita de ' + cita.usuario.nombre"
                  >
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
                    <button
                      type="button"
                      (click)="abrirCitasPorEstado(item.estado)"
                      class="w-full rounded-lg px-1 py-0.5 text-left transition hover:bg-elevated"
                    >
                      <div class="flex items-center justify-between text-sm">
                        <span class="text-main">{{ item.estado }}</span>
                        <span class="font-semibold text-main">{{ item.total }}</span>
                      </div>
                      <div class="mt-1 h-2 w-full rounded-full bg-elevated">
                        <div
                          class="h-2 rounded-full"
                          [style.width.%]="barWidth(item.total, totalCitas())"
                          [class.bg-success]="item.estado === 'CONFIRMADA'"
                          [class.bg-warning]="item.estado === 'PENDIENTE'"
                          [class.bg-error]="item.estado === 'ANULADA'"
                        ></div>
                      </div>
                    </button>
                  }
                </div>
              </div>
              <div>
                <h3 class="mb-2 text-sm font-medium text-muted">Ingresos</h3>
                <button
                  type="button"
                  (click)="abrirIngresos()"
                  class="rounded-lg px-1 text-left text-2xl font-bold text-main transition hover:bg-elevated"
                >
                  {{ ingresosTotal() | number:'1.2-2' }} €
                </button>
                <div class="mt-3 space-y-2">
                  @for (entry of ingresosPorMetodo(); track entry[0]) {
                    <button
                      type="button"
                      (click)="abrirIngresos(entry[0])"
                      class="w-full rounded-lg px-1 py-0.5 text-left transition hover:bg-elevated"
                    >
                      <div class="flex items-center justify-between text-sm">
                        <span class="text-muted">{{ entry[0] }}</span>
                        <span class="font-medium text-main">{{ entry[1] | number:'1.2-2' }} €</span>
                      </div>
                      <div class="mt-1 h-2 w-full rounded-full bg-elevated">
                        <div
                          class="h-2 rounded-full bg-primary"
                          [style.width.%]="barWidth(entry[1], ingresosTotal())"
                        ></div>
                      </div>
                    </button>
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
                      <button
                        type="button"
                        (click)="abrirCitasDeServicio(sv.nombre)"
                        class="w-full rounded-lg px-1 py-0.5 text-left transition hover:bg-elevated"
                      >
                        <div class="flex items-center justify-between text-sm">
                          <span class="text-main">{{ i + 1 }}. {{ sv.nombre }}</span>
                          <span class="font-medium text-main">{{ sv.total }} citas</span>
                        </div>
                        <div class="mt-1 h-2 w-full rounded-full bg-elevated">
                          <div
                            class="h-2 rounded-full bg-secondary"
                            [style.width.%]="barWidth(sv.total, maxTopServicio())"
                          ></div>
                        </div>
                      </button>
                    }
                  </div>
                }
              </div>
              <div>
                <h3 class="mb-2 text-sm font-medium text-muted">Nuevos clientes</h3>
                <button
                  type="button"
                  (click)="abrirNuevosClientes()"
                  class="rounded-lg px-1 text-left text-2xl font-bold text-main transition hover:bg-elevated"
                >
                  {{ nuevosClientesCount() }}
                </button>
                <p class="mt-1 text-xs text-muted">en el periodo seleccionado</p>
              </div>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Modales de lista. Cada tarjeta o barra abre el suyo con los datos ya cargados. -->
    @if (modal(); as m) {
      @if (m.tipo === 'citas') {
        <app-lista-modal
          [titulo]="m.titulo"
          [subtitulo]="m.subtitulo"
          [items]="m.citas"
          [filtro]="filtroCita"
          placeholder="Buscar por cliente, servicio o peluquero…"
          vacio="No hay citas en este listado."
          (cerrar)="modal.set(null)"
        >
          <ng-template #fila let-cita>
            <button
              type="button"
              (click)="citaDetalle.set(cita)"
              class="flex w-full items-center justify-between gap-3 text-left"
            >
              <span class="min-w-0">
                <span class="block truncate font-medium text-main">{{ cita.usuario.nombre }}</span>
                <span class="block truncate text-xs text-muted">
                  {{ cita.servicio.nombre }} · {{ cita.fechaHora | date: "dd/MM/yyyy 'a las' HH:mm" }}
                </span>
              </span>
              <span
                class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                [class]="estadoClass(cita.estado)"
                >{{ cita.estado }}</span
              >
            </button>
          </ng-template>
        </app-lista-modal>
      }

      @if (m.tipo === 'servicios') {
        <app-lista-modal
          [titulo]="m.titulo"
          [subtitulo]="m.subtitulo"
          [items]="m.servicios"
          [filtro]="filtroServicio"
          placeholder="Buscar por nombre o descripción…"
          vacio="No hay servicios activos."
          (cerrar)="modal.set(null)"
        >
          <ng-template #fila let-servicio>
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-medium text-main">{{ servicio.nombre }}</p>
                <p class="truncate text-xs text-muted">{{ servicio.duracion }} min</p>
              </div>
              <p class="shrink-0 font-semibold text-main">
                {{ servicio.precio | number: '1.2-2' }} €
              </p>
            </div>
          </ng-template>
        </app-lista-modal>
      }

      @if (m.tipo === 'usuarios') {
        <app-lista-modal
          [titulo]="m.titulo"
          [subtitulo]="m.subtitulo"
          [items]="m.usuarios"
          [filtro]="filtroUsuario"
          placeholder="Buscar por nombre, email o teléfono…"
          vacio="No hay usuarios."
          (cerrar)="modal.set(null)"
        >
          <ng-template #fila let-usuario>
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-medium text-main">{{ usuario.nombre }}</p>
                <p class="truncate text-xs text-muted">{{ usuario.email }}</p>
              </div>
              @if (usuario.telefono) {
                <a
                  [href]="'tel:' + usuario.telefono"
                  class="shrink-0 text-sm font-medium text-primary hover:text-primary-hover"
                  >{{ usuario.telefono }}</a
                >
              }
            </div>
          </ng-template>
        </app-lista-modal>
      }

      @if (m.tipo === 'pagos') {
        <app-lista-modal
          [titulo]="m.titulo"
          [subtitulo]="m.subtitulo"
          [items]="m.pagos"
          [filtro]="filtroPago"
          placeholder="Buscar por cliente, servicio o importe…"
          vacio="No hay pagos en este periodo."
          (cerrar)="modal.set(null)"
        >
          <ng-template #fila let-pago>
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-medium text-main">{{ clienteDePago(pago) }}</p>
                <p class="truncate text-xs text-muted">
                  {{ pago.metodoPago }} ·
                  {{ (pago.fechaPago ?? pago.fechaCreacion) | date: 'dd/MM/yyyy' }}
                </p>
              </div>
              <p class="shrink-0 font-semibold text-main">{{ pago.monto | number: '1.2-2' }} €</p>
            </div>
          </ng-template>
        </app-lista-modal>
      }
    }

    @if (citaDetalle(); as c) {
      <app-cita-detalle [cita]="c" (cerrar)="citaDetalle.set(null)" />
    }
  `,
})
export class Dashboard implements OnInit {
  private readonly citaService = inject(CitaService);
  private readonly servicioService = inject(ServicioService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly pagoService = inject(PagoService);
  private readonly estadisticasService = inject(EstadisticasService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly statsLoading = signal(false);
  protected readonly statsError = signal<string | null>(null);
  protected readonly stats = signal<EstadisticasResponse | null>(null);
  protected readonly rangoActivo = signal('30d');

  protected readonly modal = signal<ModalLista | null>(null);
  protected readonly citaDetalle = signal<Cita | null>(null);

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
  private readonly servicios = signal<Servicio[]>([]);
  private readonly usuarios = signal<Usuario[]>([]);
  /** Pagos del rango activo; se recargan junto con las estadísticas. */
  private readonly pagos = signal<PagoResponse[]>([]);
  /** Rango que se está mostrando en las estadísticas, para filtrar y etiquetar sus modales. */
  private readonly rango = signal<Rango>({ desde: '', hasta: '' });

  /** Cita de cada pago, para poder mostrar el cliente en el listado de ingresos. */
  private readonly citasPorId = computed(
    () => new Map(this.citas().map((c) => [c.idCita, c])),
  );

  private readonly serviciosActivos = computed(() => this.servicios().filter((s) => s.activo));

  protected readonly metrics = computed<MetricCard[]>(() => {
    const hoy = new Date().toDateString();
    const citas = this.citas();
    const citasHoy = citas.filter((c) => new Date(c.fechaHora).toDateString() === hoy);
    const pendientes = citas.filter((c) => c.estado === 'PENDIENTE');
    return [
      {
        label: 'Citas de hoy',
        value: citasHoy.length,
        accent: 'bg-primary/15 text-primary',
        icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0V11.25A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
        abrir: () =>
          this.abrirCitas('Citas de hoy', this.formatearDia(new Date()), this.ordenar(citasHoy)),
      },
      {
        label: 'Citas pendientes',
        value: pendientes.length,
        accent: 'bg-warning/15 text-warning',
        icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
        abrir: () =>
          this.abrirCitas('Citas pendientes', 'Sin confirmar', this.ordenar(pendientes)),
      },
      {
        label: 'Servicios activos',
        value: this.serviciosActivos().length,
        accent: 'bg-success/15 text-success',
        icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.397-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.241.437-.613.43-.992a7.723 7.723 0 0 1 0-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z',
        abrir: () =>
          this.modal.set({
            tipo: 'servicios',
            titulo: 'Servicios activos',
            subtitulo: '',
            servicios: this.serviciosActivos(),
          }),
      },
      {
        label: 'Usuarios',
        value: this.usuarios().length,
        accent: 'bg-secondary/15 text-secondary',
        icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
        abrir: () =>
          this.modal.set({
            tipo: 'usuarios',
            titulo: 'Usuarios',
            subtitulo: '',
            usuarios: this.usuarios(),
          }),
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
        this.servicios.set(servicios);
        this.usuarios.set(usuarios);
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
    this.rango.set({ desde, hasta });
    forkJoin({
      stats: this.estadisticasService.obtener(desde, hasta),
      // Los pagos del mismo rango: son los que desglosan las barras de ingresos.
      pagos: this.pagoService.listarTodos({ desde, hasta }),
    }).subscribe({
      next: ({ stats, pagos }) => {
        this.stats.set(stats);
        this.pagos.set(pagos);
        this.statsLoading.set(false);
      },
      error: () => {
        this.statsError.set('No se pudieron cargar las estadísticas.');
        this.statsLoading.set(false);
      },
    });
  }

  // ---------- Apertura de modales ----------

  private abrirCitas(titulo: string, subtitulo: string, citas: Cita[]): void {
    this.modal.set({ tipo: 'citas', titulo, subtitulo, citas });
  }

  /**
   * Citas del rango con ese estado. Se filtra por el día de la cita, igual que hace el
   * backend al calcular la estadística, para que el listado cuadre con el número.
   */
  protected abrirCitasPorEstado(estado: string): void {
    const citas = this.citasDelRango().filter((c) => c.estado === estado);
    this.abrirCitas(`Citas ${estado.toLowerCase()}s`, this.etiquetaRango(), this.ordenar(citas));
  }

  /** Citas del rango de ese servicio. Excluye las anuladas, como el top del backend. */
  protected abrirCitasDeServicio(nombre: string): void {
    const citas = this.citasDelRango().filter(
      (c) => c.servicio.nombre === nombre && c.estado !== 'ANULADA',
    );
    this.abrirCitas(nombre, this.etiquetaRango(), this.ordenar(citas));
  }

  /** Pagos cobrados del rango, opcionalmente de un solo método. */
  protected abrirIngresos(metodo?: string): void {
    const pagos = this.pagos().filter(
      (p) => p.estadoPago === 'PAGADO' && (!metodo || p.metodoPago === metodo),
    );
    this.modal.set({
      tipo: 'pagos',
      titulo: metodo ? `Ingresos · ${metodo}` : 'Ingresos',
      subtitulo: this.etiquetaRango(),
      pagos,
    });
  }

  protected abrirNuevosClientes(): void {
    const { desde, hasta } = this.rango();
    const usuarios = this.usuarios().filter(
      (u) => u.fechaRegistro && u.fechaRegistro >= desde && u.fechaRegistro <= hasta,
    );
    this.modal.set({
      tipo: 'usuarios',
      titulo: 'Nuevos clientes',
      subtitulo: this.etiquetaRango(),
      usuarios,
    });
  }

  /** Citas cuyo día cae dentro del rango activo (ambos extremos incluidos). */
  private citasDelRango(): Cita[] {
    const { desde, hasta } = this.rango();
    return this.citas().filter((c) => {
      const dia = c.fechaHora.slice(0, 10);
      return dia >= desde && dia <= hasta;
    });
  }

  private ordenar(citas: Cita[]): Cita[] {
    return [...citas].sort(
      (a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime(),
    );
  }

  // ---------- Búsqueda dentro de los modales ----------

  protected readonly filtroCita = (c: Cita, q: string): boolean =>
    c.usuario.nombre.toLowerCase().includes(q) ||
    c.usuario.email.toLowerCase().includes(q) ||
    c.servicio.nombre.toLowerCase().includes(q) ||
    (c.peluquero?.nombre.toLowerCase().includes(q) ?? false);

  protected readonly filtroServicio = (s: Servicio, q: string): boolean =>
    s.nombre.toLowerCase().includes(q) || (s.descripcion?.toLowerCase().includes(q) ?? false);

  protected readonly filtroUsuario = (u: Usuario, q: string): boolean =>
    u.nombre.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.telefono?.includes(q) ?? false);

  protected readonly filtroPago = (p: PagoResponse, q: string): boolean => {
    const cita = this.citasPorId().get(p.citaId);
    return (
      p.monto.toFixed(2).includes(q) ||
      p.metodoPago.toLowerCase().includes(q) ||
      (cita?.usuario.nombre.toLowerCase().includes(q) ?? false) ||
      (cita?.servicio.nombre.toLowerCase().includes(q) ?? false)
    );
  };

  protected clienteDePago(p: PagoResponse): string {
    const cita = this.citasPorId().get(p.citaId);
    return cita ? `${cita.usuario.nombre} · ${cita.servicio.nombre}` : `Cita #${p.citaId}`;
  }

  // ---------- Rango ----------

  private calcularRango(rango: string): Rango {
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

  private etiquetaRango(): string {
    const { desde, hasta } = this.rango();
    return `${this.invertir(desde)} – ${this.invertir(hasta)}`;
  }

  private invertir(iso: string): string {
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }

  private formatearDia(d: Date): string {
    return this.invertir(this.formatearFecha(d));
  }

  private formatearFecha(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ---------- Utilidades de presentación ----------

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
