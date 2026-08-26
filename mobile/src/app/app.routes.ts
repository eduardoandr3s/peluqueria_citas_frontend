import { Routes } from '@angular/router';
import {
  mobileAuthGuard,
  adminGuard,
  clientGuard,
  sessionRedirectGuard,
} from './guards/auth.guard';

export const routes: Routes = [
  // El destino de la raíz depende de la sesión: no puede ser un redirectTo fijo.
  { path: '', pathMatch: 'full', canActivate: [sessionRedirectGuard], children: [] },
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
      {
        path: 'recuperar',
        loadComponent: () =>
          import('./auth/recuperar/recuperar.page').then((m) => m.RecuperarPage),
      },
      {
        path: 'reset',
        loadComponent: () => import('./auth/reset/reset.page').then((m) => m.ResetPage),
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
        path: 'galeria',
        loadComponent: () => import('./galeria/galeria.page').then((m) => m.GaleriaPage),
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
        path: 'contacto',
        loadComponent: () => import('./contacto/contacto.page').then((m) => m.ContactoPage),
      },
      {
        path: 'asistente',
        loadComponent: () => import('./asistente/asistente.page').then((m) => m.AsistentePage),
      },
      {
        path: 'perfil',
        loadComponent: () => import('./perfil/perfil.page').then((m) => m.PerfilPage),
      },
      { path: '', redirectTo: 'servicios', pathMatch: 'full' },
    ],
  },
  // El asistente tambien fuera de /tabs y SIN guard. Su endpoint es publico porque se
  // pregunta por precios y horarios ANTES de registrarse, y todo /tabs exige sesion: sin
  // esta ruta ese diseno no lo aprovecharia ningun cliente. Es la unica pantalla, aparte
  // del login, a la que llega alguien que todavia no tiene cuenta.
  {
    path: 'asistente',
    loadComponent: () => import('./asistente/asistente.page').then((m) => m.AsistentePage),
  },
  {
    path: 'pago/:citaId',
    loadComponent: () => import('./pago/pago.page').then((m) => m.PagoPage),
  },
  { path: '**', redirectTo: '/auth/login' },
];
