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
  IonInput,
  IonButton,
  IonSpinner,
  IonChip,
  IonNote,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { CitaService, ServicioService, Servicio } from '@peluqueria/core';

@Component({
  selector: 'app-agendar',
  templateUrl: './agendar.page.html',
  styleUrls: ['./agendar.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonItem, IonLabel, IonInput, IonButton, IonSpinner,
    IonChip, IonNote, IonSelect, IonSelectOption,
    FormsModule,
  ],
})
export class AgendarPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly citaService = inject(CitaService);
  private readonly servicioService = inject(ServicioService);

  readonly servicios = signal<Servicio[]>([]);
  readonly slots = signal<string[]>([]);

  readonly servicioId = signal<number | null>(null);
  readonly fecha = signal('');
  readonly slotSeleccionado = signal('');

  readonly loadingSlots = signal(false);
  readonly loadingSubmit = signal(false);
  readonly error = signal('');
  readonly exito = signal(false);

  readonly servicioSeleccionado = computed(() =>
    this.servicios().find((s) => s.idServicio === this.servicioId())
  );

  readonly minFecha = new Date().toISOString().split('T')[0];

  ngOnInit(): void {
    const id = this.route.snapshot.queryParamMap.get('servicioId');
    if (id) this.servicioId.set(Number(id));

    this.servicioService.listar().subscribe((data) => {
      this.servicios.set(data.filter((s) => s.activo));
    });
  }

  onFechaChange(value: string | null | undefined): void {
    const v = value ?? '';
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

  private cargarSlots(fecha: string, servicioId: number): void {
    this.loadingSlots.set(true);
    this.citaService.disponibilidad(fecha, servicioId).subscribe({
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
