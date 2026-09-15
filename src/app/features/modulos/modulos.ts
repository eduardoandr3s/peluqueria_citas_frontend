import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  CambioModulo,
  ClaveModulo,
  Modulo,
  ModuloService,
  PerfilArranque,
} from '@peluqueria/core';

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
  GALERIA:
    'Desaparecen la pantalla de galería, la entrada en Servicios de la app y el listado público. Las fotos que ya estén subidas se quedan y vuelven al encenderlo.',
  EQUIPO_CV:
    'Desaparecen «El equipo» de la app y el CV de cada ficha. El cliente seguirá pudiendo elegir con quién agendar, pero sin ver quién es quién.',
  PRODUCCION:
    'Desaparecen las pantallas de producción, la comparativa de la plantilla y sus endpoints. No se borra ningún dato.',
  RECORDATORIOS_EMAIL:
    'Deja de enviarse el aviso automático antes de la cita. Los correos de confirmación y de anulación siguen saliendo.',
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

      <!--
        Los perfiles van arriba y plegados: lo normal es venir aqui a cambiar un modulo, no
        a reiniciarlos todos. Abierto de entrada, un boton que apaga ocho cosas de golpe
        estaria delante del que solo queria apagar una.
      -->
      <div class="overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-line">
        <button
          type="button"
          (click)="perfilesAbiertos.set(!perfilesAbiertos())"
          class="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-elevated"
        >
          <span>
            <span class="font-medium text-main">Empezar con un perfil</span>
            <span class="mt-0.5 block text-sm text-muted">
              Deja preparado el juego de módulos de una peluquería que acaba de entrar, en vez
              de ir apagando uno a uno.
            </span>
          </span>
          <span class="text-muted">{{ perfilesAbiertos() ? '▲' : '▼' }}</span>
        </button>

        @if (perfilesAbiertos()) {
          <div class="divide-y divide-line border-t border-line">
            @for (p of perfiles(); track p.clave) {
              <div class="px-5 py-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <span>
                    <span class="font-medium text-main">{{ p.nombre }}</span>
                    <span class="mt-0.5 block text-sm text-muted">{{ p.descripcion }}</span>
                  </span>
                  <button
                    type="button"
                    (click)="pedirConfirmacion(p)"
                    [disabled]="guardando()"
                    class="rounded-lg bg-elevated px-3 py-1.5 text-sm font-medium text-main ring-1 ring-line hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Aplicar
                  </button>
                </div>

                @if (confirmando()?.clave === p.clave) {
                  <div class="mt-3 rounded-lg bg-error/10 px-4 py-3 text-sm">
                    <p class="text-main">
                      Se <strong>apagará</strong> todo lo que no esté en el perfil. No se borra
                      nada: lo apagado vuelve tal cual al encenderlo otra vez.
                    </p>
                    @if (nombresApagados(p); as apagados) {
                      @if (apagados.length > 0) {
                        <p class="mt-2 text-muted">Se apagan: {{ apagados.join(', ') }}.</p>
                      }
                    }
                    <div class="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        (click)="aplicar(p)"
                        [disabled]="guardando()"
                        class="rounded-lg bg-error px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {{ guardando() ? 'Aplicando…' : 'Sí, aplicar el perfil' }}
                      </button>
                      <button
                        type="button"
                        (click)="confirmando.set(null)"
                        class="text-sm font-medium text-muted hover:text-main"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
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

        <!--
          El asistente no es un modulo y no debe serlo: se apaga por configuracion del
          despliegue (clave de API y cuota), o sea coste de infraestructura y no una
          decision de producto. Meterlo aqui pondria una factura dentro de una pantalla de
          negocio. Se dice, porque si no la pregunta vuelve cada vez que alguien mira esta
          lista y no lo encuentra.
        -->
        <p class="rounded-lg bg-elevated px-4 py-3 text-xs text-muted">
          El <strong>asistente</strong> no está en esta lista a propósito: se enciende y se
          apaga en la configuración del servidor, porque consume cuota de una API de pago.
          No es una decisión de negocio como las de aquí.
        </p>

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

  protected readonly perfiles = signal<PerfilArranque[]>([]);
  protected readonly perfilesAbiertos = signal(false);

  /**
   * El perfil cuya confirmación está pedida. Aplicar uno apaga varios módulos de golpe, y
   * eso no puede quedar a un solo clic: la pantalla enseña antes la lista de lo que apaga.
   */
  protected readonly confirmando = signal<PerfilArranque | null>(null);

  protected readonly pendientes = computed<CambioModulo[]>(() => {
    const original = this.guardado();
    return [...this.cambios().entries()]
      .map(([clave, activo]) => ({ clave, activo }))
      // Volver una casilla a su valor original deja de ser un cambio.
      .filter((c) => original.find((m) => m.clave === c.clave)?.activo !== c.activo);
  });

  ngOnInit(): void {
    this.cargar();
    // Si falla, la sección de perfiles se queda vacía y la pantalla sigue sirviendo para lo
    // que se viene a hacer casi siempre, que es cambiar un módulo. Por eso el error se
    // traga en vez de ocupar el aviso de arriba, que es para lo que sí impide trabajar.
    this.moduloService.perfiles().subscribe({
      next: (ps) => this.perfiles.set(ps),
      error: () => this.perfiles.set([]),
    });
  }

  protected pedirConfirmacion(perfil: PerfilArranque): void {
    this.confirmando.set(this.confirmando()?.clave === perfil.clave ? null : perfil);
  }

  /** Los nombres de lo que el perfil deja apagado y ahora mismo está encendido. */
  protected nombresApagados(perfil: PerfilArranque): string[] {
    return this.guardado()
      .filter((m) => m.efectivo && perfil.apaga.includes(m.clave))
      .map((m) => m.nombre);
  }

  protected aplicar(perfil: PerfilArranque): void {
    this.guardando.set(true);
    this.feedback.set(null);
    this.moduloService.aplicarPerfil(perfil.clave).subscribe({
      next: (catalogo) => {
        this.guardado.set(catalogo);
        // Las casillas movidas y sin guardar dejan de tener sentido: el perfil acaba de
        // reescribir el estado de todas.
        this.cambios.set(new Map());
        this.confirmando.set(null);
        this.guardando.set(false);
        this.feedback.set({ texto: `Perfil «${perfil.nombre}» aplicado.`, error: false });
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.feedback.set({
          texto: this.extraerError(err) ?? 'No se pudo aplicar el perfil.',
          error: true,
        });
      },
    });
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
