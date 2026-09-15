/** Días de la semana, con los nombres de `java.time.DayOfWeek` que usa el backend. */
export type DiaSemana =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

/** Los siete, de lunes a domingo, en el orden en que se presentan. */
export const DIAS_SEMANA: readonly DiaSemana[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export const NOMBRE_DIA: Record<DiaSemana, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

/**
 * Quién es esta peluquería. Lo sirve `GET /api/negocio`, que es **público**: las dos apps
 * pintan el nombre, el logo y el contacto antes de que nadie inicie sesión.
 *
 * Las horas llegan como `HH:mm:ss` (un `LocalTime` de Java), no como `Date`.
 */
export interface Negocio {
  nombre: string;
  eslogan: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  localidad: string | null;
  logoUrl: string | null;
  colorPrimario: string | null;
  horaApertura: string;
  horaCierre: string;
  /** Días en los que no se abre nunca. Vacío = se abre todos los días. */
  diasCerrados: DiaSemana[];
}

/**
 * Lo que manda el formulario del panel. Va entera: es una ficha corta que se edita de una
 * vez, y un envío parcial obligaría a distinguir «no lo mando» de «lo dejo vacío» en ocho
 * campos que casi todos son opcionales.
 */
export type ActualizarNegocio = Omit<Negocio, 'horaApertura' | 'horaCierre'> & {
  /** `HH:mm` vale: el backend acepta las horas sin segundos. */
  horaApertura: string;
  horaCierre: string;
};
