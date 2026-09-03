import { Routes } from '@angular/router';
import { adminGuard, staffGuard } from '@peluqueria/core';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'recuperar',
    loadComponent: () =>
      import('./features/auth/recuperar/recuperar').then((m) => m.Recuperar),
  },
  {
    path: 'reset',
    loadComponent: () => import('./features/auth/reset/reset').then((m) => m.Reset),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/admin-layout/admin-layout').then((m) => m.AdminLayout),
    // La puerta del panel es ADMIN o PELUQUERO; las pantallas de administración
    // repiten `adminGuard` en su propia ruta, así que un peluquero que escriba la URL a
    // mano acaba en el login en vez de en una pantalla que iba a responder 403.
    canActivate: [staffGuard],
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      // Un peluquero no tiene dashboard (las estadísticas son de ADMIN): este redirector
      // manda a cada rol a su pantalla de entrada sin duplicar rutas.
      {
        path: 'inicio',
        loadComponent: () => import('./features/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'dashboard',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'citas',
        loadComponent: () => import('./features/citas/citas').then((m) => m.Citas),
      },
      {
        path: 'produccion',
        loadComponent: () =>
          import('./features/produccion/produccion').then((m) => m.ProduccionPagina),
      },
      {
        path: 'servicios',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/servicios/servicios').then((m) => m.Servicios),
      },
      {
        path: 'usuarios',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/usuarios/usuarios').then((m) => m.Usuarios),
      },
      {
        path: 'peluqueros',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/peluqueros/peluqueros').then((m) => m.Peluqueros),
      },
      {
        path: 'galeria',
        // La galería la comparte la plantilla: un peluquero entra a las suyas y lo que
        // puede hacer dentro lo dicen sus permisos, no la ruta.
        canActivate: [staffGuard],
        loadComponent: () => import('./features/galeria/galeria').then((m) => m.Galeria),
      },
      {
        path: 'permisos',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/permisos/permisos').then((m) => m.Permisos),
      },
      {
        path: 'bloqueos',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/bloqueos/bloqueos').then((m) => m.Bloqueos),
      },
      {
        path: 'perfil',
        loadComponent: () => import('./features/perfil/perfil').then((m) => m.Perfil),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
