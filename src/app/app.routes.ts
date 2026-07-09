import { Routes } from '@angular/router';
import { adminGuard } from '@peluqueria/core';

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
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'citas',
        loadComponent: () => import('./features/citas/citas').then((m) => m.Citas),
      },
      {
        path: 'servicios',
        loadComponent: () =>
          import('./features/servicios/servicios').then((m) => m.Servicios),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./features/usuarios/usuarios').then((m) => m.Usuarios),
      },
      {
        path: 'peluqueros',
        loadComponent: () =>
          import('./features/peluqueros/peluqueros').then((m) => m.Peluqueros),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
