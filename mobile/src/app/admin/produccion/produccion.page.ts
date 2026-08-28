import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonList,
  IonItem,
  IonNote,
  IonSpinner,
  IonSelect,
  IonSelectOption,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';
import {
  AuthService,
  Peluquero,
  PeluqueroService,
  Produccion,
  ProduccionPeluquero,
  ProduccionService,
  formatearEuros,
} from '@peluqueria/core';

/** Rangos ofrecidos. El mes es la unidad en la que se liquida, así que es el de partida. */
type Rango = 'mes' | 'mesAnterior' | 'anio';

@Component({
  selector: 'app-produccion',
  templateUrl: './produccion.page.html',
  styleUrls: ['./produccion.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonSegment, IonSegmentButton,
    IonLabel, IonList, IonItem, IonNote, IonSpinner, IonSelect, IonSelectOption,
    IonRefresher, IonRefresherContent,
  ],
})
export class ProduccionPage {
  private readonly produccionService = inject(ProduccionService);
  private readonly peluqueroService = inject(PeluqueroService);
  private readonly auth = inject(AuthService);

  readonly esAdmin = this.auth.isAdmin;
  readonly loading = signal(true);
  readonly error = signal('');

  /** Una de las dos está a null: o se ve un peluquero, o la plantilla entera. */
  readonly produccion = signal<Produccion | null>(null);
  readonly comparativa = signal<ProduccionPeluquero[] | null>(null);

  readonly peluqueros = signal<Peluquero[]>([]);
  /** null = toda la plantilla (solo ADMIN). Un peluquero se ve siempre a sí mismo. */
  readonly peluqueroSeleccionado = signal<number | null>(null);

  readonly rango = signal<Rango>('mes');
  readonly rangos: { value: Rango; label: string }[] = [
    { value: 'mes', label: 'Este mes' },
    { value: 'mesAnterior', label: 'Mes ant.' },
    { value: 'anio', label: 'Año' },
  ];

  readonly totalVendido = computed(() =>
    (this.comparativa() ?? []).reduce((suma, f) => suma + f.importeVendido, 0),
  );
  readonly totalComision = computed(() =>
    (this.comparativa() ?? []).reduce((suma, f) => suma + f.comision, 0),
  );

  ionViewWillEnter(): void {
    if (this.esAdmin() && this.peluqueros().length === 0) {
      this.peluqueroService.listar().subscribe({
        next: (lista) => this.peluqueros.set(lista),
        // El selector es una comodidad: sin él se sigue viendo la comparativa.
        error: () => {},
      });
    }
    this.cargar();
  }

  cargar(event?: CustomEvent): void {
    this.loading.set(true);
    this.error.set('');
    const [desde, hasta] = this.fechasDelRango();
    const terminar = () => {
      this.loading.set(false);
      (event?.target as HTMLIonRefresherElement)?.complete();
    };

    if (!this.esAdmin()) {
      this.produccionService.mia(desde, hasta).subscribe({
        next: (p) => {
          this.comparativa.set(null);
          this.produccion.set(p);
          terminar();
        },
        error: (err: HttpErrorResponse) => this.fallo(err, terminar),
      });
      return;
    }

    const id = this.peluqueroSeleccionado();
    if (id == null) {
      this.produccionService.comparativa(desde, hasta).subscribe({
        next: (filas) => {
          this.produccion.set(null);
          this.comparativa.set(filas);
          terminar();
        },
        error: (err: HttpErrorResponse) => this.fallo(err, terminar),
      });
      return;
    }

    this.produccionService.dePeluquero(id, desde, hasta).subscribe({
      next: (p) => {
        this.comparativa.set(null);
        this.produccion.set(p);
        terminar();
      },
      error: (err: HttpErrorResponse) => this.fallo(err, terminar),
    });
  }

  cambiarRango(rango: Rango): void {
    this.rango.set(rango);
    this.cargar();
  }

  cambiarPeluquero(id: number | null): void {
    this.peluqueroSeleccionado.set(id);
    this.cargar();
  }

  euros(valor: number): string {
    return formatearEuros(valor);
  }

  /** `2026-08` → `agosto 2026`. */
  mes(etiqueta: string): string {
    const [anio, mes] = etiqueta.split('-').map(Number);
    if (!anio || !mes) return etiqueta;
    const nombre = new Date(anio, mes - 1, 1).toLocaleDateString('es-ES', { month: 'long' });
    return `${nombre} ${anio}`;
  }

  private fechasDelRango(): [string, string] {
    const ahora = new Date();
    if (this.rango() === 'mesAnterior') {
      return [
        iso(new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)),
        iso(new Date(ahora.getFullYear(), ahora.getMonth(), 0)),
      ];
    }
    if (this.rango() === 'anio') {
      return [iso(new Date(ahora.getFullYear(), 0, 1)), iso(ahora)];
    }
    return [iso(new Date(ahora.getFullYear(), ahora.getMonth(), 1)), iso(ahora)];
  }

  private fallo(err: HttpErrorResponse, terminar: () => void): void {
    this.produccion.set(null);
    this.comparativa.set(null);
    // El 404 de la cuenta sin ficha explica qué hacer; se muestra tal cual.
    const body = err.error;
    const mensaje = typeof body === 'string' ? body : (body?.error ?? body?.message ?? null);
    this.error.set(mensaje ?? 'No se pudo cargar la producción.');
    terminar();
  }
}

function iso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
