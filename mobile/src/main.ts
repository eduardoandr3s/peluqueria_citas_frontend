import { LOCALE_ID, inject, provideAppInitializer } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { API_URL, AuthService, TOKEN_STORAGE, jwtInterceptor } from '@peluqueria/core';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { PreferencesTokenStorage } from './app/core/preferences-token-storage';

// Datos de locale español: necesarios para DatePipe con formato 'es'.
registerLocaleData(localeEs);

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: LOCALE_ID, useValue: 'es' },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    { provide: API_URL, useValue: environment.apiUrl },
    // En móvil la sesión vive en el almacén nativo (@capacitor/preferences).
    { provide: TOKEN_STORAGE, useClass: PreferencesTokenStorage },
    // Precarga el almacén (async) y rehidrata el usuario antes de arrancar.
    provideAppInitializer(async () => {
      const storage = inject(TOKEN_STORAGE);
      const auth = inject(AuthService);
      await storage.init();
      auth.restoreSession();
    }),
  ],
});
