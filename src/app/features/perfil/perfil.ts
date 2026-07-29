import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AuthService, Usuario, UsuarioService, redimensionarImagen } from '@peluqueria/core';

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

/** Un avatar no necesita 1200 px: con 512 sobra para el círculo más grande que se pinta. */
const LADO_AVATAR = 512;

@Component({
  selector: 'app-perfil',
  imports: [DatePipe],
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
    </div>
  `,
})
export class Perfil implements OnInit {
  private readonly usuarioService = inject(UsuarioService);
  private readonly auth = inject(AuthService);

  protected readonly usuario = signal<Usuario | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly subiendo = signal(false);
  protected readonly fotoError = signal<string | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);

  protected readonly iniciales = computed(() => {
    const nombre = this.usuario()?.nombre?.trim() ?? '';
    if (!nombre) return '?';
    const partes = nombre.split(/\s+/);
    return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase();
  });

  ngOnInit(): void {
    this.cargar();
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
