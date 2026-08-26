/**
 * Formato de importes en euros, uno solo para las dos aplicaciones.
 *
 * Existe porque el formato venía saliendo de dos sitios distintos: el pipe
 * `number`, que depende del `LOCALE_ID` que registre cada app, y `toFixed(2)`,
 * que siempre pone punto. El panel no registra el locale español y el móvil sí,
 * así que el mismo precio se veía «15.00 €» en un sitio y «15,00 €» en otro.
 *
 * El separador se fija aquí a `es-ES` en vez de dejarlo en manos del locale de
 * cada app: el negocio factura en España y el formato de un importe no debería
 * cambiar según por qué pantalla se mire.
 */

const FORMATO = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `15` → `«15,00»`. Sin símbolo, para cuando la plantilla ya pone el «€». */
export function formatearImporte(valor: number): string {
  return FORMATO.format(valor ?? 0);
}

/** `15` → `«15,00 €»`. */
export function formatearEuros(valor: number): string {
  return `${formatearImporte(valor)} €`;
}
