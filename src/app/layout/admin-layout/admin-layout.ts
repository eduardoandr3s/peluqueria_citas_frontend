import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService, UsuarioService } from '@peluqueria/core';

interface NavItem {
  label: string;
  icon: string; // SVG path data (24x24 viewBox)
  /** Destino del enlace. Los grupos desplegables no navegan: llevan `children`. */
  path?: string;
  children?: NavItem[];
  /** Solo para ADMIN. Un PELUQUERO no ve la entrada, y su ruta le da el login. */
  soloAdmin?: boolean;
  /** Etiqueta alternativa para un PELUQUERO: «Citas» es «Mi agenda» cuando son las suyas. */
  labelPeluquero?: string;
}

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex min-h-screen bg-base text-main">
      <!-- Backdrop (móvil) -->
      @if (sidebarOpen()) {
        <div
          class="fixed inset-0 z-20 bg-black/60 lg:hidden"
          (click)="closeSidebar()"
        ></div>
      }

      <!-- Sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-line bg-surface text-muted transition-transform duration-200 lg:static lg:translate-x-0"
        [class.-translate-x-full]="!sidebarOpen()"
      >
        <div class="flex h-16 items-center justify-center border-b border-line px-4">
          <a
            [routerLink]="rutaInicio()"
            (click)="closeSidebar()"
            class="rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Ir al inicio"
          >
            <img
              src="logo.png"
              alt="Lalo Segovia · Panel Admin"
              class="h-12 w-auto max-w-full object-contain"
            />
          </a>
        </div>

        <nav class="flex-1 space-y-1 px-3 py-4">
          @for (item of navItemsVisibles(); track item.label) {
            @if (item.children; as hijos) {
              <!-- Grupo desplegable: el propio encabezado no navega -->
              <button
                type="button"
                (click)="toggleGrupo(item.label)"
                class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-elevated hover:text-main"
                [attr.aria-expanded]="grupoAbierto(item.label)"
              >
                <svg
                  class="h-5 w-5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.8"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.icon" />
                </svg>
                {{ item.label }}
                <svg
                  class="ml-auto h-4 w-4 shrink-0 transition-transform"
                  [class.rotate-180]="grupoAbierto(item.label)"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              @if (grupoAbierto(item.label)) {
                <div class="ml-4 space-y-1 border-l border-line pl-3">
                  @for (hijo of hijos; track hijo.path) {
                    <a
                      [routerLink]="hijo.path"
                      routerLinkActive="bg-primary/15 text-main"
                      (click)="closeSidebar()"
                      class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-elevated hover:text-main"
                    >
                      <svg
                        class="h-4 w-4 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.8"
                        stroke="currentColor"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="hijo.icon" />
                      </svg>
                      {{ hijo.label }}
                    </a>
                  }
                </div>
              }
            } @else {
              <a
                [routerLink]="item.path"
                routerLinkActive="bg-primary/15 text-main"
                (click)="closeSidebar()"
                class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-elevated hover:text-main"
              >
                <svg
                  class="h-5 w-5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.8"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.icon" />
                </svg>
                {{ item.label }}
              </a>
            }
          }
        </nav>

        <div class="border-t border-line p-3">
          <button
            type="button"
            (click)="logout()"
            class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-main"
          >
            <svg
              class="h-5 w-5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.8"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
              />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <!-- Contenido -->
      <div class="flex flex-1 flex-col lg:pl-0">
        <header
          class="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-surface px-4 sm:px-6"
        >
          <button
            type="button"
            (click)="toggleSidebar()"
            class="rounded-lg p-2 text-muted hover:bg-elevated lg:hidden"
            aria-label="Abrir menú"
          >
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <div class="ml-auto flex items-center gap-3">
            <div class="text-right leading-tight">
              <p class="text-sm font-semibold text-main">{{ nombre() }}</p>
              <p class="text-xs text-muted">{{ email() }}</p>
            </div>
            <a
              routerLink="/perfil"
              class="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Ir a mi perfil"
            >
              @if (avatarUrl(); as url) {
                <img
                  [src]="url"
                  [alt]="nombre()"
                  class="h-9 w-9 rounded-full object-cover ring-1 ring-line"
                />
              } @else {
                <span
                  class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary"
                  >{{ iniciales() }}</span
                >
              }
            </a>
          </div>
        </header>

        <main class="flex-1 p-4 sm:p-6 lg:p-8">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AdminLayout {
  private readonly auth = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly router = inject(Router);

  protected readonly sidebarOpen = signal(false);

  constructor() {
    // El layout se construye una vez por sesión cargada, así que esta es una
    // petición y no una por navegación. Si ya hay avatar (venimos de cambiarlo en
    // «Mi perfil»), no se vuelve a pedir.
    if (this.auth.avatarUrl() === null) {
      this.usuarioService.me().subscribe({
        next: (u) => this.auth.setAvatarUrl(u.urlAvatar ?? null),
        error: () => {
          // Sin foto se pintan las iniciales; no hay nada que avisar al usuario.
        },
      });
    }
  }

  protected readonly nombre = computed(() => this.auth.user()?.nombre ?? 'Administrador');
  protected readonly esAdmin = this.auth.isAdmin;
  /** El logo lleva al inicio de cada rol: un peluquero no puede entrar al dashboard. */
  protected readonly rutaInicio = computed(() => (this.auth.isAdmin() ? '/dashboard' : '/citas'));
  protected readonly email = computed(() => this.auth.user()?.email ?? '');
  /**
   * La URL firmada del avatar no viene en la sesión (caduca), así que se pide una
   * vez al entrar al panel; a partir de ahí la mantiene «Mi perfil» al cambiar la
   * foto. Si falla, se queda con las iniciales: es decoración, no bloquea nada.
   */
  protected readonly avatarUrl = this.auth.avatarUrl;
  protected readonly iniciales = computed(() => {
    const n = this.auth.user()?.nombre?.trim() ?? '';
    if (!n) return 'A';
    const parts = n.split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  });

  private readonly navItems: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      soloAdmin: true,
      icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
    },
    {
      label: 'Citas',
      labelPeluquero: 'Mi agenda',
      path: '/citas',
      icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0V11.25A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
    },
    {
      label: 'Producción',
      labelPeluquero: 'Mi producción',
      path: '/produccion',
      // Gráfico de barras ascendente.
      icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
    },
    {
      label: 'Servicios',
      soloAdmin: true,
      path: '/servicios',
      // Tijeras: la tuerca de antes se ha ido al menu «Configuracion».
      icon: 'M7.848 8.25l1.536.887M7.848 8.25a3 3 0 1 1-5.196-3 3 3 0 0 1 5.196 3Zm1.536.887a2.165 2.165 0 0 1 1.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Zm1.536-.887a2.165 2.165 0 0 0 1.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863l2.077-1.199m0-3.328a4.323 4.323 0 0 1 2.068-1.379l5.325-1.628a4.5 4.5 0 0 1 2.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.33 4.33 0 0 0 10.607 12m3.736 0l7.794 4.5-.802.215a4.5 4.5 0 0 1-2.48-.043l-5.326-1.629a4.324 4.324 0 0 1-2.068-1.379M14.343 12l-2.882 1.664',
    },
    {
      label: 'Usuarios',
      path: '/usuarios',
      soloAdmin: true,
      icon: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
    },
    {
      label: 'Peluqueros',
      path: '/peluqueros',
      soloAdmin: true,
      icon: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
    },
    {
      label: 'Configuración',
      // La tuerca que antes estaba en «Servicios».
      icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.397-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.241.437-.613.43-.992a7.723 7.723 0 0 1 0-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
      children: [
        {
          label: 'Galería',
          path: '/galeria',
          soloAdmin: true,
          icon: 'm2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M18 6h.008v.008H18V6Zm2.25 12H3.75A1.5 1.5 0 0 1 2.25 16.5v-9A1.5 1.5 0 0 1 3.75 6h16.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5Z',
        },
        {
          label: 'Días cerrados',
          path: '/bloqueos',
          soloAdmin: true,
          icon: 'M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.25-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z',
        },
        {
          label: 'Permisos',
          path: '/permisos',
          soloAdmin: true,
          icon: 'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z',
        },
        {
          label: 'Mi perfil',
          path: '/perfil',
          icon: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
        },
      ],
    },
  ];

  /**
   * El menú del rol de la sesión. Ocultar una entrada no es seguridad —la puerta son los
   * guards y, sobre todo, el backend— pero enseñarle a un peluquero enlaces que le van a
   * dar 403 sí es un panel roto. Se filtran también los hijos, y un grupo que se queda sin
   * ninguno desaparece: «Configuración» con nada dentro sería un desplegable vacío.
   */
  protected readonly navItemsVisibles = computed<NavItem[]>(() => {
    const esAdmin = this.auth.isAdmin();
    return this.navItems
      .filter((item) => esAdmin || !item.soloAdmin)
      .map((item) => ({
        ...item,
        label: !esAdmin && item.labelPeluquero ? item.labelPeluquero : item.label,
        children: item.children?.filter((hijo) => esAdmin || !hijo.soloAdmin),
      }))
      .filter((item) => !item.children || item.children.length > 0);
  });

  /** Grupos del menú desplegados. Un grupo arranca abierto si la ruta actual es de un hijo suyo. */
  private readonly gruposAbiertos = signal<ReadonlySet<string>>(
    new Set(
      this.navItems
        .filter((item) => item.children?.some((h) => this.router.url.startsWith(h.path!)))
        .map((item) => item.label),
    ),
  );

  protected grupoAbierto(label: string): boolean {
    return this.gruposAbiertos().has(label);
  }

  protected toggleGrupo(label: string): void {
    this.gruposAbiertos.update((abiertos) => {
      const siguiente = new Set(abiertos);
      if (!siguiente.delete(label)) siguiente.add(label);
      return siguiente;
    });
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
