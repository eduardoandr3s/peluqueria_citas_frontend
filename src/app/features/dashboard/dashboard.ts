import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Cita, EstadoCita } from '../../core/models/cita.model';
import { CitaService } from '../../core/services/cita.service';
import { ServicioService } from '../../core/services/servicio.service';
import { UsuarioService } from '../../core/services/usuario.service';

interface MetricCard {
  label: string;
  value: number;
  accent: string; // clases de color para el icono
  icon: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p class="text-sm text-slate-500">Resumen general de la peluquería.</p>
      </div>

      @if (error()) {
        <div class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ error() }}
        </div>
      }

      <!-- Tarjetas de métricas -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @for (m of metrics(); track m.label) {
          <div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-slate-500">{{ m.label }}</span>
              <span class="flex h-9 w-9 items-center justify-center rounded-lg" [class]="m.accent">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="m.icon" />
                </svg>
              </span>
            </div>
            <p class="mt-3 text-3xl font-bold text-slate-800">
              @if (loading()) {
                <span class="inline-block h-8 w-12 animate-pulse rounded bg-slate-200"></span>
              } @else {
                {{ m.value }}
              }
            </p>
          </div>
        }
      </div>

      <!-- Próximas citas -->
      <div class="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 class="font-semibold text-slate-800">Próximas citas</h2>
          <a routerLink="/citas" class="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >Ver todas →</a
          >
        </div>

        @if (loading()) {
          <div class="p-5 text-sm text-slate-400">Cargando…</div>
        } @else if (proximasCitas().length === 0) {
          <div class="p-8 text-center text-sm text-slate-400">No hay próximas citas.</div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th class="px-5 py-3 font-medium">Cliente</th>
                  <th class="px-5 py-3 font-medium">Servicio</th>
                  <th class="px-5 py-3 font-medium">Fecha y hora</th>
                  <th class="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (cita of proximasCitas(); track cita.idCita) {
                  <tr class="hover:bg-slate-50">
                    <td class="px-5 py-3 font-medium text-slate-700">{{ cita.usuario.nombre }}</td>
                    <td class="px-5 py-3 text-slate-600">{{ cita.servicio.nombre }}</td>
                    <td class="px-5 py-3 text-slate-600">
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
    </div>
  `,
})
export class Dashboard implements OnInit {
  private readonly citaService = inject(CitaService);
  private readonly servicioService = inject(ServicioService);
  private readonly usuarioService = inject(UsuarioService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

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
        accent: 'bg-indigo-100 text-indigo-600',
        icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0V11.25A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
      },
      {
        label: 'Citas pendientes',
        value: citas.filter((c) => c.estado === 'PENDIENTE').length,
        accent: 'bg-amber-100 text-amber-600',
        icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
      },
      {
        label: 'Servicios activos',
        value: this.totalServicios(),
        accent: 'bg-emerald-100 text-emerald-600',
        icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.397-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.241.437-.613.43-.992a7.723 7.723 0 0 1 0-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z',
      },
      {
        label: 'Usuarios',
        value: this.totalUsuarios(),
        accent: 'bg-sky-100 text-sky-600',
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
      usuarios: this.usuarioService.listar(),
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
  }

  protected estadoClass(estado: EstadoCita): string {
    switch (estado) {
      case 'CONFIRMADA':
        return 'bg-emerald-100 text-emerald-700';
      case 'ANULADA':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  }
}
