import { Routes } from '@angular/router';
import { mobileAuthGuard, adminGuard, clientGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./auth/login/login.page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        loadComponent: () => import('./auth/register/register.page').then((m) => m.RegisterPage),
      },
    ],
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin-tabs.page').then((m) => m.AdminTabsPage),
    canActivate: [adminGuard],
    children: [
      {
        path: 'citas',
        loadComponent: () => import('./admin/citas/admin-citas.page').then((m) => m.AdminCitasPage),
      },
      {
        path: 'servicios',
        loadComponent: () =>
          import('./admin/servicios/admin-servicios.page').then((m) => m.AdminServiciosPage),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./admin/usuarios/admin-usuarios.page').then((m) => m.AdminUsuariosPage),
      },
      {
        path: 'perfil',
        loadComponent: () => import('./perfil/perfil.page').then((m) => m.PerfilPage),
      },
      { path: '', redirectTo: 'citas', pathMatch: 'full' },
    ],
  },
  {
    path: 'tabs',
    loadComponent: () => import('./tabs/tabs.page').then((m) => m.TabsPage),
    canActivate: [mobileAuthGuard, clientGuard],
    children: [
      {
        path: 'servicios',
        loadComponent: () => import('./servicios/servicios.page').then((m) => m.ServiciosPage),
      },
      {
        path: 'mis-citas',
        loadComponent: () => import('./mis-citas/mis-citas.page').then((m) => m.MisCitasPage),
      },
      {
        path: 'agendar',
        loadComponent: () => import('./agendar/agendar.page').then((m) => m.AgendarPage),
      },
      {
        path: 'perfil',
        loadComponent: () => import('./perfil/perfil.page').then((m) => m.PerfilPage),
      },
      { path: '', redirectTo: 'servicios', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '/auth/login' },
];
