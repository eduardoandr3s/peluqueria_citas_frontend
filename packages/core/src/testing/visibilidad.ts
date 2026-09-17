/**
 * Simular que la pestaña o la app se va a segundo plano y vuelve, para los specs de lo que
 * escucha `alVolverAPrimerPlano`.
 *
 * `document.visibilityState` es de solo lectura, así que simularlo es **redefinir la
 * propiedad, y eso se queda pegado al documento**. El runner del builder corre los specs
 * sin aislar (`isolate` desactivado por velocidad), o sea que varios ficheros comparten el
 * mismo `document`: un spec que lo deje en `hidden` apaga el `visibilitychange` de todos
 * los que vengan detrás en ese worker.
 *
 * Pasó de verdad: `modulo.service.spec.ts` dejaba `hidden` y el que fallaba era
 * `negocio.service.spec.ts`, **solo en CI**, donde hay menos núcleos y los dos ficheros
 * caen en el mismo worker. En local pasaba en verde. Para reproducirlo hace falta
 * `runnerConfig` con `maxWorkers: 1`.
 *
 * Por eso esto vive aquí en vez de copiado en cada spec, y por eso **siempre hay que
 * restaurar en un `afterEach`**.
 */

/** Deja el documento en ese estado y avisa, como hace el navegador. */
export function volverAPrimerPlano(estado: DocumentVisibilityState = 'visible'): void {
  Object.defineProperty(document, 'visibilityState', { value: estado, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

/**
 * Devuelve el documento a su `visibilityState` de verdad. Va en el `afterEach` de todo spec
 * que use {@link volverAPrimerPlano}: sin esto el estado simulado se filtra al spec
 * siguiente.
 */
export function restaurarVisibilidad(): void {
  delete (document as unknown as Record<string, unknown>)['visibilityState'];
}
