/**
 * Utilidades de fechas en formato ISO corto `YYYY-MM-DD`, que es el que usan el API
 * (`LocalDate`) y los calendarios de agendar.
 *
 * Todo se calcula en hora local a propósito: `toISOString()` convierte a UTC y
 * desplazaría el día en las zonas con offset positivo (España incluida).
 */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** `YYYY-MM-DD` de un `Date`, en hora local. */
export function aIsoFecha(fecha: Date): string {
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

/** Hoy como `YYYY-MM-DD`. */
export function hoyIso(): string {
  return aIsoFecha(new Date());
}

/** Suma meses a un `YYYY-MM-DD` y devuelve otro `YYYY-MM-DD`. */
export function sumarMeses(iso: string, meses: number): string {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return aIsoFecha(new Date(anio, mes - 1 + meses, dia));
}
