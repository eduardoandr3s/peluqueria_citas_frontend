import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AuthService,
  PeluqueroCv,
  PeluqueroCvUpdate,
  PeluqueroService,
  PermisoService,
  Usuario,
  UsuarioService,
  redimensionarImagen,
} from '@peluqueria/core';
import { CvEditor, LADO_FOTO_CV } from '../../shared/cv-editor/cv-editor';

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

/** Un avatar no necesita 1200 px: con 512 sobra para el círculo más grande que se pinta. */
const LADO_AVATAR = 512;

@Component({
  selector: 'app-perfil',
  imports: [DatePipe, CvEditor],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-main">Mi perfil</h1>
        <p class="text-sm text-muted">Tus datos de acceso y tu foto de perfil.</p>
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

      <div class="rounded-xl bg-surface p-6 shadow-sm ring-1 ring-line">
        @if (loading()) {
          <div class="flex items-center gap-6">
            <div class="h-28 w-28 animate-pulse rounded-full bg-elevated"></div>
            <div class="flex-1 space-y-3">
              @for (i of [1, 2, 3]; track i) {
                <div class="h-4 max-w-xs animate-pulse rounded bg-elevated"></div>
              }
            </div>
          </div>
        } @else if (loadError()) {
          <div class="py-6 text-center">
            <p class="text-sm text-error">{{ loadError() }}</p>
            <button
              type="button"
              (click)="cargar()"
              class="mt-3 rounded-lg bg-elevated px-4 py-2 text-sm font-medium text-main hover:bg-line"
            >
              Reintentar
            </button>
          </div>
        } @else if (usuario(); as u) {
          <div class="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div class="flex flex-col items-center gap-3">
              @if (u.urlAvatar) {
                <img
                  [src]="u.urlAvatar"
                  [alt]="u.nombre"
                  class="h-28 w-28 rounded-full object-cover ring-1 ring-line"
                />
              } @else {
                <span
                  class="flex h-28 w-28 items-center justify-center rounded-full bg-primary/15 text-3xl font-bold text-primary"
                  >{{ iniciales() }}</span
                >
              }

              <div class="flex items-center gap-2">
                <label
                  class="cursor-pointer rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover"
                  [class.opacity-60]="subiendo()"
                >
                  {{ subiendo() ? 'Subiendo…' : u.urlAvatar ? 'Sustituir' : 'Subir foto' }}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    class="hidden"
                    [disabled]="subiendo()"
                    (change)="onFotoElegida($event)"
                  />
                </label>
                @if (u.urlAvatar) {
                  <button
                    type="button"
                    (click)="quitarFoto()"
                    [disabled]="subiendo()"
                    class="rounded-lg px-3.5 py-2 text-xs font-medium text-error hover:bg-error/10 disabled:opacity-60"
                  >
                    Quitar
                  </button>
                }
              </div>

              @if (fotoError()) {
                <p class="max-w-[14rem] text-center text-xs text-error">{{ fotoError() }}</p>
              }
              <p class="max-w-[14rem] text-center text-xs text-muted">
                JPEG, PNG o WebP. Se reduce en tu navegador antes de subirla.
              </p>
            </div>

            <dl class="flex-1 divide-y divide-line text-sm">
              <div class="flex justify-between gap-4 py-2.5">
                <dt class="text-muted">Nombre</dt>
                <dd class="font-medium text-main">{{ u.nombre }}</dd>
              </div>
              <div class="flex justify-between gap-4 py-2.5">
                <dt class="text-muted">Email</dt>
                <dd class="text-main">{{ u.email }}</dd>
              </div>
              <div class="flex justify-between gap-4 py-2.5">
                <dt class="text-muted">Teléfono</dt>
                <dd class="text-main">{{ u.telefono || '—' }}</dd>
              </div>
              <div class="flex justify-between gap-4 py-2.5">
                <dt class="text-muted">Rol</dt>
                <dd>
                  <span
                    class="inline-flex rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary"
                    >{{ u.rol }}</span
                  >
                </dd>
              </div>
              <div class="flex justify-between gap-4 py-2.5">
                <dt class="text-muted">Alta</dt>
                <dd class="text-main">
                  {{ u.fechaRegistro ? (u.fechaRegistro | date: 'dd/MM/yyyy') : '—' }}
                </dd>
              </div>
            </dl>
          </div>
        }
      </div>

      <!-- CV público. Solo aparece si esta cuenta tiene ficha de peluquero: un ADMIN que
           no corta pelo no tiene nada que presentar, y el endpoint le responde 404. -->
      @if (cv(); as miCv) {
        <div class="rounded-xl bg-surface p-6 shadow-sm ring-1 ring-line">
          <div class="mb-4">
            <h2 class="text-lg font-semibold text-main">Mi CV público</h2>
            <p class="text-sm text-muted">
              Lo que ve un cliente en «Equipo» para elegir con quién agendar. Se ve
              <strong>sin cuenta</strong>, así que no pongas aquí nada que no quieras público.
            </p>
          </div>

          @if (!puedeEditarCv()) {
            <div class="mb-4 rounded-lg bg-elevated px-4 py-3 text-xs text-muted">
              Rellenar tu CV no está habilitado para tu rol todavía: puedes ver lo que hay
              escrito, y cambiarlo lo hace un administrador desde tu ficha.
            </div>
          }

          @if (!miCv.activo) {
            <div class="mb-4 rounded-lg bg-error/15 px-4 py-3 text-xs text-error">
              Tu ficha está desactivada, así que no apareces en «Equipo» aunque rellenes esto.
            </div>
          }

          <app-cv-editor
            [cv]="miCv"
            [puedeEditar]="puedeEditarCv()"
            [guardando]="guardandoCv()"
            [subiendoFoto]="subiendoFotoCv()"
            (guardar)="guardarCv($event)"
            (fotoElegida)="subirFotoCv($event)"
            (quitarFoto)="quitarFotoCv()"
          />
        </div>
      }
    </div>
  `,
})
export class Perfil implements OnInit {
  private readonly usuarioService = inject(UsuarioService);
  private readonly auth = inject(AuthService);
  private readonly peluqueroService = inject(PeluqueroService);
  private readonly permisos = inject(PermisoService);

  protected readonly usuario = signal<Usuario | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly subiendo = signal(false);
  protected readonly fotoError = signal<string | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);

  /** null mientras no se sabe, o si esta cuenta no tiene ficha de peluquero. */
  protected readonly cv = signal<PeluqueroCv | null>(null);
  protected readonly guardandoCv = signal(false);
  protected readonly subiendoFotoCv = signal(false);
  /** Ocultar el botón no es seguridad: quien decide de verdad es el backend. */
  protected readonly puedeEditarCv = this.permisos.puede('PERFIL_CV_EDITAR');

  protected readonly iniciales = computed(() => {
    const nombre = this.usuario()?.nombre?.trim() ?? '';
    if (!nombre) return '?';
    const partes = nombre.split(/\s+/);
    return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase();
  });

  ngOnInit(): void {
    this.cargar();
    this.cargarCv();
  }

  /**
   * El CV de la ficha vinculada a esta cuenta. Un 404 no es un error a mostrar: significa
   * que esta cuenta no tiene ficha de peluquero (un administrador que no corta pelo), y
   * entonces el bloque entero no se pinta.
   */
  private cargarCv(): void {
    this.peluqueroService.miCv().subscribe({
      next: (cv) => this.cv.set(cv),
      error: () => this.cv.set(null),
    });
  }

  protected cargar(): void {
    this.loading.set(true);
    this.loadError.set(null);
    // `me()` en vez de `obtener(id)`: la sesión guarda el email, no el id, y este es
    // el único endpoint que resuelve al usuario a partir del token.
    this.usuarioService.me().subscribe({
      next: (u) => {
        this.aplicar(u);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No se pudo cargar tu perfil.');
        this.loading.set(false);
      },
    });
  }

  protected async onFotoElegida(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const fichero = input.files?.[0];
    // Permite volver a elegir el mismo fichero si la subida falla.
    input.value = '';
    const u = this.usuario();
    if (!fichero || !u) return;

    this.fotoError.set(null);
    this.subiendo.set(true);
    const reducida = await redimensionarImagen(fichero, LADO_AVATAR);

    this.usuarioService.subirAvatar(u.idUsuario, reducida).subscribe({
      next: (actualizado) => {
        this.subiendo.set(false);
        this.aplicar(actualizado);
        this.feedback.set({ type: 'success', text: 'Foto de perfil actualizada.' });
      },
      error: (err: HttpErrorResponse) => {
        this.subiendo.set(false);
        this.fotoError.set(
          err.status === 413
            ? 'La imagen es demasiado grande.'
            : (this.extraerError(err) ?? 'No se pudo subir la foto.'),
        );
      },
    });
  }

  protected quitarFoto(): void {
    const u = this.usuario();
    if (!u) return;

    this.fotoError.set(null);
    this.subiendo.set(true);
    this.usuarioService.borrarAvatar(u.idUsuario).subscribe({
      next: (actualizado) => {
        this.subiendo.set(false);
        this.aplicar(actualizado);
        this.feedback.set({ type: 'success', text: 'Foto de perfil eliminada.' });
      },
      error: (err: HttpErrorResponse) => {
        this.subiendo.set(false);
        this.fotoError.set(this.extraerError(err) ?? 'No se pudo quitar la foto.');
      },
    });
  }

  // ---- CV público ----

  protected guardarCv(cambios: PeluqueroCvUpdate): void {
    this.guardandoCv.set(true);
    this.peluqueroService.guardarMiCv(cambios).subscribe({
      next: (cv) => {
        this.guardandoCv.set(false);
        this.cv.set(cv);
        this.feedback.set({ type: 'success', text: 'CV público actualizado.' });
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoCv.set(false);
        this.feedback.set({
          type: 'error',
          text: this.extraerError(err) ?? 'No se pudo guardar tu CV.',
        });
      },
    });
  }

  /**
   * La foto va en su propia petición y se guarda al elegirla. Se manda con el id de la
   * ficha porque el endpoint del multipart es `/peluqueros/{id}/foto`; el servidor
   * comprueba que sea la suya, así que pasar el id no abre nada.
   */
  protected async subirFotoCv(fichero: File): Promise<void> {
    const actual = this.cv();
    if (!actual) return;

    this.subiendoFotoCv.set(true);
    const reducida = await redimensionarImagen(fichero, LADO_FOTO_CV);
    this.peluqueroService.subirFoto(actual.idPeluquero, reducida).subscribe({
      next: (cv) => {
        this.subiendoFotoCv.set(false);
        this.cv.set(cv);
      },
      error: (err: HttpErrorResponse) => {
        this.subiendoFotoCv.set(false);
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

  protected quitarFotoCv(): void {
    const actual = this.cv();
    if (!actual) return;

    this.subiendoFotoCv.set(true);
    this.peluqueroService.borrarFoto(actual.idPeluquero).subscribe({
      next: (cv) => {
        this.subiendoFotoCv.set(false);
        this.cv.set(cv);
      },
      error: (err: HttpErrorResponse) => {
        this.subiendoFotoCv.set(false);
        this.feedback.set({
          type: 'error',
          text: this.extraerError(err) ?? 'No se pudo quitar la foto.',
        });
      },
    });
  }

  /** Guarda el usuario y publica su avatar, que es lo que pinta la cabecera. */
  private aplicar(u: Usuario): void {
    this.usuario.set(u);
    this.auth.setAvatarUrl(u.urlAvatar ?? null);
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
