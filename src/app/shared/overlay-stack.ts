import { DestroyRef, inject, signal } from '@angular/core';

/**
 * Pila de modales abiertos. Sirve para que la tecla Escape cierre solo el de arriba: sin
 * esto, todos escuchan el mismo evento de documento y abrir el detalle de una cita sobre
 * una lista haría que Escape cerrase los dos de golpe.
 */
const pila = signal<symbol[]>([]);

/**
 * Registra el modal que la llama y lo desapila al destruirse. Devuelve una función que
 * dice si este modal es el de más arriba, es decir, a quién le toca atender el Escape.
 */
export function registrarOverlay(): () => boolean {
  const id = Symbol('overlay');
  pila.update((actual) => [...actual, id]);
  inject(DestroyRef).onDestroy(() => pila.update((actual) => actual.filter((x) => x !== id)));
  return () => pila()[pila().length - 1] === id;
}
