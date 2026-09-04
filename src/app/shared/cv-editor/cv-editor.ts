import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PeluqueroCv, PeluqueroCvUpdate } from '@peluqueria/core';

/** Los mismos topes que valida el backend, para avisar antes de la petición. */
const MAX_PRESENTACION = 2000;
const MAX_ESPECIALIDADES = 12;
const MAX_LONGITUD_ESPECIALIDAD = 40;
/** Una foto de ficha no necesita 1200 px: con 800 sobra para la tarjeta más grande. */
export const LADO_FOTO_CV = 800;

/**
 * Formulario del CV público de un peluquero, sin nada de HTTP dentro.
 *
 * Es un componente compartido y no dos formularios porque hay **dos sitios que editan lo
 * mismo por caminos distintos**: el administrador lo hace en la ficha de cualquier
 * profesional (`PUT /peluqueros/{id}/cv`) y el peluquero en «Mi perfil» (`PUT
 * /peluqueros/mio`). Duplicarlo garantizaría que un día divergieran, y con ellos las dos
 * versiones de qué cuenta como una especialidad válida.
 *
 * Quien lo usa decide qué endpoint llamar: aquí solo se emite lo que hay que guardar.
 */
@Component({
  selector: 'app-cv-editor',
  imports: [FormsModule],
  template: `
    <div class="space-y-4">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
        <!-- Foto -->
        <div class="flex flex-col items-center gap-2">
          @if (cv().fotoUrl) {
            <img
              [src]="cv().fotoUrl"
              [alt]="cv().nombre"
              class="h-28 w-28 rounded-lg object-cover ring-1 ring-line"
            />
          } @else {
            <span
              class="flex h-28 w-28 items-center justify-center rounded-lg bg-elevated text-xs text-muted"
              >Sin foto</span
            >
          }

          @if (puedeEditar()) {
            <div class="flex items-center gap-1.5">
              <label
                class="cursor-pointer rounded-lg bg-elevated px-3 py-1.5 text-xs font-medium text-main transition hover:bg-line"
                [class.opacity-60]="subiendoFoto()"
              >
                {{ subiendoFoto() ? 'Subiendo…' : cv().fotoUrl ? 'Sustituir' : 'Subir foto' }}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  class="hidden"
                  [disabled]="subiendoFoto()"
                  (change)="elegirFoto($event)"
                />
              </label>
              @if (cv().fotoUrl) {
                <button
                  type="button"
                  (click)="quitarFoto.emit()"
                  [disabled]="subiendoFoto()"
                  class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-error hover:bg-error/10 disabled:opacity-60"
                >
                  Quitar
                </button>
              }
            </div>
            <!-- La foto se sube al elegirla y no al guardar el formulario: es una
                 petición aparte (multipart) y así se ve el resultado al momento. -->
            <p class="max-w-[10rem] text-center text-[11px] leading-tight text-muted">
              Se guarda al elegirla, sin esperar a «Guardar».
            </p>
          }
        </div>

        <!-- Presentación -->
        <div class="flex-1">
          <label class="mb-1.5 block text-sm font-medium text-main">Presentación</label>
          <textarea
            rows="5"
            [ngModel]="presentacion()"
            (ngModelChange)="presentacion.set($event)"
            [disabled]="!puedeEditar()"
            placeholder="Cómo se presenta al cliente: qué hace, cómo trabaja, desde cuándo…"
            class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
          ></textarea>
          <p class="mt-1 text-xs" [class]="presentacionSePasa() ? 'text-error' : 'text-muted'">
            {{ presentacion().length }} / {{ maxPresentacion }} caracteres
          </p>
        </div>
      </div>

      <!-- Especialidades -->
      <div>
        <label class="mb-1.5 block text-sm font-medium text-main">Especialidades</label>
        @if (especialidades().length > 0) {
          <div class="mb-2 flex flex-wrap gap-1.5">
            @for (e of especialidades(); track e) {
              <span
                class="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary"
              >
                {{ e }}
                @if (puedeEditar()) {
                  <button
                    type="button"
                    (click)="quitarEspecialidad(e)"
                    class="hover:opacity-70"
                    [attr.aria-label]="'Quitar ' + e"
                  >
                    ✕
                  </button>
                }
              </span>
            }
          </div>
        }
        @if (puedeEditar()) {
          <div class="flex items-center gap-2">
            <input
              type="text"
              [ngModel]="nuevaEspecialidad()"
              (ngModelChange)="nuevaEspecialidad.set($event)"
              (keydown.enter)="anadirEspecialidad($event)"
              [maxlength]="maxLongitudEspecialidad"
              [disabled]="especialidades().length >= maxEspecialidades"
              placeholder="Degradados, barba, color…"
              class="flex-1 rounded-lg border border-line bg-base px-3 py-2 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary disabled:opacity-60"
            />
            <button
              type="button"
              (click)="anadirEspecialidad()"
              [disabled]="!nuevaEspecialidad().trim() || especialidades().length >= maxEspecialidades"
              class="rounded-lg bg-elevated px-3 py-2 text-xs font-medium text-main hover:bg-line disabled:opacity-50"
            >
              Añadir
            </button>
          </div>
          <p class="mt-1 text-xs text-muted">
            Una por una, hasta {{ maxEspecialidades }}. Se pintan como etiquetas debajo del
            nombre, así que cuanto más cortas mejor.
          </p>
          @if (errorEspecialidad(); as e) {
            <p class="mt-1 text-xs text-error">{{ e }}</p>
          }
        } @else if (especialidades().length === 0) {
          <p class="text-sm text-muted">—</p>
        }
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-main">Años de experiencia</label>
          <input
            type="number"
            min="0"
            max="70"
            [ngModel]="aniosExperiencia()"
            (ngModelChange)="aniosExperiencia.set($event)"
            [disabled]="!puedeEditar()"
            placeholder="Déjalo vacío si prefieres no decirlo"
            class="w-full rounded-lg border border-line bg-base px-3.5 py-2.5 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-main">Instagram</label>
          <div class="flex items-center rounded-lg border border-line bg-base focus-within:border-primary">
            <span class="pl-3 text-sm text-muted">&#64;</span>
            <input
              type="text"
              [ngModel]="instagram()"
              (ngModelChange)="instagram.set($event)"
              [disabled]="!puedeEditar()"
              placeholder="usuario"
              class="w-full rounded-lg bg-transparent px-2 py-2.5 text-sm text-main outline-none placeholder:text-muted disabled:opacity-60"
            />
          </div>
          <p class="mt-1 text-xs text-muted">
            Solo el usuario. Si pegas la dirección completa, se queda con el usuario.
          </p>
        </div>
      </div>

      @if (puedeEditar()) {
        <div class="flex items-center justify-between gap-3 border-t border-line pt-4">
          <p class="text-xs text-muted">
            Esto lo ve cualquiera, también sin cuenta. Un campo que dejes vacío se borra.
          </p>
          <button
            type="button"
            (click)="emitirGuardar()"
            [disabled]="guardando() || presentacionSePasa()"
            class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
          >
            {{ guardando() ? 'Guardando…' : 'Guardar CV' }}
          </button>
        </div>
      }
    </div>
  `,
})
export class CvEditor {
  /** El CV tal y como está guardado. Al cambiar, el formulario se rehace desde él. */
  readonly cv = input.required<PeluqueroCv>();
  /**
   * A false se pinta en modo lectura. Lo decide quien lo usa: en «Mi perfil» depende del
   * permiso `PERFIL_CV_EDITAR`, y un peluquero sin él debe poder ver lo que hay escrito
   * aunque no lo pueda cambiar.
   */
  readonly puedeEditar = input(true);
  readonly guardando = input(false);
  readonly subiendoFoto = input(false);

  readonly guardar = output<PeluqueroCvUpdate>();
  /** Ya reducida: la subida es del padre, que es quien sabe a qué ficha va. */
  readonly fotoElegida = output<File>();
  readonly quitarFoto = output<void>();

  protected readonly maxPresentacion = MAX_PRESENTACION;
  protected readonly maxEspecialidades = MAX_ESPECIALIDADES;
  protected readonly maxLongitudEspecialidad = MAX_LONGITUD_ESPECIALIDAD;

  protected readonly presentacion = signal('');
  protected readonly especialidades = signal<string[]>([]);
  protected readonly aniosExperiencia = signal<number | null>(null);
  protected readonly instagram = signal('');
  protected readonly nuevaEspecialidad = signal('');
  protected readonly errorEspecialidad = signal<string | null>(null);

  protected readonly presentacionSePasa = computed(
    () => this.presentacion().length > MAX_PRESENTACION,
  );

  constructor() {
    // El formulario se rehace cada vez que llega otro CV: el modal del panel reutiliza el
    // componente para fichas distintas, y sin esto la segunda enseñaría lo de la primera.
    effect(() => {
      const cv = this.cv();
      this.presentacion.set(cv.presentacion ?? '');
      this.especialidades.set([...(cv.especialidades ?? [])]);
      this.aniosExperiencia.set(cv.aniosExperiencia ?? null);
      this.instagram.set(cv.instagram ?? '');
      this.nuevaEspecialidad.set('');
      this.errorEspecialidad.set(null);
    });
  }

  protected anadirEspecialidad(evento?: Event): void {
    evento?.preventDefault();
    const valor = this.nuevaEspecialidad().trim();
    if (!valor) return;

    // La coma es el separador con el que las guarda el backend: dentro de una etiqueta
    // partiría la lista al releerla, así que se avisa aquí en vez de recibir un 400.
    if (valor.includes(',')) {
      this.errorEspecialidad.set('Sin comas: añade cada especialidad por separado.');
      return;
    }
    // Mismo criterio que el servidor: la misma etiqueta con otras mayúsculas es la misma.
    if (this.especialidades().some((e) => e.toLowerCase() === valor.toLowerCase())) {
      this.errorEspecialidad.set(`«${valor}» ya está.`);
      return;
    }

    this.errorEspecialidad.set(null);
    this.especialidades.update((lista) => [...lista, valor]);
    this.nuevaEspecialidad.set('');
  }

  protected quitarEspecialidad(especialidad: string): void {
    this.errorEspecialidad.set(null);
    this.especialidades.update((lista) => lista.filter((e) => e !== especialidad));
  }

  protected elegirFoto(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const fichero = input.files?.[0];
    // Permite volver a elegir el mismo fichero si la subida falla.
    input.value = '';
    if (fichero) {
      this.fotoElegida.emit(fichero);
    }
  }

  protected emitirGuardar(): void {
    // Se manda el bloque entero, campos vacíos incluidos: en este endpoint lo que no
    // llega se borra, y es la única forma de quitar una presentación que ya no vale.
    const anios = this.aniosExperiencia();
    this.guardar.emit({
      presentacion: this.presentacion().trim() || null,
      especialidades: this.especialidades(),
      aniosExperiencia: anios === null || Number.isNaN(Number(anios)) ? null : Number(anios),
      instagram: this.instagram().trim() || null,
    });
  }
}
