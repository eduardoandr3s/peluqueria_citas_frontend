import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CambioModulo, ClaveModulo, Modulo, ModuloService } from '@peluqueria/core';

/**
 * Lo que se pierde al apagar cada módulo. Va escrito aquí y no en el backend porque habla
 * de pantallas, no de reglas, y sobre todo porque es lo que hay que leer ANTES de apagar:
 * apagar los pagos cambia lo que significa la producción, y eso no se puede descubrir
 * después mirando un número a cero.
 */
const CONSECUENCIAS: Record<ClaveModulo, string> = {
  COMISIONES:
    'Desaparecen el porcentaje de cada peluquero, las excepciones por servicio y la comisión en producción. Lo ya congelado en las citas cerradas no se toca.',
  PAGOS:
    'Desaparecen el cobro, el recibo y la pantalla de pago. La producción pasará a contar las citas realizadas aunque no estén cobradas: si no, todos los totales serían cero.',
  PAGO_TARJETA: 'Se cae el cobro online con Stripe. El cobro en el local sigue en pie.',
  PAGO_EFECTIVO: 'No se podrán registrar cobros en efectivo.',
  PAGO_TRANSFERENCIA: 'No se podrán registrar cobros por transferencia.',
};

@Component({
  selector: 'app-modulos',
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-main">Módulos</h1>
        <p class="text-sm text-muted">
          Qué hace esta peluquería. Un módulo apagado <strong>desaparece para todos</strong>,
          administradores incluidos: no es un permiso. No borra nada, así que volver a
          encenderlo deja las cosas como estaban.
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
          Cargando módulos…
        </div>
      } @else if (modulos().length === 0) {
        <div class="rounded-xl bg-surface p-8 text-center text-sm text-muted shadow-sm ring-1 ring-line">
          No hay módulos configurables.
        </div>
      } @else {
        <div class="divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-line">
          @for (m of modulos(); track m.clave) {
            <div class="flex items-start gap-4 px-5 py-4" [class.pl-12]="m.padre">
              <input
                type="checkbox"
                [id]="'modulo-' + m.clave"
                [checked]="estado(m)"
                (change)="alternar(m)"
                [disabled]="guardando()"
                class="mt-0.5 h-4 w-4 cursor-pointer rounded border-line text-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <label [for]="'modulo-' + m.clave" class="flex-1 cursor-pointer">
                <span class="font-medium text-main">{{ m.nombre }}</span>
                <span class="mt-0.5 block text-sm text-muted">{{ m.descripcion }}</span>
                @if (avisoDeJerarquia(m); as aviso) {
                  <span class="mt-1 block text-xs text-warning">{{ aviso }}</span>
                }
                @if (seApaga(m)) {
                  <span class="mt-1 block text-xs text-error">{{ consecuencia(m) }}</span>
                }
              </label>
            </div>
          }
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="guardar()"
            [disabled]="guardando() || pendientes().length === 0"
            class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
          </button>
          @if (pendientes().length > 0) {
            <button
              type="button"
              (click)="descartar()"
              [disabled]="guardando()"
              class="text-sm font-medium text-muted hover:text-main"
            >
              Descartar
            </button>
            <span class="text-xs text-muted">
              {{ pendientes().length }}
              {{ pendientes().length === 1 ? 'cambio sin guardar' : 'cambios sin guardar' }}
            </span>
          }
        </div>
      }
    </div>
  `,
})
export class Modulos implements OnInit {
  private readonly moduloService = inject(ModuloService);

  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly feedback = signal<{ texto: string; error: boolean } | null>(null);

  /** Lo que respondió el backend, sin tocar: contra esto se calcula lo pendiente. */
  private readonly guardado = signal<Modulo[]>([]);

  /**
   * Las casillas movidas. Se llevan aparte en vez de mutar el catálogo para poder mandar
   * solo lo que cambia y para que «Descartar» sea tirar este mapa.
   */
  private readonly cambios = signal<Map<ClaveModulo, boolean>>(new Map());

  protected readonly modulos = this.guardado.asReadonly();

  protected readonly pendientes = computed<CambioModulo[]>(() => {
    const original = this.guardado();
    return [...this.cambios().entries()]
      .map(([clave, activo]) => ({ clave, activo }))
      // Volver una casilla a su valor original deja de ser un cambio.
      .filter((c) => original.find((m) => m.clave === c.clave)?.activo !== c.activo);
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected estado(modulo: Modulo): boolean {
    return this.cambios().get(modulo.clave) ?? modulo.activo;
  }

  protected alternar(modulo: Modulo): void {
    const mapa = new Map(this.cambios());
    mapa.set(modulo.clave, !this.estado(modulo));
    this.cambios.set(mapa);
  }

  protected descartar(): void {
    this.cambios.set(new Map());
  }

  /** Si este cambio sin guardar lo deja apagado, para avisar de lo que se va a perder. */
  protected seApaga(modulo: Modulo): boolean {
    return this.pendientes().some((c) => c.clave === modulo.clave && !c.activo);
  }

  protected consecuencia(modulo: Modulo): string {
    return CONSECUENCIAS[modulo.clave];
  }

  /**
   * El aviso que evita que la pantalla mienta: una casilla marcada puede no estar
   * aplicando. Pasa en los dos sentidos, y los dos se ven en el estado ya guardado.
   */
  protected avisoDeJerarquia(modulo: Modulo): string | null {
    if (!modulo.activo || modulo.efectivo) {
      return null;
    }
    return modulo.padre
      ? 'No aplica: el módulo del que depende está apagado.'
      : 'No aplica: no queda ninguna opción encendida dentro.';
  }

  protected guardar(): void {
    const cambios = this.pendientes();
    if (cambios.length === 0) return;

    this.guardando.set(true);
    this.feedback.set(null);
    this.moduloService.guardar(cambios).subscribe({
      next: (catalogo) => {
        this.guardado.set(catalogo);
        this.cambios.set(new Map());
        this.guardando.set(false);
        this.feedback.set({ texto: 'Módulos actualizados.', error: false });
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.feedback.set({
          texto: this.extraerError(err) ?? 'No se pudieron guardar los módulos.',
          error: true,
        });
      },
    });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.moduloService.catalogo().subscribe({
      next: (catalogo) => {
        this.guardado.set(catalogo);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.feedback.set({
          texto: this.extraerError(err) ?? 'No se pudieron cargar los módulos.',
          error: true,
        });
      },
    });
  }

  private extraerError(err: HttpErrorResponse): string | null {
    const cuerpo = err.error;
    if (typeof cuerpo === 'string') return cuerpo;
    return cuerpo?.error ?? cuerpo?.mensaje ?? cuerpo?.message ?? null;
  }
}
