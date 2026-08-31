import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CambioPermiso, ClavePermiso, Permiso, PermisoService, Rol } from '@peluqueria/core';

/** Los roles que se configuran, en el orden en que se pintan las columnas. */
const ROLES_CONFIGURABLES: Rol[] = ['PELUQUERO'];

@Component({
  selector: 'app-permisos',
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-main">Permisos</h1>
        <p class="text-sm text-muted">
          Qué puede hacer cada rol dentro de lo que ya tiene permitido. Un permiso apagado
          quita la acción; encenderlo <strong>no concede nada</strong> que el rol no pudiera
          hacer ya, y un administrador los tiene todos siempre.
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
          Cargando permisos…
        </div>
      } @else if (permisos().length === 0) {
        <div class="rounded-xl bg-surface p-8 text-center text-sm text-muted shadow-sm ring-1 ring-line">
          No hay permisos configurables.
        </div>
      } @else {
        <div class="overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-line">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th class="px-5 py-3 font-medium">Permiso</th>
                  @for (rol of roles; track rol) {
                    <th class="px-5 py-3 text-center font-medium">{{ etiquetaRol(rol) }}</th>
                  }
                </tr>
              </thead>
              <tbody class="divide-y divide-line">
                @for (p of permisos(); track p.clave) {
                  <tr>
                    <td class="px-5 py-4">
                      <p class="font-medium text-main">{{ p.descripcion }}</p>
                      <p class="mt-0.5 font-mono text-xs text-muted">{{ p.clave }}</p>
                    </td>
                    @for (rol of roles; track rol) {
                      <td class="px-5 py-4 text-center">
                        @if (aplica(p, rol)) {
                          <input
                            type="checkbox"
                            [checked]="estado(p, rol)"
                            (change)="alternar(p, rol)"
                            [disabled]="guardando()"
                            class="h-4 w-4 cursor-pointer rounded border-line text-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                            [attr.aria-label]="p.descripcion + ' para ' + etiquetaRol(rol)"
                          />
                        } @else {
                          <span class="text-xs text-muted" title="No se configura para este rol">—</span>
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
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
export class Permisos implements OnInit {
  private readonly permisoService = inject(PermisoService);

  protected readonly roles = ROLES_CONFIGURABLES;
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly feedback = signal<{ texto: string; error: boolean } | null>(null);

  /** Lo que respondió el backend, sin tocar: es contra esto que se calcula lo pendiente. */
  private readonly guardado = signal<Permiso[]>([]);

  /**
   * Las casillas que el usuario ha movido, por `clave|rol`. Se lleva aparte en vez de
   * mutar la matriz para poder mandar solo lo que cambia y para que «Descartar» sea
   * tirar este mapa.
   */
  private readonly cambios = signal<Map<string, boolean>>(new Map());

  protected readonly permisos = this.guardado.asReadonly();

  protected readonly pendientes = computed<CambioPermiso[]>(() => {
    const original = this.guardado();
    return [...this.cambios().entries()]
      .map(([id, habilitado]) => {
        const [clave, rol] = id.split('|') as [ClavePermiso, Rol];
        return { clave, rol, habilitado };
      })
      // Volver una casilla a su valor original deja de ser un cambio.
      .filter((c) => original.find((p) => p.clave === c.clave)?.roles[c.rol] !== c.habilitado);
  });

  ngOnInit(): void {
    this.cargar();
  }

  protected aplica(permiso: Permiso, rol: Rol): boolean {
    return permiso.roles[rol] !== undefined;
  }

  protected estado(permiso: Permiso, rol: Rol): boolean {
    const pendiente = this.cambios().get(this.id(permiso.clave, rol));
    return pendiente ?? permiso.roles[rol] ?? false;
  }

  protected alternar(permiso: Permiso, rol: Rol): void {
    const mapa = new Map(this.cambios());
    mapa.set(this.id(permiso.clave, rol), !this.estado(permiso, rol));
    this.cambios.set(mapa);
  }

  protected descartar(): void {
    this.cambios.set(new Map());
  }

  protected etiquetaRol(rol: Rol): string {
    return rol === 'PELUQUERO' ? 'Peluquero' : rol === 'ADMIN' ? 'Administrador' : 'Cliente';
  }

  protected guardar(): void {
    const cambios = this.pendientes();
    if (cambios.length === 0) return;

    this.guardando.set(true);
    this.feedback.set(null);
    this.permisoService.guardar(cambios).subscribe({
      next: (matriz) => {
        this.guardado.set(matriz);
        this.cambios.set(new Map());
        this.guardando.set(false);
        this.feedback.set({ texto: 'Permisos actualizados.', error: false });
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.feedback.set({
          texto: this.extraerError(err) ?? 'No se pudieron guardar los permisos.',
          error: true,
        });
      },
    });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.permisoService.matriz().subscribe({
      next: (matriz) => {
        this.guardado.set(matriz);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.feedback.set({
          texto: this.extraerError(err) ?? 'No se pudieron cargar los permisos.',
          error: true,
        });
      },
    });
  }

  private id(clave: ClavePermiso, rol: Rol): string {
    return `${clave}|${rol}`;
  }

  private extraerError(err: HttpErrorResponse): string | null {
    const cuerpo = err.error;
    if (typeof cuerpo === 'string') return cuerpo;
    return cuerpo?.mensaje ?? cuerpo?.message ?? null;
  }
}
