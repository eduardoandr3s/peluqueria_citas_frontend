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
    /**
     * NO QUITAR. Sin esto los specs comparten entorno y los `vi.mock` de los plugins de
     * Capacitor (`camara.service.spec.ts` y `fichero.service.spec.ts`) se pisan entre
     * ficheros: el mock deja de aplicarse, se llama al plugin real, y los tests expiran a
     * los 5 s. El builder deja `isolate` desactivado por velocidad; aqui se reactiva.
     *
     * El fallo depende de cuantos ficheros de test caen en el mismo worker, asi que **no se
     * reproduce en una maquina de escritorio y si en CI**, que tiene menos nucleos: anadir
     * un unico spec nuevo basto para romperlo. Para reproducirlo en local hay que forzar
     * `maxWorkers: 1`, y asi es como se diagnostico.
     *
     * Se probo tambien `pool: 'forks'`: no arregla nada y empeora (21 fallos). El problema
     * es el aislamiento, no el tipo de worker.
     *
     * El precio es tiempo de suite, barato comparado con un CI que falla segun el dia.
     */
    isolate: true,
    server: {
      deps: {
        inline: [/@ionic\/angular/, /@ionic\/core/, /ionicons/],
      },
    },
  },
});
