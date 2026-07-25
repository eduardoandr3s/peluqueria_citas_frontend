import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  TemplateRef,
  computed,
  contentChild,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { registrarOverlay } from '../overlay-stack';

/** Píxeles que faltan para el final de la lista a partir de los cuales se carga el siguiente lote. */
const MARGEN_SCROLL = 48;

/**
 * Modal con una lista buscable que se va mostrando por lotes según se hace scroll.
 *
 * Los datos llegan ya cargados en `items`: el troceado y la búsqueda son en cliente, así que
 * escribir en el buscador filtra sobre el total, no solo sobre lo que hay pintado.
 *
 * La fila la pone quien lo usa, con un `ng-template` de referencia `#fila`:
 *
 * ```html
 * <app-lista-modal titulo="Citas de hoy" [items]="citasDeHoy()" [filtro]="filtrarCita"
 *                  (cerrar)="modal.set(null)">
 *   <ng-template #fila let-cita>{{ cita.usuario.nombre }}</ng-template>
 * </app-lista-modal>
 * ```
 */
@Component({
  selector: 'app-lista-modal',
  imports: [FormsModule, NgTemplateOutlet],
  host: { '(document:keydown.escape)': 'alPulsarEscape()' },
  template: `
    <div
      class="fixed inset-0 z-40 flex items-start justify-center bg-black/60 p-4 sm:items-center"
      (click)="cerrar.emit()"
    >
      <!-- El clic dentro del panel no debe cerrar el modal -->
      <div
        class="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-surface shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold text-main">{{ titulo() }}</h2>
            <p class="mt-0.5 text-xs text-muted">
              {{ total() }} {{ total() === 1 ? 'resultado' : 'resultados' }}
              @if (subtitulo()) {
                · {{ subtitulo() }}
              }
            </p>
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

        <div class="border-b border-line px-5 py-3">
          <div class="relative">
            <svg
              class="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-muted"
              fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              [ngModel]="busqueda()"
              (ngModelChange)="busqueda.set($event)"
              [placeholder]="placeholder()"
              class="w-full rounded-lg border border-line bg-base py-2 pl-10 pr-3 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div class="flex-1 overflow-y-auto" (scroll)="alHacerScroll($event)">
          @if (filtrados().length === 0) {
            <p class="p-8 text-center text-sm text-muted">
              @if (total() === 0) {
                {{ vacio() }}
              } @else {
                Nada coincide con «{{ busqueda() }}».
              }
            </p>
          } @else {
            <ul class="divide-y divide-line">
              @for (item of visibles(); track $index) {
                <li class="px-5 py-3">
                  <ng-container
                    [ngTemplateOutlet]="fila()"
                    [ngTemplateOutletContext]="{ $implicit: item }"
                  />
                </li>
              }
            </ul>
            @if (hayMas()) {
              <button
                type="button"
                (click)="mostrarMas()"
                class="w-full px-5 py-3 text-center text-sm font-medium text-primary transition hover:bg-elevated"
              >
                Mostrar más ({{ visibles().length }} de {{ filtrados().length }})
              </button>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class ListaModal<T> {
  readonly titulo = input.required<string>();
  readonly items = input.required<readonly T[]>();
  /** Texto extra en la cabecera, p. ej. el rango de fechas al que corresponde la lista. */
  readonly subtitulo = input('');
  /** Decide si un elemento encaja con lo escrito en el buscador (el texto llega en minúsculas). */
  readonly filtro = input<(item: T, busqueda: string) => boolean>(() => true);
  readonly placeholder = input('Buscar…');
  readonly vacio = input('No hay nada que mostrar.');
  readonly tamanoLote = input(10);

  readonly cerrar = output<void>();

  /** Plantilla de fila que proyecta quien usa el modal (`<ng-template #fila let-item>`). */
  protected readonly fila = contentChild.required<TemplateRef<{ $implicit: T }>>('fila');

  private readonly esTope = registrarOverlay();

  protected readonly busqueda = signal('');
  /**
   * Lotes mostrados. Vuelve a 1 en cuanto cambia la búsqueda: si no, tras haber hecho
   * scroll una búsqueda nueva aparecería con todos sus resultados de golpe.
   */
  private readonly lotes = linkedSignal({ source: this.busqueda, computation: () => 1 });

  protected readonly total = computed(() => this.items().length);

  protected readonly filtrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const items = this.items();
    if (!q) return items;
    const filtro = this.filtro();
    return items.filter((item) => filtro(item, q));
  });

  protected readonly visibles = computed(() =>
    this.filtrados().slice(0, this.lotes() * this.tamanoLote()),
  );

  protected readonly hayMas = computed(() => this.visibles().length < this.filtrados().length);

  /** Escape cierra, pero solo el modal de más arriba (ver `registrarOverlay`). */
  protected alPulsarEscape(): void {
    if (this.esTope()) this.cerrar.emit();
  }

  protected mostrarMas(): void {
    if (this.hayMas()) this.lotes.update((n) => n + 1);
  }

  protected alHacerScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - MARGEN_SCROLL) {
      this.mostrarMas();
    }
  }
}
