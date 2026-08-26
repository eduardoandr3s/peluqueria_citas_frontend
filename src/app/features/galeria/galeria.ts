import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { GaleriaFoto, GaleriaService, redimensionarImagen } from '@peluqueria/core';

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

/** Lado máximo de la miniatura, en px. Suficiente para una tarjeta de rejilla. */
const LADO_MINIATURA = 400;

@Component({
  selector: 'app-galeria',
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-main">Galería de trabajos</h1>
          <p class="text-sm text-muted">
            Las fotos se ven en la app sin necesidad de cuenta. El orden de aquí es el orden que ven
            los clientes.
          </p>
        </div>
        <label
          class="flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
          [class.pointer-events-none]="subiendo()"
          [class.opacity-60]="subiendo()"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {{ subiendo() ? progreso() : 'Añadir fotos' }}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            class="hidden"
            (change)="onFotosElegidas($event)"
          />
        </label>
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

      <div class="rounded-xl bg-surface p-5 shadow-sm ring-1 ring-line">
        @if (loading()) {
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="aspect-square animate-pulse rounded-lg bg-elevated"></div>
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
        } @else if (fotos().length === 0) {
          <p class="p-8 text-center text-sm text-muted">
            Aún no hay fotos. Añade la primera con «Añadir fotos».
          </p>
        } @else {
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            @for (foto of fotos(); track foto.idFoto; let i = $index) {
              <div class="overflow-hidden rounded-lg ring-1 ring-line">
                <!--
                  En la rejilla siempre la miniatura, nunca la grande: el límite del
                  plan gratuito de Storage es el tráfico, no el espacio.
                -->
                <img
                  [src]="foto.urlMiniatura"
                  [alt]="foto.titulo ?? 'Trabajo de la peluquería'"
                  loading="lazy"
                  class="aspect-square w-full bg-elevated object-cover"
                />
                <div class="space-y-2 p-3">
                  @if (editandoId() === foto.idFoto) {
                    <input
                      type="text"
                      [(ngModel)]="tituloEditado"
                      maxlength="120"
                      placeholder="Título (opcional)"
                      (keyup.enter)="guardarTitulo(foto)"
                      (keyup.escape)="cancelarTitulo()"
                      class="w-full rounded-lg border border-line bg-base px-2 py-1.5 text-sm text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                    <div class="flex gap-2">
                      <button
                        type="button"
                        (click)="guardarTitulo(foto)"
                        class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        (click)="cancelarTitulo()"
                        class="rounded-lg bg-elevated px-3 py-1.5 text-xs font-medium text-main hover:bg-line"
                      >
                        Cancelar
                      </button>
                    </div>
                  } @else {
                    <p class="truncate text-sm font-medium text-main" [title]="foto.titulo ?? ''">
                      {{ foto.titulo || 'Sin título' }}
                    </p>
                    <div class="flex items-center justify-between gap-1">
                      <div class="flex gap-1">
                        <button
                          type="button"
                          (click)="mover(i, -1)"
                          [disabled]="i === 0 || ocupado()"
                          title="Mover antes"
                          aria-label="Mover antes"
                          class="rounded-lg bg-elevated px-2 py-1 text-sm text-main hover:bg-line disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          (click)="mover(i, 1)"
                          [disabled]="i === fotos().length - 1 || ocupado()"
                          title="Mover después"
                          aria-label="Mover después"
                          class="rounded-lg bg-elevated px-2 py-1 text-sm text-main hover:bg-line disabled:opacity-40"
                        >
                          ↓
                        </button>
                      </div>
                      <div class="flex gap-1">
                        <button
                          type="button"
                          (click)="editarTitulo(foto)"
                          [disabled]="ocupado()"
                          class="rounded-lg bg-elevated px-2 py-1 text-xs font-medium text-main hover:bg-line disabled:opacity-40"
                        >
                          Título
                        </button>
                        <button
                          type="button"
                          (click)="pedirBorrado(foto)"
                          [disabled]="ocupado()"
                          class="rounded-lg bg-error/15 px-2 py-1 text-xs font-medium text-error hover:bg-error/25 disabled:opacity-40"
                        >
                          Borrar
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>

    @if (pendienteBorrado(); as foto) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <div class="w-full max-w-sm rounded-xl bg-surface p-5 shadow-lg ring-1 ring-line">
          <h2 class="text-lg font-semibold text-main">Borrar foto</h2>
          <p class="mt-2 text-sm text-muted">
            «{{ foto.titulo || 'Sin título' }}» dejará de verse en la app. Esto no se puede deshacer.
          </p>
          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              (click)="pendienteBorrado.set(null)"
              class="rounded-lg bg-elevated px-4 py-2 text-sm font-medium text-main hover:bg-line"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="borrar(foto)"
              [disabled]="ocupado()"
              class="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              Borrar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class Galeria implements OnInit {
  private readonly galeriaService = inject(GaleriaService);

  protected readonly fotos = signal<GaleriaFoto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);

  protected readonly subiendo = signal(false);
  protected readonly guardando = signal(false);
  protected readonly progreso = signal('Subiendo…');

  protected readonly editandoId = signal<number | null>(null);
  protected tituloEditado = '';
  protected readonly pendienteBorrado = signal<GaleriaFoto | null>(null);

  /** Mientras haya una operación en vuelo, los botones de la rejilla se bloquean. */
  protected readonly ocupado = computed(() => this.subiendo() || this.guardando());

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.galeriaService.listar().subscribe({
      next: (fotos) => {
        this.fotos.set(fotos);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No se pudo cargar la galería.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Sube las fotos elegidas, de una en una.
   *
   * En serie y no en paralelo por dos razones: el orden en el que se guardan es el
   * orden en el que se verán, y producción es una instancia con 0,1 CPU a la que no
   * se le lanzan diez multipart a la vez.
   */
  protected async onFotosElegidas(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const ficheros = Array.from(input.files ?? []);
    // Permite volver a elegir los mismos ficheros si la subida falla.
    input.value = '';
    if (ficheros.length === 0) return;

    this.feedback.set(null);
    this.subiendo.set(true);
    let subidas = 0;

    for (const [indice, fichero] of ficheros.entries()) {
      this.progreso.set(`Subiendo ${indice + 1} de ${ficheros.length}…`);
      try {
        // Dos tamaños del mismo fichero: la grande para el visor y la miniatura para
        // la rejilla. Se generan aquí porque el servidor tiene 0,1 CPU y el navegador
        // lo hace gratis.
        const grande = await redimensionarImagen(fichero);
        const miniatura = await redimensionarImagen(fichero, LADO_MINIATURA);
        const foto = await this.subirUna(grande, miniatura);
        this.fotos.update((list) => [...list, foto]);
        subidas++;
      } catch (err) {
        this.feedback.set({
          type: 'error',
          text: this.mensajeDeSubida(err as HttpErrorResponse, fichero.name),
        });
        break;
      }
    }

    this.subiendo.set(false);
    if (subidas > 0 && !this.feedback()) {
      this.feedback.set({
        type: 'success',
        text: subidas === 1 ? 'Foto añadida.' : `${subidas} fotos añadidas.`,
      });
    }
  }

  private subirUna(grande: File, miniatura: File): Promise<GaleriaFoto> {
    return new Promise((resolve, reject) => {
      this.galeriaService.subir(grande, miniatura).subscribe({ next: resolve, error: reject });
    });
  }

  private mensajeDeSubida(err: HttpErrorResponse, nombre: string): string {
    if (err.status === 413) {
      return `«${nombre}» es demasiado grande.`;
    }
    return this.extraerError(err) ?? `No se pudo subir «${nombre}».`;
  }

  protected editarTitulo(foto: GaleriaFoto): void {
    this.feedback.set(null);
    this.tituloEditado = foto.titulo ?? '';
    this.editandoId.set(foto.idFoto);
  }

  protected cancelarTitulo(): void {
    this.editandoId.set(null);
    this.tituloEditado = '';
  }

  protected guardarTitulo(foto: GaleriaFoto): void {
    const titulo = this.tituloEditado.trim();
    if (titulo === (foto.titulo ?? '')) {
      this.cancelarTitulo();
      return;
    }
    this.guardando.set(true);
    this.galeriaService.actualizar(foto.idFoto, { titulo }).subscribe({
      next: (actualizada) => {
        this.guardando.set(false);
        this.cancelarTitulo();
        this.fotos.update((list) =>
          list.map((f) => (f.idFoto === actualizada.idFoto ? actualizada : f)),
        );
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.feedback.set({
          type: 'error',
          text: this.extraerError(err) ?? 'No se pudo guardar el título.',
        });
      },
    });
  }

  /**
   * Mueve una foto una posición arriba o abajo.
   *
   * Se renumera la rejilla entera y solo se manda al servidor lo que cambia de
   * número. Intercambiar los dos `orden` sería menos peticiones, pero no funciona si
   * las dos fotos comparten orden (todas las subidas antes de existir el reorden
   * podrían valer 0): renumerar arregla esos casos en el primer movimiento.
   */
  protected mover(indice: number, delta: number): void {
    const destino = indice + delta;
    const actuales = this.fotos();
    if (destino < 0 || destino >= actuales.length) return;

    const reordenadas = [...actuales];
    [reordenadas[indice], reordenadas[destino]] = [reordenadas[destino], reordenadas[indice]];

    const cambios = reordenadas
      .map((foto, orden) => ({ foto, orden }))
      .filter(({ foto, orden }) => foto.orden !== orden);
    if (cambios.length === 0) return;

    // Se pinta el orden nuevo ya: si el servidor falla, se recarga y vuelve al suyo.
    this.fotos.set(reordenadas.map((foto, orden) => ({ ...foto, orden })));
    this.guardando.set(true);
    this.feedback.set(null);

    forkJoin(
      cambios.map(({ foto, orden }) => this.galeriaService.actualizar(foto.idFoto, { orden })),
    ).subscribe({
      next: () => this.guardando.set(false),
      error: () => {
        this.guardando.set(false);
        this.feedback.set({ type: 'error', text: 'No se pudo guardar el orden nuevo.' });
        this.cargar();
      },
    });
  }

  protected pedirBorrado(foto: GaleriaFoto): void {
    this.feedback.set(null);
    this.pendienteBorrado.set(foto);
  }

  protected borrar(foto: GaleriaFoto): void {
    this.guardando.set(true);
    this.galeriaService.eliminar(foto.idFoto).subscribe({
      next: () => {
        this.guardando.set(false);
        this.pendienteBorrado.set(null);
        this.fotos.update((list) => list.filter((f) => f.idFoto !== foto.idFoto));
        this.feedback.set({ type: 'success', text: 'Foto borrada.' });
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.pendienteBorrado.set(null);
        this.feedback.set({
          type: 'error',
          text: this.extraerError(err) ?? 'No se pudo borrar la foto.',
        });
      },
    });
  }

  /** El backend devuelve {error: "..."} o, en validaciones, {campo: "mensaje"}. */
  private extraerError(err: HttpErrorResponse): string | null {
    const body = err.error;
    if (!body) return null;
    if (typeof body === 'string') return body;
    if (body.error) return body.error;
    const valores = Object.values(body);
    return valores.length ? String(valores[0]) : null;
  }
}
