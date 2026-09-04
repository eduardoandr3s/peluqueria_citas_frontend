import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ComisionServicio,
  PeluqueroCv,
  PeluqueroCvUpdate,
  PeluqueroGestion,
  PeluqueroRequest,
  PeluqueroService,
  Servicio,
  ServicioService,
  Usuario,
  UsuarioService,
  formatearEuros,
  redimensionarImagen,
} from '@peluqueria/core';
import { CvEditor, LADO_FOTO_CV } from '../../shared/cv-editor/cv-editor';

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

@Component({
  selector: 'app-peluqueros',
  imports: [ReactiveFormsModule, FormsModule, CvEditor],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-main">Peluqueros</h1>
          <p class="text-sm text-muted">
            Profesionales, su comisión y la cuenta con la que entran al panel.
          </p>
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

      @if (!loading() && !loadError() && peluqueros().length > 0) {
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
            placeholder="Buscar por nombre…"
            class="w-full rounded-lg border border-line bg-base py-2 pl-10 pr-3 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
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
        } @else if (filtrados().length === 0) {
          <div class="p-8 text-center text-sm text-muted">
            @if (peluqueros().length === 0) {
              Aún no hay peluqueros. Crea el primero con «Nuevo peluquero».
            } @else {
              Ningún peluquero coincide con la búsqueda.
            }
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th class="px-5 py-3 font-medium">Nombre</th>
                  <th class="px-5 py-3 font-medium">Cuenta</th>
                  <th class="px-5 py-3 text-right font-medium">Comisión</th>
                  <th class="px-5 py-3 font-medium">Estado</th>
                  <th class="px-5 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line">
                @for (p of filtrados(); track p.idPeluquero) {
                  <tr class="hover:bg-elevated">
                    <td class="px-5 py-3">
                      <p class="font-medium text-main">{{ p.nombre }}</p>
                    </td>
                    <td class="px-5 py-3">
                      @if (p.usuarioEmail) {
                        <p class="text-main">{{ p.usuarioEmail }}</p>
                      } @else {
                        <span class="text-xs text-muted">
                          Sin cuenta · agenda por él el administrador
                        </span>
                      }
                    </td>
                    <td class="px-5 py-3 text-right">
                      <span class="font-medium text-main">{{ p.comisionPorcentaje }}%</span>
                      @if (p.comisionesPorServicio.length > 0) {
                        <p class="text-xs text-muted">
                          {{ p.comisionesPorServicio.length }}
                          {{ p.comisionesPorServicio.length === 1 ? 'excepción' : 'excepciones' }}
                        </p>
                      }
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
          class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl"
        >
          <h2 class="text-lg font-semibold text-main">
            {{ editandoId() ? 'Editar peluquero' : 'Nuevo peluquero' }}
          </h2>

          <!-- Al crear solo se pide el nombre, así que no hay nada que separar en pestañas. -->
          @if (editandoId()) {
            <div class="mt-4 flex gap-1 border-b border-line">
              <button
                type="button"
                (click)="pestana.set('ficha')"
                class="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition"
                [class]="
                  pestana() === 'ficha'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-main'
                "
              >
                Ficha
              </button>
              <button
                type="button"
                (click)="pestana.set('cv')"
                class="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition"
                [class]="
                  pestana() === 'cv'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-main'
                "
              >
                CV público
              </button>
            </div>
          }

          @if (editandoId() && pestana() === 'cv') {
            <div class="mt-5">
              @if (cvEditando(); as cv) {
                <p class="mb-4 text-xs text-muted">
                  Lo que se ve en «Equipo» antes de agendar. Se guarda aparte de la ficha, con
                  su propio botón.
                </p>
                <app-cv-editor
                  [cv]="cv"
                  [guardando]="guardandoCv()"
                  [subiendoFoto]="subiendoFoto()"
                  (guardar)="guardarCv($event)"
                  (fotoElegida)="subirFoto($event)"
                  (quitarFoto)="quitarFoto()"
                />
              }
            </div>
          }

          <div class="mt-5 space-y-4" [class.hidden]="editandoId() && pestana() === 'cv'">
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

            @if (editandoId()) {
              <div>
                <label class="mb-1.5 block text-sm font-medium text-main">Comisión por defecto (%)</label>
                <input
                  type="number"
                  formControlName="comisionPorcentaje"
                  min="0"
                  max="100"
                  step="0.5"
                  class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                @if (invalid('comisionPorcentaje')) {
                  <p class="mt-1 text-xs text-error">Un porcentaje entre 0 y 100.</p>
                }
                <p class="mt-1 text-xs text-muted">
                  Se aplica a todos los servicios salvo las excepciones de abajo. El porcentaje se
                  copia en la cita al cerrarla, así que cambiarlo no toca lo ya liquidado.
                </p>
              </div>

              <div>
                <label class="mb-1.5 block text-sm font-medium text-main">
                  Orden en «Equipo»
                </label>
                <input
                  type="number"
                  formControlName="orden"
                  min="0"
                  step="1"
                  class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <p class="mt-1 text-xs text-muted">
                  Quién se presenta antes al cliente: primero el número más bajo. Va en la ficha
                  y no en el CV porque colocarse primero desplaza a los compañeros. Con varios
                  al mismo número, manda el orden alfabético.
                </p>
              </div>

              <div>
                <label class="mb-1.5 block text-sm font-medium text-main">Cuenta vinculada</label>
                <select
                  formControlName="usuarioId"
                  class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option [ngValue]="null">Sin cuenta</option>
                  @for (u of cuentasVinculables(); track u.idUsuario) {
                    <option [ngValue]="u.idUsuario">{{ u.nombre }} · {{ u.email }}</option>
                  }
                </select>
                <p class="mt-1 text-xs text-muted">
                  Solo aparecen las cuentas con rol PELUQUERO o ADMIN. Si la persona todavía es
                  cliente, cámbiale el rol en «Usuarios» y volverá a aparecer aquí.
                </p>
              </div>

              <div class="flex items-center gap-2">
                <input
                  id="peluquero-activo"
                  type="checkbox"
                  formControlName="activo"
                  class="h-4 w-4 rounded border-line text-primary focus:ring-primary/30"
                />
                <label for="peluquero-activo" class="text-sm text-main">
                  Activo (aparece al agendar)
                </label>
              </div>

              <!-- Excepciones de comisión por servicio -->
              <div class="rounded-lg border border-line p-3">
                <p class="text-sm font-medium text-main">Comisión por servicio</p>
                <p class="mt-0.5 text-xs text-muted">
                  Para lo que no comisiona igual: un tinte no es un corte. Lo que no esté aquí usa
                  el porcentaje de arriba.
                </p>

                @if (excepciones().length > 0) {
                  <div class="mt-3 space-y-2">
                    @for (e of excepciones(); track e.servicioId) {
                      <div class="flex items-center gap-2">
                        <span class="flex-1 truncate text-sm text-main">
                          {{ nombreServicio(e.servicioId) }}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          [ngModel]="e.porcentaje"
                          [ngModelOptions]="{ standalone: true }"
                          (ngModelChange)="cambiarPorcentaje(e.servicioId, $event)"
                          class="w-20 rounded-lg border border-line bg-base px-2 py-1.5 text-sm text-main outline-none focus:border-primary"
                        />
                        <span class="text-sm text-muted">%</span>
                        <button
                          type="button"
                          (click)="quitarExcepcion(e.servicioId)"
                          class="rounded-md px-2 py-1 text-xs font-medium text-error hover:bg-error/10"
                        >
                          Quitar
                        </button>
                      </div>
                    }
                  </div>
                }

                @if (serviciosDisponibles().length > 0) {
                  <div class="mt-3 flex items-center gap-2">
                    <select
                      [ngModel]="servicioAAnadir()"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="servicioAAnadir.set($event)"
                      class="flex-1 rounded-lg border border-line bg-base px-2 py-1.5 text-sm text-main outline-none focus:border-primary"
                    >
                      <option [ngValue]="null">Añadir un servicio…</option>
                      @for (s of serviciosDisponibles(); track s.idServicio) {
                        <option [ngValue]="s.idServicio">{{ s.nombre }} · {{ euros(s.precio) }}</option>
                      }
                    </select>
                    <button
                      type="button"
                      [disabled]="servicioAAnadir() === null"
                      (click)="anadirExcepcion()"
                      class="rounded-lg bg-elevated px-3 py-1.5 text-xs font-medium text-main hover:bg-line disabled:opacity-50"
                    >
                      Añadir
                    </button>
                  </div>
                }
              </div>
            }
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              (click)="cerrarForm()"
              class="rounded-lg px-4 py-2 text-sm font-medium text-main hover:bg-elevated"
            >
              {{ editandoId() && pestana() === 'cv' ? 'Cerrar' : 'Cancelar' }}
            </button>
            @if (!editandoId() || pestana() === 'ficha') {
              <button
                type="submit"
                [disabled]="saving()"
                class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
              >
                {{ saving() ? 'Guardando…' : 'Guardar' }}
              </button>
            }
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
            «{{ p.nombre }}» dejará de aparecer al agendar. Es un borrado lógico: la ficha se
            queda en la tabla como inactiva y se puede reactivar, y sus citas y su producción
            no se tocan.
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
  private readonly usuarioService = inject(UsuarioService);
  private readonly servicioService = inject(ServicioService);
  private readonly fb = inject(FormBuilder);

  // La ficha de gestión, no la lista pública: trae comisión, cuenta vinculada y también
  // las fichas inactivas, que son justo las que hay que poder reactivar.
  protected readonly peluqueros = signal<PeluqueroGestion[]>([]);
  protected readonly servicios = signal<Servicio[]>([]);
  /** Cuentas que se pueden vincular: el backend rechaza un USER, así que aquí no se ofrece. */
  protected readonly cuentasVinculables = signal<Usuario[]>([]);

  /** Excepciones que se están editando en el modal. Se envían como bloque al guardar. */
  protected readonly excepciones = signal<ComisionServicio[]>([]);
  protected readonly servicioAAnadir = signal<number | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busyId = signal<number | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);

  protected readonly search = signal('');

  protected readonly formOpen = signal(false);
  protected readonly editandoId = signal<number | null>(null);
  protected readonly saving = signal(false);

  /** Qué pestaña del modal está abierta. Al crear solo se pide el nombre, así que no aplica. */
  protected readonly pestana = signal<'ficha' | 'cv'>('ficha');
  /**
   * El CV de la ficha que se está editando. Sale de `/gestion`, que ya lo trae anidado, así
   * que abrir la pestaña no cuesta otra petición. Es su propia señal y no se lee de la tabla
   * porque la foto se sube al momento y la respuesta hay que reflejarla aquí.
   */
  protected readonly cvEditando = signal<PeluqueroCv | null>(null);
  protected readonly guardandoCv = signal(false);
  protected readonly subiendoFoto = signal(false);
  protected readonly pendingDelete = signal<PeluqueroGestion | null>(null);

  protected readonly filtrados = computed(() => {
    const q = this.search().trim().toLowerCase();
    const lista = this.peluqueros();
    return q ? lista.filter((p) => p.nombre.toLowerCase().includes(q)) : lista;
  });

  protected readonly form = this.fb.group({
    nombre: ['', [Validators.required]],
    comisionPorcentaje: [
      0,
      [Validators.required, Validators.min(0), Validators.max(100)],
    ],
    orden: [0, [Validators.min(0)]],
    usuarioId: [null as number | null],
    activo: [true],
  });

  /** Servicios que aún no tienen excepción, para el desplegable de añadir. */
  protected readonly serviciosDisponibles = computed(() => {
    const puestos = new Set(this.excepciones().map((e) => e.servicioId));
    return this.servicios().filter((s) => !puestos.has(s.idServicio));
  });

  ngOnInit(): void {
    this.cargar();
    // Las dos listas son para los desplegables del modal: si fallan, el resto de la
    // pantalla sigue funcionando y el único coste es no poder vincular o excepcionar.
    this.servicioService.listar().subscribe({
      next: (lista) => this.servicios.set(lista),
      error: () => {},
    });
    this.usuarioService.listarTodos().subscribe({
      next: (lista) => this.cuentasVinculables.set(lista.filter((u) => u.rol !== 'USER')),
      error: () => {},
    });
  }

  protected cargar(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.peluqueroService.listarParaGestion().subscribe({
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

  protected invalid(control: 'nombre' | 'comisionPorcentaje' | 'orden'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.dirty || c.touched);
  }

  protected abrirCrear(): void {
    this.feedback.set(null);
    this.editandoId.set(null);
    // Al crear solo se pide el nombre: la comisión y la cuenta se ajustan al editar, que
    // es cuando ya existe la ficha a la que vincularlas.
    this.form.reset({ nombre: '', comisionPorcentaje: 0, orden: 0, usuarioId: null, activo: true });
    this.excepciones.set([]);
    this.pestana.set('ficha');
    this.cvEditando.set(null);
    this.formOpen.set(true);
  }

  protected abrirEditar(p: PeluqueroGestion): void {
    this.feedback.set(null);
    this.editandoId.set(p.idPeluquero);
    this.form.reset({
      nombre: p.nombre,
      comisionPorcentaje: p.comisionPorcentaje ?? 0,
      orden: p.orden ?? 0,
      usuarioId: p.usuarioId ?? null,
      activo: p.activo,
    });
    this.pestana.set('ficha');
    this.cvEditando.set(p.cv);
    // Copia: se edita en el modal y solo se manda al guardar, así que cancelar no deja
    // nada a medias.
    this.excepciones.set(p.comisionesPorServicio.map((e) => ({ ...e })));
    this.servicioAAnadir.set(null);
    this.formOpen.set(true);
  }

  protected anadirExcepcion(): void {
    const servicioId = this.servicioAAnadir();
    if (servicioId == null) return;
    const porDefecto = this.form.controls.comisionPorcentaje.value ?? 0;
    this.excepciones.update((lista) => [...lista, { servicioId, porcentaje: porDefecto }]);
    this.servicioAAnadir.set(null);
  }

  protected quitarExcepcion(servicioId: number): void {
    this.excepciones.update((lista) => lista.filter((e) => e.servicioId !== servicioId));
  }

  protected cambiarPorcentaje(servicioId: number, porcentaje: number): void {
    this.excepciones.update((lista) =>
      lista.map((e) => (e.servicioId === servicioId ? { ...e, porcentaje } : e)),
    );
  }

  protected nombreServicio(servicioId: number): string {
    return (
      this.servicios().find((s) => s.idServicio === servicioId)?.nombre ??
      this.excepciones().find((e) => e.servicioId === servicioId)?.servicioNombre ??
      `Servicio ${servicioId}`
    );
  }

  protected euros(valor: number): string {
    return formatearEuros(valor);
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
    this.saving.set(true);
    const id = this.editandoId();

    if (!id) {
      const payload: PeluqueroRequest = { nombre: v.nombre!.trim() };
      this.peluqueroService.crear(payload).subscribe({
        next: (creado) => {
          this.saving.set(false);
          this.formOpen.set(false);
          this.feedback.set({ type: 'success', text: `«${creado.nombre}» creado.` });
          // Se recarga en vez de insertar la fila: `crear` devuelve la ficha pública, sin
          // comisión ni cuenta, y la tabla muestra esas columnas.
          this.cargar();
        },
        error: (err: HttpErrorResponse) => this.falloAlGuardar(err),
      });
      return;
    }

    // Dos llamadas y en este orden: la ficha primero, porque es la que puede rechazar la
    // cuenta vinculada, y así un error deja las comisiones como estaban.
    this.peluqueroService
      .actualizar(id, {
        nombre: v.nombre!.trim(),
        comisionPorcentaje: Number(v.comisionPorcentaje ?? 0),
        orden: Number(v.orden ?? 0),
        activo: v.activo ?? true,
        ...(v.usuarioId != null ? { usuarioId: v.usuarioId } : { desvincularUsuario: true }),
      })
      .subscribe({
        next: () => {
          this.peluqueroService.reemplazarComisiones(id, this.excepciones()).subscribe({
            next: () => {
              this.saving.set(false);
              this.formOpen.set(false);
              this.feedback.set({ type: 'success', text: `«${v.nombre!.trim()}» actualizado.` });
              this.cargar();
            },
            error: (err: HttpErrorResponse) => {
              // La ficha sí se guardó: decirlo evita que reintente el cambio entero.
              this.saving.set(false);
              this.feedback.set({
                type: 'error',
                text:
                  (this.extraerError(err) ?? 'No se pudieron guardar las comisiones por servicio.') +
                  ' El resto de la ficha sí se guardó.',
              });
              this.cargar();
            },
          });
        },
        error: (err: HttpErrorResponse) => this.falloAlGuardar(err),
      });
  }

  private falloAlGuardar(err: HttpErrorResponse): void {
    this.saving.set(false);
    this.feedback.set({
      type: 'error',
      text: this.extraerError(err) ?? 'No se pudo guardar el peluquero.',
    });
  }

  // ---- CV público de la ficha que se está editando ----

  protected guardarCv(cambios: PeluqueroCvUpdate): void {
    const id = this.editandoId();
    if (id == null) return;

    this.guardandoCv.set(true);
    this.peluqueroService.guardarCv(id, cambios).subscribe({
      next: (cv) => {
        this.guardandoCv.set(false);
        this.aplicarCv(id, cv);
        this.feedback.set({ type: 'success', text: `CV de «${cv.nombre}» guardado.` });
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoCv.set(false);
        this.feedback.set({
          type: 'error',
          text: this.extraerError(err) ?? 'No se pudo guardar el CV.',
        });
      },
    });
  }

  /**
   * La foto va en su propia petición (multipart) y se guarda al elegirla, no al pulsar
   * «Guardar CV»: mezclarlas obligaría a mandar la imagen otra vez cada vez que se corrige
   * una coma de la presentación.
   */
  protected async subirFoto(fichero: File): Promise<void> {
    const id = this.editandoId();
    if (id == null) return;

    this.subiendoFoto.set(true);
    const reducida = await redimensionarImagen(fichero, LADO_FOTO_CV);
    this.peluqueroService.subirFoto(id, reducida).subscribe({
      next: (cv) => {
        this.subiendoFoto.set(false);
        this.aplicarCv(id, cv);
      },
      error: (err: HttpErrorResponse) => {
        this.subiendoFoto.set(false);
        this.feedback.set({
          type: 'error',
          text:
            err.status === 413
              ? 'La imagen es demasiado grande.'
              : (this.extraerError(err) ?? 'No se pudo subir la foto.'),
        });
      },
    });
  }

  protected quitarFoto(): void {
    const id = this.editandoId();
    if (id == null) return;

    this.subiendoFoto.set(true);
    this.peluqueroService.borrarFoto(id).subscribe({
      next: (cv) => {
        this.subiendoFoto.set(false);
        this.aplicarCv(id, cv);
      },
      error: (err: HttpErrorResponse) => {
        this.subiendoFoto.set(false);
        this.feedback.set({
          type: 'error',
          text: this.extraerError(err) ?? 'No se pudo quitar la foto.',
        });
      },
    });
  }

  /** Refresca el editor y la fila de la tabla sin recargar la lista entera. */
  private aplicarCv(id: number, cv: PeluqueroCv): void {
    this.cvEditando.set(cv);
    this.peluqueros.update((lista) => lista.map((p) => (p.idPeluquero === id ? { ...p, cv } : p)));
  }

  protected eliminar(p: PeluqueroGestion): void {
    const id = p.idPeluquero;
    this.pendingDelete.set(null);
    this.busyId.set(id);
    this.peluqueroService.eliminar(id).subscribe({
      next: () => {
        // La ficha no desaparece de la tabla: es un borrado lógico y esta pantalla muestra
        // también las inactivas, que son las que se pueden reactivar desde «Editar».
        this.peluqueros.update((list) =>
          list.map((x) => (x.idPeluquero === id ? { ...x, activo: false } : x)),
        );
        this.busyId.set(null);
        this.feedback.set({
          type: 'success',
          text: `«${p.nombre}» desactivado. Puedes reactivarlo desde «Editar».`,
        });
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
