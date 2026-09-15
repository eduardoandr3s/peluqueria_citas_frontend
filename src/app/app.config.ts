import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  API_URL,
  AuthService,
  ModuloService,
  NegocioService,
  TOKEN_STORAGE,
  jwtInterceptor,
} from '@peluqueria/core';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    { provide: API_URL, useValue: environment.apiUrl },
    // Precarga el almacén de sesión y rehidrata el usuario antes de arrancar.
    provideAppInitializer(async () => {
      const storage = inject(TOKEN_STORAGE);
      const auth = inject(AuthService);
      const modulos = inject(ModuloService);
      const negocio = inject(NegocioService);
      await storage.init();
      auth.restoreSession();
      // Los módulos del negocio se esperan ANTES de pintar: si no, el menú y los botones
      // de lo que esta peluquería no usa aparecerían un instante y desaparecerían. No
      // dependen de la sesión, así que no van en el effect del usuario.
      // En paralelo: son dos peticiones públicas independientes y encadenarlas
      // duplicaría la espera con el backend dormido.
      await Promise.all([modulos.cargar(), negocio.cargar()]);
    }),
  ],
};
