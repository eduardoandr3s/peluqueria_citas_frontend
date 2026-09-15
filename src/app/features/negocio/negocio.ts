import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActualizarNegocio,
  DIAS_SEMANA,
  DiaSemana,
  NOMBRE_DIA,
  Negocio as FichaNegocio,
  NegocioService,
} from '@peluqueria/core';

/**
 * Los datos de la peluquería: cómo se llama, cómo se la localiza, qué aspecto tiene y a qué
 * horas abre.
 *
 * Esta pantalla es la mitad de lo que hace falta para instalarle el producto a otra
 * peluquería. Hasta que existió, el horario estaba en las properties del backend y el
 * nombre y el teléfono escritos en el código del móvil: cambiarlos era editar el despliegue
 * o recompilar la app.
 */
@Component({
  selector: 'app-negocio',
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-main">El negocio</h1>
        <p class="text-sm text-muted">
          Cómo se llama esta peluquería, cómo se la localiza y cuándo abre. El nombre y el
          contacto se ven en la app del cliente; el horario decide
          <strong>qué horas se ofrecen al agendar</strong>.
        </p>
      </div>

      @if (feedback(); as fb) {
        <div
          class="flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm"
          [class]="fb.error ? 'bg-error/15 text-error' : 'bg-success/15 text-success'"
        >
          <span>{{ fb.texto }}</span>
          <button type="button" (click)="feedback.set(null)" class="font-medium hover:opacity-70">
            ✕
          </button>
        </div>
      }

      @if (cargando()) {
        <div class="rounded-xl bg-surface p-8 text-center text-sm text-muted shadow-sm ring-1 ring-line">
          Cargando…
        </div>
      } @else if (ficha(); as f) {
        <form (ngSubmit)="guardar()" class="space-y-6">
          <section class="space-y-4 rounded-xl bg-surface p-5 shadow-sm ring-1 ring-line">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">Identidad</h2>

            <label class="block">
              <span class="text-sm font-medium text-main">Nombre</span>
              <input
                name="nombre"
                [(ngModel)]="f.nombre"
                required
                maxlength="120"
                class="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            <label class="block">
              <span class="text-sm font-medium text-main">Eslogan</span>
              <input
                name="eslogan"
                [(ngModel)]="f.eslogan"
                maxlength="200"
                placeholder="Opcional"
                class="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="text-sm font-medium text-main">URL del logo</span>
                <input
                  name="logoUrl"
                  [(ngModel)]="f.logoUrl"
                  maxlength="500"
                  placeholder="Vacío: se usa el logo que trae la app"
                  class="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label class="block">
                <span class="text-sm font-medium text-main">Color de marca</span>
                <div class="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    name="colorPicker"
                    [ngModel]="f.colorPrimario || '#000000'"
                    (ngModelChange)="f.colorPrimario = $event"
                    class="h-9 w-12 cursor-pointer rounded border border-line bg-elevated"
                  />
                  <input
                    name="colorPrimario"
                    [(ngModel)]="f.colorPrimario"
                    placeholder="#RRGGBB"
                    maxlength="7"
                    class="w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </label>
            </div>
          </section>

          <section class="space-y-4 rounded-xl bg-surface p-5 shadow-sm ring-1 ring-line">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">Contacto</h2>
            <p class="text-xs text-muted">
              Es lo que ve el cliente en la app. No es el remitente de los avisos por correo:
              ese lo impone el proveedor de correo y se configura en el servidor.
            </p>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="text-sm font-medium text-main">Teléfono</span>
                <input
                  name="telefono"
                  [(ngModel)]="f.telefono"
                  maxlength="30"
                  class="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label class="block">
                <span class="text-sm font-medium text-main">Correo</span>
                <input
                  name="email"
                  type="email"
                  [(ngModel)]="f.email"
                  maxlength="160"
                  class="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label class="block">
                <span class="text-sm font-medium text-main">Dirección</span>
                <input
                  name="direccion"
                  [(ngModel)]="f.direccion"
                  maxlength="200"
                  class="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label class="block">
                <span class="text-sm font-medium text-main">Localidad</span>
                <input
                  name="localidad"
                  [(ngModel)]="f.localidad"
                  maxlength="120"
                  placeholder="Código postal, ciudad y país"
                  class="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
            </div>
          </section>

          <section class="space-y-4 rounded-xl bg-surface p-5 shadow-sm ring-1 ring-line">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">Horario</h2>
            <p class="text-xs text-muted">
              El horario fijo de cada semana. Los festivos y los cierres de un día concreto
              no van aquí: eso es <strong>Días cerrados</strong>.
            </p>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block">
                <span class="text-sm font-medium text-main">Abre a las</span>
                <input
                  name="horaApertura"
                  type="time"
                  [(ngModel)]="f.horaApertura"
                  required
                  class="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label class="block">
                <span class="text-sm font-medium text-main">Cierra a las</span>
                <input
                  name="horaCierre"
                  type="time"
                  [(ngModel)]="f.horaCierre"
                  required
                  class="mt-1 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-main focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
            </div>

            <div>
              <span class="text-sm font-medium text-main">Días en los que no se abre nunca</span>
              <div class="mt-2 flex flex-wrap gap-2">
                @for (dia of dias; track dia) {
                  <button
                    type="button"
                    (click)="alternarDia(dia)"
                    [class]="
                      cerrado(dia)
                        ? 'rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white'
                        : 'rounded-lg bg-elevated px-3 py-1.5 text-sm text-muted ring-1 ring-line hover:text-main'
                    "
                  >
                    {{ nombreDia(dia) }}
                  </button>
                }
              </div>
              @if (cerrados().length === 7) {
                <p class="mt-2 text-xs text-error">
                  Con los siete días cerrados no se puede agendar ninguna cita.
                </p>
              }
            </div>
          </section>

          <div class="flex items-center gap-3">
            <button
              type="submit"
              [disabled]="guardando()"
              class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {{ guardando() ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class Negocio implements OnInit {
  private readonly negocioService = inject(NegocioService);

  protected readonly dias = DIAS_SEMANA;
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly feedback = signal<{ texto: string; error: boolean } | null>(null);

  /**
   * Copia editable de la ficha. Se edita una copia y no la señal del servicio para que
   * escribir en el formulario no cambie lo que la cabecera está pintando: hasta que no se
   * guarda, no hay nada que cambiar.
   */
  protected readonly ficha = signal<FichaNegocio | null>(null);

  protected readonly cerrados = signal<DiaSemana[]>([]);

  ngOnInit(): void {
    // La ficha ya se cargó en el arranque, pero se vuelve a pedir: esta pantalla se abre
    // para cambiarla y es donde más importa no estar editando una copia de hace tres días.
    this.negocioService.cargar().then(() => {
      const actual = this.negocioService.ficha();
      this.ficha.set({ ...actual, horaApertura: hhmm(actual.horaApertura), horaCierre: hhmm(actual.horaCierre) });
      this.cerrados.set([...actual.diasCerrados]);
      this.cargando.set(false);
    });
  }

  protected nombreDia(dia: DiaSemana): string {
    return NOMBRE_DIA[dia];
  }

  protected cerrado(dia: DiaSemana): boolean {
    return this.cerrados().includes(dia);
  }

  protected alternarDia(dia: DiaSemana): void {
    const actuales = this.cerrados();
    this.cerrados.set(
      actuales.includes(dia) ? actuales.filter((d) => d !== dia) : [...actuales, dia],
    );
  }

  protected guardar(): void {
    const f = this.ficha();
    if (!f) return;

    this.guardando.set(true);
    this.feedback.set(null);
    const cambios: ActualizarNegocio = { ...f, diasCerrados: this.cerrados() };
    this.negocioService.guardar(cambios).subscribe({
      next: (guardada) => {
        this.ficha.set({
          ...guardada,
          horaApertura: hhmm(guardada.horaApertura),
          horaCierre: hhmm(guardada.horaCierre),
        });
        this.cerrados.set([...guardada.diasCerrados]);
        this.guardando.set(false);
        this.feedback.set({ texto: 'Datos del negocio guardados.', error: false });
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.feedback.set({
          texto: extraerError(err) ?? 'No se pudieron guardar los datos.',
          error: true,
        });
      },
    });
  }
}

/**
 * El backend manda las horas como `HH:mm:ss` y un `<input type="time">` no pinta los
 * segundos: sin recortarlos, el campo aparece vacío y parece que no hay horario.
 */
function hhmm(hora: string): string {
  return hora.slice(0, 5);
}

function extraerError(err: HttpErrorResponse): string | null {
  const cuerpo = err.error;
  if (typeof cuerpo === 'string') return cuerpo;
  return cuerpo?.error ?? cuerpo?.mensaje ?? cuerpo?.message ?? null;
}
