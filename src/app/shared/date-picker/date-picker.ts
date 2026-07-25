import { Component, computed, forwardRef, input, output, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DiaCerrado, aIsoFecha } from '@peluqueria/core';

interface Celda {
  /** Fecha ISO `YYYY-MM-DD`, o cadena vacía en los huecos de relleno del inicio del mes. */
  fecha: string;
  dia: number;
  /** No se puede elegir: es anterior a `min` o la peluquería no abre. */
  deshabilitado: boolean;
  /** Motivo del cierre para el tooltip, si está cerrado. */
  motivo: string;
}

/** `YYYY-MM-DD` de un día del mes visible (mes 0-11). */
function aIso(anio: number, mes: number, dia: number): string {
  return aIsoFecha(new Date(anio, mes, dia));
}

/**
 * Calendario de un mes para elegir una fecha. Los días en los que la peluquería no
 * abre (domingos y festivos/cierres puntuales) se pintan deshabilitados y **no se
 * pueden seleccionar**, que es lo que un `<input type="date">` nativo no permite hacer.
 *
 * Se usa con Reactive Forms (`formControlName`); el valor es un ISO `YYYY-MM-DD`.
 */
@Component({
  selector: 'app-date-picker',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatePicker), multi: true },
  ],
  template: `
    <div class="rounded-lg border border-line bg-base p-3">
      <!-- Cabecera: mes y navegación -->
      <div class="flex items-center justify-between">
        <button
          type="button"
          [disabled]="!puedeRetroceder()"
          (click)="cambiarMes(-1)"
          aria-label="Mes anterior"
          class="rounded-md px-2 py-1 text-sm text-main transition hover:bg-elevated disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ‹
        </button>
        <span class="text-sm font-semibold capitalize text-main">{{ etiquetaMes() }}</span>
        <button
          type="button"
          [disabled]="!puedeAvanzar()"
          (click)="cambiarMes(1)"
          aria-label="Mes siguiente"
          class="rounded-md px-2 py-1 text-sm text-main transition hover:bg-elevated disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ›
        </button>
      </div>

      <!-- Días de la semana (empieza en lunes) -->
      <div class="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted">
        @for (d of diasSemana; track d) {
          <span>{{ d }}</span>
        }
      </div>

      <!-- Rejilla del mes -->
      <div class="mt-1 grid grid-cols-7 gap-1">
        @for (celda of celdas(); track $index) {
          @if (!celda.fecha) {
            <span></span>
          } @else if (celda.deshabilitado) {
            <span
              [title]="celda.motivo"
              class="flex h-9 cursor-not-allowed items-center justify-center rounded-md text-sm text-muted line-through opacity-50"
              >{{ celda.dia }}</span
            >
          } @else {
            <button
              type="button"
              [disabled]="deshabilitado()"
              (click)="seleccionar(celda.fecha)"
              class="flex h-9 items-center justify-center rounded-md text-sm font-medium transition disabled:opacity-40"
              [class]="
                valor() === celda.fecha
                  ? 'bg-primary text-white'
                  : 'text-main hover:bg-elevated'
              "
            >
              {{ celda.dia }}
            </button>
          }
        }
      </div>

      <p class="mt-3 text-xs text-muted">Los días tachados están cerrados (domingos y festivos).</p>
    </div>
  `,
})
export class DatePicker implements ControlValueAccessor {
  /** Primera fecha seleccionable (ISO `YYYY-MM-DD`). Normalmente hoy. */
  readonly min = input<string>('');
  /** Días cerrados conocidos, tal como los devuelve el backend. */
  readonly diasCerrados = input<DiaCerrado[]>([]);
  /** Meses hacia delante que se pueden navegar (debe cubrir el rango pedido al backend). */
  readonly maxMeses = input<number>(12);

  /** Se emite tras propagar el valor al formulario, para recargar las horas libres. */
  readonly fechaElegida = output<string>();

  protected readonly diasSemana = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  protected readonly valor = signal('');
  protected readonly deshabilitado = signal(false);

  /** Mes al que ha navegado el usuario; si es null, manda la fecha elegida (o `min`). */
  private readonly mesForzado = signal<{ anio: number; mes: number } | null>(null);

  /** Mes visible, como {anio, mes} con mes 0-11. */
  protected readonly mesVisible = computed(() => {
    const forzado = this.mesForzado();
    if (forzado) return forzado;
    // Sin navegación explícita: el mes de la fecha elegida, o el de la primera
    // seleccionable. Es un computed para no depender del orden en que Angular
    // asigna los inputs y llama a writeValue.
    const referencia = this.valor() || this.min();
    return this.mesDe(referencia ? new Date(`${referencia}T00:00:00`) : new Date());
  });

  private readonly cerradosPorFecha = computed(
    () => new Map(this.diasCerrados().map((d) => [d.fecha, d.motivo])),
  );

  protected readonly etiquetaMes = computed(() => {
    const { anio, mes } = this.mesVisible();
    return new Date(anio, mes, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  });

  protected readonly celdas = computed<Celda[]>(() => {
    const { anio, mes } = this.mesVisible();
    const min = this.min();
    const cerrados = this.cerradosPorFecha();

    // Huecos iniciales para que el día 1 caiga en su columna (semana de lunes a domingo).
    const offset = (new Date(anio, mes, 1).getDay() + 6) % 7;
    const total = new Date(anio, mes + 1, 0).getDate();

    const celdas: Celda[] = Array.from({ length: offset }, () => ({
      fecha: '',
      dia: 0,
      deshabilitado: true,
      motivo: '',
    }));

    for (let dia = 1; dia <= total; dia++) {
      const fecha = aIso(anio, mes, dia);
      const motivo = cerrados.get(fecha);
      const pasado = !!min && fecha < min;
      celdas.push({
        fecha,
        dia,
        deshabilitado: pasado || motivo !== undefined,
        motivo: motivo ?? '',
      });
    }
    return celdas;
  });

  protected readonly puedeRetroceder = computed(() => {
    const min = this.min();
    if (!min) return true;
    const { anio, mes } = this.mesVisible();
    // No se retrocede a un mes que ya está entero por detrás de min.
    return aIso(anio, mes, 1) > `${min.slice(0, 7)}-01`;
  });

  protected readonly puedeAvanzar = computed(() => {
    const { anio, mes } = this.mesVisible();
    const base = this.min() ? new Date(this.min() + 'T00:00:00') : new Date();
    const limite = new Date(base.getFullYear(), base.getMonth() + this.maxMeses(), 1);
    return new Date(anio, mes, 1) < limite;
  });

  private onChange: (valor: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(valor: string | null): void {
    this.valor.set(valor ?? '');
    // Al abrir el formulario con otra fecha (reprogramar) se muestra su mes, aunque el
    // usuario hubiese navegado a otro antes.
    this.mesForzado.set(null);
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }

  protected seleccionar(fecha: string): void {
    this.valor.set(fecha);
    this.onChange(fecha);
    this.onTouched();
    this.fechaElegida.emit(fecha);
  }

  protected cambiarMes(delta: number): void {
    const { anio, mes } = this.mesVisible();
    this.mesForzado.set(this.mesDe(new Date(anio, mes + delta, 1)));
  }

  private mesDe(fecha: Date): { anio: number; mes: number } {
    return { anio: fecha.getFullYear(), mes: fecha.getMonth() };
  }
}
