import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { API_URL, AuthService, TOKEN_STORAGE, jwtInterceptor } from '@peluqueria/core';

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
      await storage.init();
      auth.restoreSession();
    }),
  ],
};
