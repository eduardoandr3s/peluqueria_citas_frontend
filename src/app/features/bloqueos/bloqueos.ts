import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  CitaService,
  DiaBloqueado,
  DiaBloqueadoService,
  DiaCerrado,
  hoyIso,
  sumarMeses,
} from '@peluqueria/core';
import { DatePicker } from '../../shared/date-picker/date-picker';

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

@Component({
  selector: 'app-bloqueos',
  imports: [ReactiveFormsModule, FormsModule, DatePicker],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-main">Días cerrados</h1>
          <p class="text-sm text-muted">
            Festivos y cierres puntuales. Un día bloqueado no admite citas: ni tú ni los
            clientes podréis seleccionarlo al agendar.
          </p>
        </div>
        <button
          type="button"
          (click)="abrirBloquear()"
          class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Bloquear día
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

      @if (!loading() && !loadError() && bloqueos().length > 0) {
        <div class="relative max-w-xs">
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
            placeholder="Buscar por fecha o motivo…"
            class="w-full rounded-lg border border-line bg-base py-2 pl-10 pr-3 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </div>
      }

      <div class="rounded-xl bg-surface shadow-sm ring-1 ring-line">
        @if (loading()) {
          <div class="space-y-3 p-5">
            @for (i of [1, 2, 3]; track i) {
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
        } @else if (filtrados().length === 0) {
          <div class="p-8 text-center text-sm text-muted">
            @if (bloqueos().length === 0) {
              No hay días bloqueados. Los domingos ya están cerrados de forma fija.
            } @else {
              Ningún día cerrado coincide con la búsqueda.
            }
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th class="px-5 py-3 font-medium">Fecha</th>
                  <th class="px-5 py-3 font-medium">Motivo</th>
                  <th class="px-5 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line">
                @for (d of filtrados(); track d.idDiaBloqueado) {
                  <tr class="hover:bg-elevated">
                    <td class="px-5 py-3">
                      <p class="font-medium capitalize text-main">{{ formatear(d.fecha) }}</p>
                    </td>
                    <td class="px-5 py-3 text-main">{{ d.motivo || '—' }}</td>
                    <td class="px-5 py-3">
                      <div class="flex items-center justify-end gap-2">
                        @if (busyId() === d.idDiaBloqueado) {
                          <span class="text-xs text-muted">Procesando…</span>
                        } @else {
                          <button
                            type="button"
                            (click)="pendingDelete.set(d)"
                            class="rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                          >
                            Desbloquear
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

    <!-- Modal: bloquear un día -->
    @if (formOpen()) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <form
          [formGroup]="form"
          (ngSubmit)="bloquear()"
          class="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-xl"
        >
          <h2 class="text-lg font-semibold text-main">Bloquear un día</h2>
          <p class="mt-1 text-xs text-muted">
            Elige el día que la peluquería no abrirá. Si ese día ya tiene citas, anúlalas o
            reprográmalas antes: no se anulan solas.
          </p>

          @if (formError()) {
            <div class="mt-4 rounded-lg bg-error/15 px-3.5 py-2.5 text-sm text-error">
              {{ formError() }}
            </div>
          }

          <div class="mt-5 space-y-4">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">Fecha</label>
              <app-date-picker
                formControlName="fecha"
                [min]="minFecha"
                [maxMeses]="mesesCalendario"
                [diasCerrados]="diasCerrados()"
              />
              @if (invalid('fecha')) {
                <p class="mt-1 text-xs text-error">Elige el día a bloquear.</p>
              }
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-medium text-main">
                Motivo <span class="text-muted">(opcional)</span>
              </label>
              <input
                type="text"
                formControlName="motivo"
                maxlength="200"
                placeholder="Reyes, vacaciones, formación…"
                class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <p class="mt-1 text-xs text-muted">Se le muestra al cliente en el calendario.</p>
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
              {{ saving() ? 'Bloqueando…' : 'Bloquear' }}
            </button>
          </div>
        </form>
      </div>
    }

    <!-- Modal: confirmar desbloqueo -->
    @if (pendingDelete(); as d) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <div class="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-main">Desbloquear día</h2>
          <p class="mt-2 text-sm text-main">
            El {{ formatear(d.fecha) }} volverá a admitir citas en el horario normal.
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
              (click)="desbloquear(d)"
              class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
            >
              Desbloquear
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class Bloqueos implements OnInit {
  private readonly diaBloqueadoService = inject(DiaBloqueadoService);
  private readonly citaService = inject(CitaService);
  private readonly fb = inject(FormBuilder);

  protected readonly bloqueos = signal<DiaBloqueado[]>([]);
  /**
   * Todos los días cerrados (domingos incluidos): en el calendario del formulario salen
   * deshabilitados, porque no tiene sentido bloquear un día que ya está cerrado.
   */
  protected readonly diasCerrados = signal<DiaCerrado[]>([]);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busyId = signal<number | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);

  protected readonly search = signal('');

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly pendingDelete = signal<DiaBloqueado | null>(null);

  /** Busca por motivo y por la fecha tal como se ve en la tabla («miércoles, 06/01/2027»). */
  protected readonly filtrados = computed(() => {
    const q = this.search().trim().toLowerCase();
    const lista = this.bloqueos();
    if (!q) return lista;
    return lista.filter(
      (d) =>
        (d.motivo ?? '').toLowerCase().includes(q) ||
        this.formatear(d.fecha).toLowerCase().includes(q) ||
        d.fecha.includes(q),
    );
  });

  protected readonly mesesCalendario = 11;
  protected readonly minFecha = hoyIso();

  protected readonly form = this.fb.group({
    fecha: ['', [Validators.required]],
    motivo: [''],
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      bloqueos: this.diaBloqueadoService.listar(),
      diasCerrados: this.citaService.diasCerrados(
        this.minFecha,
        sumarMeses(this.minFecha, this.mesesCalendario),
      ),
    }).subscribe({
      next: ({ bloqueos, diasCerrados }) => {
        this.bloqueos.set(bloqueos);
        this.diasCerrados.set(diasCerrados);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No se pudieron cargar los días cerrados.');
        this.loading.set(false);
      },
    });
  }

  /**
   * «miércoles, 06/01/2027». Se formatea aquí en vez de con DatePipe porque la app no
   * registra el locale es-ES y saldrían los días de la semana en inglés.
   */
  protected formatear(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  protected invalid(control: 'fecha'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.dirty || c.touched);
  }

  protected abrirBloquear(): void {
    this.feedback.set(null);
    this.formError.set(null);
    this.form.reset({ fecha: '', motivo: '' });
    this.formOpen.set(true);
  }

  protected bloquear(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const motivo = v.motivo?.trim() || null;
    this.saving.set(true);
    this.formError.set(null);

    this.diaBloqueadoService.crear({ fecha: v.fecha!, motivo }).subscribe({
      next: (creado) => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.bloqueos.update((list) =>
          [...list, creado].sort((a, b) => a.fecha.localeCompare(b.fecha)),
        );
        // El calendario debe reflejar el cierre nuevo sin volver a pedirlo al backend.
        this.diasCerrados.update((list) => [
          ...list,
          { fecha: creado.fecha, motivo: creado.motivo ?? 'Cerrado' },
        ]);
        this.feedback.set({ type: 'success', text: `Día ${creado.fecha} bloqueado.` });
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.formError.set(this.extraerError(err) ?? 'No se pudo bloquear el día.');
      },
    });
  }

  protected desbloquear(d: DiaBloqueado): void {
    const id = d.idDiaBloqueado;
    this.pendingDelete.set(null);
    this.busyId.set(id);
    this.diaBloqueadoService.eliminar(id).subscribe({
      next: () => {
        this.bloqueos.update((list) => list.filter((x) => x.idDiaBloqueado !== id));
        this.diasCerrados.update((list) => list.filter((x) => x.fecha !== d.fecha));
        this.busyId.set(null);
        this.feedback.set({ type: 'success', text: `Día ${d.fecha} desbloqueado.` });
      },
      error: (err: HttpErrorResponse) => {
        this.busyId.set(null);
        this.feedback.set({
          type: 'error',
          text: this.extraerError(err) ?? 'No se pudo desbloquear el día.',
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
