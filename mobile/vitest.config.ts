import { defineConfig } from 'vitest/config';

/**
 * Config extra para el runner vitest del builder @angular/build:unit-test.
 *
 * Ionic se distribuye como ESM y hace "directory imports" (p.ej.
 * `@ionic/core/components`) que el loader nativo de Node no resuelve cuando el
 * paquete se trata como externo. Forzamos a Vite a transformar (inline) los
 * paquetes de Ionic/ionicons para que su propio resolutor maneje esos imports.
 */
export default defineConfig({
  test: {
    server: {
      deps: {
        inline: [/@ionic\/angular/, /@ionic\/core/, /ionicons/],
      },
    },
  },
});
