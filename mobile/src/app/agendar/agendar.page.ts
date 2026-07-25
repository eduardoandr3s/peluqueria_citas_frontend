import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonItem,
  IonLabel,
  IonButton,
  IonSpinner,
  IonChip,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonDatetime,
} from '@ionic/angular/standalone';
import {
  CitaService,
  ServicioService,
  Servicio,
  PeluqueroService,
  Peluquero,
  DiaCerrado,
  hoyIso,
  sumarMeses,
} from '@peluqueria/core';

@Component({
  selector: 'app-agendar',
  templateUrl: './agendar.page.html',
  styleUrls: ['./agendar.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonItem, IonLabel, IonButton, IonSpinner,
    IonChip, IonNote, IonSelect, IonSelectOption, IonDatetime,
    FormsModule,
  ],
})
export class AgendarPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly citaService = inject(CitaService);
  private readonly servicioService = inject(ServicioService);
  private readonly peluqueroService = inject(PeluqueroService);

  readonly servicios = signal<Servicio[]>([]);
  readonly peluqueros = signal<Peluquero[]>([]);
  readonly slots = signal<string[]>([]);

  readonly servicioId = signal<number | null>(null);
  readonly peluqueroId = signal<number | null>(null);
  readonly fecha = signal('');
  readonly slotSeleccionado = signal('');

  readonly loadingSlots = signal(false);
  readonly loadingSubmit = signal(false);
  readonly error = signal('');
  readonly exito = signal(false);

  readonly servicioSeleccionado = computed(() =>
    this.servicios().find((s) => s.idServicio === this.servicioId())
  );

  /** Meses que se pueden navegar en el calendario (el backend acepta como mucho 12). */
  private readonly mesesCalendario = 11;
  readonly minFecha = hoyIso();
  readonly maxFecha = sumarMeses(this.minFecha, this.mesesCalendario);

  readonly diasCerrados = signal<DiaCerrado[]>([]);

  /**
   * Callback que `ion-datetime` usa para pintar cada día: los cerrados quedan
   * deshabilitados y no se pueden pulsar. Es un computed a propósito: al cambiar
   * `diasCerrados` se emite una función nueva y el calendario se vuelve a pintar.
   */
  readonly esFechaHabilitada = computed(() => {
    const cerrados = new Set(this.diasCerrados().map((d) => d.fecha));
    return (iso: string) => !cerrados.has(iso.slice(0, 10));
  });

  ngOnInit(): void {
    const id = this.route.snapshot.queryParamMap.get('servicioId');
    if (id) this.servicioId.set(Number(id));

    this.servicioService.listar().subscribe((data) => {
      this.servicios.set(data.filter((s) => s.activo));
    });

    this.peluqueroService.listar().subscribe((data) => {
      this.peluqueros.set(data);
    });

    this.citaService.diasCerrados(this.minFecha, this.maxFecha).subscribe((data) => {
      this.diasCerrados.set(data);
    });
  }

  onFechaChange(value: string | string[] | null | undefined): void {
    // ion-datetime emite un ISO completo; solo interesa el día.
    const v = typeof value === 'string' ? value.slice(0, 10) : '';
    this.fecha.set(v);
    this.slotSeleccionado.set('');
    this.slots.set([]);
    this.error.set('');
    if (v && this.servicioId()) {
      this.cargarSlots(v, this.servicioId()!);
    }
  }

  onServicioChange(id: number): void {
    this.servicioId.set(id);
    this.slotSeleccionado.set('');
    this.slots.set([]);
    if (this.fecha() && id) {
      this.cargarSlots(this.fecha(), id);
    }
  }

  onPeluqueroChange(id: number | null): void {
    this.peluqueroId.set(id);
    this.slotSeleccionado.set('');
    this.slots.set([]);
    if (this.fecha() && this.servicioId()) {
      this.cargarSlots(this.fecha(), this.servicioId()!);
    }
  }

  private cargarSlots(fecha: string, servicioId: number): void {
    this.loadingSlots.set(true);
    this.citaService.disponibilidad(fecha, servicioId, this.peluqueroId() ?? undefined).subscribe({
      next: (data) => {
        this.slots.set(data);
        this.loadingSlots.set(false);
      },
      error: () => this.loadingSlots.set(false),
    });
  }

  confirmar(): void {
    if (!this.servicioId() || !this.fecha() || !this.slotSeleccionado()) return;
    this.loadingSubmit.set(true);
    this.error.set('');
    this.citaService
      .agendar({
        servicioId: this.servicioId()!,
        fechaHora: `${this.fecha()}T${this.slotSeleccionado()}:00`,
        peluqueroId: this.peluqueroId() ?? undefined,
      })
      .subscribe({
        next: () => {
          this.exito.set(true);
          setTimeout(() => this.router.navigateByUrl('/tabs/mis-citas', { replaceUrl: true }), 1500);
        },
        error: (err) => {
          this.loadingSubmit.set(false);
          this.error.set(err.status === 409 ? 'Ese horario ya no está disponible.' : 'Error al agendar.');
        },
      });
  }
}
